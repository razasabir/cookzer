// Vercel serverless function. Fetches a recipe page server-side (avoids
// the browser CORS wall that blocks fetching arbitrary third-party sites
// from client JS) and pulls out its schema.org Recipe structured data
// (the JSON-LD block almost every real recipe site embeds for Google's
// recipe rich-results). Returns best-effort structured fields for the
// recipe wizard to prefill — the user still reviews and edits everything
// before it's ever saved, so imperfect extraction is an acceptable
// starting point, not a correctness requirement.
//
// No external API, no cost — just a fetch + a JSON-LD parse.

const SUPABASE_URL = 'https://tmzjliznexgmteubxall.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F4Yx16c0KA-kskGOa36Ygg_tcZfMYW8';

const MAX_BYTES = 4 * 1024 * 1024; // 4MB cap on the fetched page
const FETCH_TIMEOUT_MS = 8000;

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;
  // Reject IP-literal hosts outright (recipe sites are always named
  // domains) — the simplest reliable guard against hitting internal
  // infrastructure by IP from a server-side fetch.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return true;
  if (h.includes(':')) return true; // IPv6 literal
  return false;
}

async function fetchWithLimits(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CookzerRecipeImport/1.0; +https://cookzer.com)',
        Accept: 'text/html',
      },
    });
    if (!resp.ok) throw new Error('Fetch failed with status ' + resp.status);
    const reader = resp.body.getReader();
    let received = 0;
    let chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) throw new Error('Page too large');
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return buf.toString('utf-8');
  } finally {
    clearTimeout(timer);
  }
}

function parseIsoDurationToMinutes(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const match = iso.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const mins = parseInt(match[2] || '0', 10);
  const total = hours * 60 + mins;
  return total > 0 ? total : null;
}

function textOf(node) {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node.text === 'string') return node.text.trim();
  if (typeof node.name === 'string') return node.name.trim();
  return '';
}

function flattenInstructions(instructions) {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(instructions)) instructions = [instructions];

  const out = [];
  instructions.forEach((node) => {
    if (!node) return;
    if (typeof node === 'string') {
      out.push(node.trim());
      return;
    }
    const type = node['@type'];
    if (type === 'HowToSection' && Array.isArray(node.itemListElement)) {
      out.push(...flattenInstructions(node.itemListElement));
      return;
    }
    const text = textOf(node);
    if (text) out.push(text);
  });
  return out.filter(Boolean);
}

function firstImageUrl(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return firstImageUrl(image[0]);
  if (typeof image === 'object' && typeof image.url === 'string') return image.url;
  return null;
}

// Very rough "2 cups flour" -> { qty: "2 cups", name: "flour" } splitter.
// Good enough as a starting point the user edits, not a guarantee.
function splitIngredient(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^([\d¼½¾⅓⅔.\/\s]+(?:[a-zA-Z]+\.?)?)\s+(.+)$/);
  if (match && /\d|[¼½¾⅓⅔]/.test(match[1])) {
    return { qty: match[1].trim(), name: match[2].trim() };
  }
  return { qty: '', name: trimmed };
}

function findRecipeNode(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== 'object') return null;

  const type = data['@type'];
  const typeList = Array.isArray(type) ? type : [type];
  if (typeList.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) {
    return data;
  }
  if (Array.isArray(data['@graph'])) {
    return findRecipeNode(data['@graph']);
  }
  return null;
}

function extractRecipeFromHtml(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch (e) {
      // Some sites emit near-JSON with trailing commas or comments —
      // skip anything that doesn't parse cleanly rather than guessing.
    }
  }

  for (const block of blocks) {
    const node = findRecipeNode(block);
    if (node) return node;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer /i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing auth token' });
    return;
  }
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userResp.ok) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const rawUrl = (req.body && req.body.url) || '';
  let target;
  try {
    target = new URL(rawUrl);
  } catch (e) {
    res.status(400).json({ error: 'That doesn\'t look like a valid URL.' });
    return;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http/https links are supported.' });
    return;
  }
  if (isBlockedHost(target.hostname)) {
    res.status(400).json({ error: 'That URL isn\'t supported.' });
    return;
  }

  let html;
  try {
    html = await fetchWithLimits(target.toString());
  } catch (e) {
    res.status(502).json({ error: 'Could not fetch that page: ' + e.message });
    return;
  }

  const recipe = extractRecipeFromHtml(html);
  if (!recipe) {
    res.status(422).json({ error: 'No recipe data found on that page. Try a different link, or enter it manually.' });
    return;
  }

  const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
    .map((s) => (typeof s === 'string' ? s : textOf(s)))
    .filter(Boolean)
    .map(splitIngredient);

  const steps = flattenInstructions(recipe.recipeInstructions);

  let category = null;
  const rawCategory = Array.isArray(recipe.recipeCategory) ? recipe.recipeCategory[0] : recipe.recipeCategory;
  if (typeof rawCategory === 'string') {
    const KNOWN = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Baking', 'Appetizers', 'BBQ'];
    category = KNOWN.find((c) => rawCategory.toLowerCase().includes(c.toLowerCase())) || null;
  }

  let servings = null;
  const rawYield = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
  if (rawYield) {
    const yieldMatch = String(rawYield).match(/\d+/);
    if (yieldMatch) servings = parseInt(yieldMatch[0], 10);
  }

  const nutrition = recipe.nutrition || {};
  const numFrom = (v) => {
    if (!v) return null;
    const match = String(v).match(/[\d.]+/);
    return match ? Math.round(parseFloat(match[0])) : null;
  };

  res.status(200).json({
    title: textOf(recipe.name) || null,
    description: textOf(recipe.description) || null,
    imageUrl: firstImageUrl(recipe.image),
    category,
    prepTimeMinutes: parseIsoDurationToMinutes(recipe.prepTime),
    cookTimeMinutes: parseIsoDurationToMinutes(recipe.cookTime),
    servings,
    ingredients,
    steps,
    nutrition: {
      calories: numFrom(nutrition.calories),
      protein: numFrom(nutrition.proteinContent),
      carbs: numFrom(nutrition.carbohydrateContent),
      fat: numFrom(nutrition.fatContent),
    },
    sourceUrl: target.toString(),
  });
};
