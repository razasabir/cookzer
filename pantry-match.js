// Shared "what can I make with this?" matching engine — powers the
// feed sidebar's quick pantry widget and the full Pantry Challenge /
// Leftovers page. Pure client-side substring matching against real
// recipes.ingredients, no external API, same cost/accuracy tradeoff as
// nutrition-data.js: coarse, always labeled as a match count, never
// presented as a guarantee the recipe is actually makeable as-is.
(function () {
  // Leftover/half-used descriptions carry filler words a raw ingredient
  // list never would ("leftover rice", "half a roast chicken") — strip
  // them before matching so "roast chicken" still matches a "chicken"
  // ingredient instead of only ever matching on the literal phrase.
  const FILLER_WORDS = [
    'leftover', 'leftovers', 'half a', 'half of', 'half', 'some', 'a bit of',
    'a little', 'a little bit of', 'cooked', 'extra', 'few', 'bit of', 'spare',
  ];

  function cleanToken(raw) {
    let t = (raw || '').trim().toLowerCase();
    FILLER_WORDS.forEach((w) => {
      t = t.replace(new RegExp('\\b' + w.replace(/\s+/g, '\\s+') + '\\b', 'g'), ' ');
    });
    return t.replace(/\s+/g, ' ').trim();
  }

  // Splits a comma-separated "chicken, rice, half a roast chicken" input
  // into cleaned, deduped tokens.
  function parseTokens(raw) {
    const seen = new Set();
    (raw || '').split(',').forEach((part) => {
      const cleaned = cleanToken(part);
      if (cleaned) seen.add(cleaned);
    });
    return Array.from(seen);
  }

  // recipes: [{ id, title, ingredients, hero_photo_path? }], tokens: string[]
  // Returns recipes with at least one matched ingredient, ranked by how
  // much of the recipe those tokens cover.
  function scoreRecipes(recipes, tokens) {
    if (!tokens || tokens.length === 0) return [];
    return (recipes || [])
      .map((r) => {
        const names = (r.ingredients || []).map((ing) => (ing && ing.name || '').toLowerCase()).filter(Boolean);
        if (names.length === 0) return null;
        const matchedNames = names.filter((name) => tokens.some((tok) => name.includes(tok) || tok.includes(name)));
        if (matchedNames.length === 0) return null;
        return {
          id: r.id,
          title: r.title,
          hero_photo_path: r.hero_photo_path || null,
          matchCount: matchedNames.length,
          total: names.length,
          pct: Math.round((matchedNames.length / names.length) * 100),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct || b.matchCount - a.matchCount);
  }

  window.CookzerPantryMatch = { parseTokens, scoreRecipes };
})();
