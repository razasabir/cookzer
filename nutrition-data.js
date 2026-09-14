// Hand-maintained ingredient lookup table, used to estimate a recipe's
// per-serving nutrition AND per-serving cost when its author hasn't
// typed one in. Values are per 100g (nutrition: standard reference
// macros; cost: rough everyday supermarket pricing) — a deliberate
// accuracy/cost tradeoff: no paid nutrition/pricing API, no ongoing
// cost, but real error margin from unit-conversion guesses, coarse
// ingredient matching, and prices that vary by store/region/season.
// Estimates are always labeled as estimates, never presented as exact.
(function () {
  // cal, protein(g), carbs(g), fat(g), cost($) — all per 100g of the ingredient.
  const DB = {
    'chicken breast': { cal: 165, protein: 31, carbs: 0, fat: 3.6, cost: 1.40 },
    'chicken thigh': { cal: 209, protein: 26, carbs: 0, fat: 10.9, cost: 0.90 },
    'chicken': { cal: 239, protein: 27, carbs: 0, fat: 14, cost: 1.10 },
    'ground beef': { cal: 250, protein: 26, carbs: 0, fat: 17, cost: 1.40 },
    'beef': { cal: 250, protein: 26, carbs: 0, fat: 17, cost: 1.60 },
    'steak': { cal: 271, protein: 25, carbs: 0, fat: 19, cost: 3.00 },
    'pork': { cal: 242, protein: 27, carbs: 0, fat: 14, cost: 1.30 },
    'bacon': { cal: 541, protein: 37, carbs: 1.4, fat: 42, cost: 1.80 },
    'salmon': { cal: 208, protein: 20, carbs: 0, fat: 13, cost: 3.50 },
    'shrimp': { cal: 99, protein: 24, carbs: 0.2, fat: 0.3, cost: 3.00 },
    'tuna': { cal: 132, protein: 28, carbs: 0, fat: 1, cost: 1.50 },
    'fish': { cal: 105, protein: 20, carbs: 0, fat: 2.5, cost: 2.20 },
    'egg': { cal: 155, protein: 13, carbs: 1.1, fat: 11, cost: 0.60 },
    'tofu': { cal: 76, protein: 8, carbs: 1.9, fat: 4.8, cost: 0.60 },
    'lentils': { cal: 116, protein: 9, carbs: 20, fat: 0.4, cost: 0.30 },
    'chickpeas': { cal: 164, protein: 9, carbs: 27, fat: 2.6, cost: 0.30 },
    'black beans': { cal: 132, protein: 8.9, carbs: 24, fat: 0.5, cost: 0.35 },
    'beans': { cal: 127, protein: 8.7, carbs: 23, fat: 0.5, cost: 0.35 },

    'rice': { cal: 130, protein: 2.7, carbs: 28, fat: 0.3, cost: 0.25 },
    'brown rice': { cal: 123, protein: 2.6, carbs: 26, fat: 1, cost: 0.30 },
    'pasta': { cal: 131, protein: 5, carbs: 25, fat: 1.1, cost: 0.30 },
    'noodles': { cal: 138, protein: 4.5, carbs: 25, fat: 2.1, cost: 0.35 },
    'bread': { cal: 265, protein: 9, carbs: 49, fat: 3.2, cost: 0.50 },
    'flour': { cal: 364, protein: 10, carbs: 76, fat: 1, cost: 0.15 },
    'oats': { cal: 389, protein: 17, carbs: 66, fat: 7, cost: 0.30 },
    'quinoa': { cal: 120, protein: 4.4, carbs: 21, fat: 1.9, cost: 0.90 },
    'potato': { cal: 77, protein: 2, carbs: 17, fat: 0.1, cost: 0.25 },
    'sweet potato': { cal: 86, protein: 1.6, carbs: 20, fat: 0.1, cost: 0.35 },
    'tortilla': { cal: 218, protein: 6, carbs: 36, fat: 5.5, cost: 0.60 },

    'butter': { cal: 717, protein: 0.9, carbs: 0.1, fat: 81, cost: 1.20 },
    'olive oil': { cal: 884, protein: 0, carbs: 0, fat: 100, cost: 1.50 },
    'oil': { cal: 884, protein: 0, carbs: 0, fat: 100, cost: 0.60 },
    'milk': { cal: 42, protein: 3.4, carbs: 5, fat: 1, cost: 0.20 },
    'cream': { cal: 340, protein: 2.1, carbs: 2.8, fat: 36, cost: 0.90 },
    'mozzarella': { cal: 280, protein: 22, carbs: 2.2, fat: 17, cost: 1.40 },
    'parmesan': { cal: 431, protein: 38, carbs: 4.1, fat: 29, cost: 3.50 },
    'cheese': { cal: 402, protein: 25, carbs: 1.3, fat: 33, cost: 1.60 },
    'yogurt': { cal: 59, protein: 10, carbs: 3.6, fat: 0.4, cost: 0.50 },
    'sour cream': { cal: 198, protein: 2.4, carbs: 4.6, fat: 20, cost: 0.80 },
    'cream cheese': { cal: 342, protein: 6, carbs: 4, fat: 34, cost: 1.30 },
    'mayonnaise': { cal: 680, protein: 1, carbs: 0.6, fat: 75, cost: 0.80 },
    'coconut milk': { cal: 230, protein: 2.3, carbs: 6, fat: 24, cost: 0.60 },

    'onion': { cal: 40, protein: 1.1, carbs: 9, fat: 0.1, cost: 0.25 },
    'garlic': { cal: 149, protein: 6.4, carbs: 33, fat: 0.5, cost: 1.50 },
    'tomato': { cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, cost: 0.50 },
    'carrot': { cal: 41, protein: 0.9, carbs: 10, fat: 0.2, cost: 0.25 },
    'broccoli': { cal: 34, protein: 2.8, carbs: 7, fat: 0.4, cost: 0.60 },
    'spinach': { cal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, cost: 0.90 },
    'bell pepper': { cal: 31, protein: 1, carbs: 6, fat: 0.3, cost: 0.90 },
    'mushroom': { cal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, cost: 0.90 },
    'zucchini': { cal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, cost: 0.45 },
    'cucumber': { cal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, cost: 0.40 },
    'lettuce': { cal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, cost: 0.40 },
    'cabbage': { cal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, cost: 0.25 },
    'corn': { cal: 86, protein: 3.2, carbs: 19, fat: 1.2, cost: 0.35 },
    'peas': { cal: 81, protein: 5.4, carbs: 14, fat: 0.4, cost: 0.60 },
    'avocado': { cal: 160, protein: 2, carbs: 9, fat: 15, cost: 0.90 },
    'lemon': { cal: 29, protein: 1.1, carbs: 9.3, fat: 0.3, cost: 0.60 },
    'lime': { cal: 30, protein: 0.7, carbs: 11, fat: 0.2, cost: 0.80 },
    'apple': { cal: 52, protein: 0.3, carbs: 14, fat: 0.2, cost: 0.50 },
    'banana': { cal: 89, protein: 1.1, carbs: 23, fat: 0.3, cost: 0.30 },
    'ginger': { cal: 80, protein: 1.8, carbs: 18, fat: 0.8, cost: 1.80 },
    'celery': { cal: 16, protein: 0.7, carbs: 3, fat: 0.2, cost: 0.40 },

    'sugar': { cal: 387, protein: 0, carbs: 100, fat: 0, cost: 0.15 },
    'brown sugar': { cal: 380, protein: 0, carbs: 98, fat: 0, cost: 0.20 },
    'honey': { cal: 304, protein: 0.3, carbs: 82, fat: 0, cost: 1.50 },
    'vanilla extract': { cal: 288, protein: 0.1, carbs: 13, fat: 0.1, cost: 8.00 },
    'baking powder': { cal: 53, protein: 0, carbs: 28, fat: 0, cost: 2.00 },
    'baking soda': { cal: 0, protein: 0, carbs: 0, fat: 0, cost: 0.50 },
    'salt': { cal: 0, protein: 0, carbs: 0, fat: 0, cost: 0.10 },
    'black pepper': { cal: 251, protein: 10, carbs: 64, fat: 3.3, cost: 3.00 },
    'cinnamon': { cal: 247, protein: 4, carbs: 81, fat: 1.2, cost: 2.50 },
    'cocoa powder': { cal: 228, protein: 20, carbs: 58, fat: 14, cost: 2.00 },
    'chocolate chips': { cal: 479, protein: 4.2, carbs: 63, fat: 24, cost: 1.60 },
    'vinegar': { cal: 18, protein: 0, carbs: 0.9, fat: 0, cost: 0.30 },
    'soy sauce': { cal: 53, protein: 8, carbs: 4.9, fat: 0.1, cost: 0.40 },
    'ketchup': { cal: 101, protein: 1.3, carbs: 26, fat: 0.2, cost: 0.40 },
    'mustard': { cal: 66, protein: 4.4, carbs: 5.8, fat: 3.3, cost: 0.60 },

    'almonds': { cal: 579, protein: 21, carbs: 22, fat: 50, cost: 2.80 },
    'peanut butter': { cal: 588, protein: 25, carbs: 20, fat: 50, cost: 0.90 },
    'walnuts': { cal: 654, protein: 15, carbs: 14, fat: 65, cost: 3.50 },
    'peanuts': { cal: 567, protein: 26, carbs: 16, fat: 49, cost: 1.00 },
  };

  // Grams per cup where a cup's weight meaningfully differs from the
  // ~200g generic default (dry goods especially).
  const PER_CUP_OVERRIDE = {
    'flour': 120, 'sugar': 200, 'brown sugar': 220, 'rice': 185, 'brown rice': 185,
    'oats': 80, 'butter': 227, 'chocolate chips': 170, 'cheese': 113, 'mozzarella': 113,
    'parmesan': 100, 'milk': 240, 'cream': 240, 'sour cream': 240, 'mayonnaise': 220,
    'honey': 340, 'peanut butter': 258, 'almonds': 143, 'walnuts': 120, 'peanuts': 146,
  };

  // Grams for one countable unit ("1 egg", "2 onions", "3 cloves garlic")
  // when the ingredient's quantity has no recognized volume/weight unit.
  const PER_UNIT_OVERRIDE = {
    'egg': 50, 'onion': 110, 'tomato': 120, 'bell pepper': 120, 'carrot': 60,
    'avocado': 150, 'lemon': 58, 'lime': 44, 'apple': 180, 'banana': 118,
    'garlic': 3, 'potato': 170, 'sweet potato': 130, 'bread': 28,
  };

  const UNIT_GRAMS = {
    g: 1, gram: 1, kg: 1000, kilogram: 1000,
    oz: 28.35, ounce: 28.35, lb: 453.6, pound: 453.6,
    ml: 1, milliliter: 1, l: 1000, liter: 1000, litre: 1000,
    cup: 200, tbsp: 15, tablespoon: 15, tsp: 5, teaspoon: 5,
  };

  const FRACTION_CHARS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

  function normalize(name) {
    return (name || '').toLowerCase().replace(/\([^)]*\)/g, '').trim();
  }

  const SORTED_KEYS = Object.keys(DB).sort((a, b) => b.length - a.length);

  function matchIngredient(name) {
    const norm = normalize(name);
    if (!norm) return null;
    for (const key of SORTED_KEYS) {
      if (norm.includes(key)) return key;
    }
    return null;
  }

  function parseLeadingNumber(str) {
    str = str.trim();
    let m = str.match(/^(\d+)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])/);
    if (m) {
      const whole = m[1] ? parseInt(m[1], 10) : 0;
      return { value: whole + FRACTION_CHARS[m[2]], rest: str.slice(m[0].length).trim() };
    }
    m = str.match(/^(\d+)\s+(\d+)\/(\d+)/);
    if (m) return { value: parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10), rest: str.slice(m[0].length).trim() };
    m = str.match(/^(\d+)\/(\d+)/);
    if (m) return { value: parseInt(m[1], 10) / parseInt(m[2], 10), rest: str.slice(m[0].length).trim() };
    m = str.match(/^(\d+(\.\d+)?)/);
    if (m) return { value: parseFloat(m[1]), rest: str.slice(m[0].length).trim() };
    return null;
  }

  function toGrams(amount, unit, key) {
    if (!unit) {
      const perUnit = PER_UNIT_OVERRIDE[key];
      return perUnit ? amount * perUnit : null;
    }
    const singular = unit.replace(/s$/, '');
    if (singular === 'cup') return amount * (PER_CUP_OVERRIDE[key] || UNIT_GRAMS.cup);
    if (singular === 'tbsp' || singular === 'tablespoon') return amount * ((PER_CUP_OVERRIDE[key] || UNIT_GRAMS.cup) / 16);
    if (singular === 'tsp' || singular === 'teaspoon') return amount * ((PER_CUP_OVERRIDE[key] || UNIT_GRAMS.cup) / 48);
    if (UNIT_GRAMS[singular] != null) return amount * UNIT_GRAMS[singular];
    const perUnit = PER_UNIT_OVERRIDE[key];
    return perUnit ? amount * perUnit : null;
  }

  // Shared first pass: match each ingredient line to a DB key and a
  // gram weight. Both the nutrition and cost estimators consume this so
  // matching/parsing logic never drifts between the two.
  function matchIngredients(recipe) {
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return [];
    const matches = [];
    recipe.ingredients.forEach((ing) => {
      const name = ing && ing.name;
      if (!name) return;
      const key = matchIngredient(name);
      if (!key) return;

      const qty = (ing.qty || '').trim();
      const parsed = qty ? parseLeadingNumber(qty) : null;
      if (!parsed) return;

      const unitMatch = parsed.rest.match(/^([a-z]+)/i);
      const unit = unitMatch ? unitMatch[1].toLowerCase() : '';
      const grams = toGrams(parsed.value, unit, key);
      if (grams == null || !isFinite(grams) || grams <= 0) return;

      matches.push({ key, grams });
    });
    return matches;
  }

  // Returns { calories, protein, carbs, fat } per serving, or null if
  // there isn't enough to work with (no ingredients, no matches, or no
  // usable serving count).
  function estimateForRecipe(recipe) {
    const matches = matchIngredients(recipe);
    if (matches.length === 0) return null;
    const servings = Number(recipe.servings) || 1;

    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    matches.forEach(({ key, grams }) => {
      const per100 = DB[key];
      const factor = grams / 100;
      totals.calories += per100.cal * factor;
      totals.protein += per100.protein * factor;
      totals.carbs += per100.carbs * factor;
      totals.fat += per100.fat * factor;
    });

    return {
      calories: Math.round(totals.calories / servings),
      protein: Math.round(totals.protein / servings),
      carbs: Math.round(totals.carbs / servings),
      fat: Math.round(totals.fat / servings),
    };
  }

  // Returns an estimated cost per serving (a plain number, $) or null.
  function estimateCostForRecipe(recipe) {
    const matches = matchIngredients(recipe);
    if (matches.length === 0) return null;
    const servings = Number(recipe.servings) || 1;

    const total = matches.reduce((sum, { key, grams }) => sum + DB[key].cost * (grams / 100), 0);
    return Math.round((total / servings) * 100) / 100;
  }

  window.CookzerNutrition = { estimateForRecipe, estimateCostForRecipe };
})();
