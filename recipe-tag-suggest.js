// Suggests free-form recipe tags (the same tags typed into recipe-new.html's
// "Tags" field, and what the feed's filter bar now filters by) from the
// recipe's own fields — a deterministic lookup/keyword pass, same spirit
// as unit-convert.js's ingredient density table or the photo filter
// suggestion's pixel-stat heuristics, not a live AI call. Always a
// suggestion the author can accept or ignore, never something written
// into the recipe on its own.
(function () {
  const SPEED_QUICK_MAX_MINUTES = 20;
  const SPEED_WEEKNIGHT_MAX_MINUTES = 40;
  const SIMPLE_INGREDIENT_MAX = 5;

  const CATEGORY_TAG = {
    Breakfast: 'breakfast',
    Lunch: 'lunch',
    Dinner: 'dinner',
    Dessert: 'dessert',
    Baking: 'baking',
    Appetizers: 'appetizers',
    BBQ: 'bbq',
  };

  // [tag, pattern] — matched against title + description + ingredient
  // names + step text combined. Order doesn't matter; the caller dedupes.
  const KEYWORD_TAGS = [
    ['chicken', /\bchicken\b/],
    ['beef', /\bbeef\b/],
    ['pork', /\bpork\b|\bbacon\b|\bham\b/],
    ['shrimp', /\bshrimp\b|\bprawns?\b/],
    ['seafood', /\bsalmon\b|\bfish\b|\bcrab\b|\bscallops?\b/],
    ['tofu', /\btofu\b/],
    ['pasta', /\bpasta\b|\bspaghetti\b|\bpenne\b|\bnoodles?\b/],
    ['rice', /\brice\b/],
    ['soup', /\bsoup\b|\bstew\b|\bbroth\b/],
    ['salad', /\bsalad\b/],
    ['curry', /\bcurry\b/],
    ['grilled', /\bgrill(ed|ing)?\b/],
    ['baked', /\bbak(ed|ing)?\b|\boven[\s-]?roast/],
    ['fried', /\b(deep[\s-]?)?fr(y|ied|ying)\b/],
    ['roasted', /\broast(ed|ing)?\b/],
    ['slow-cooker', /\bslow[\s-]?cook(er)?\b|\bcrock\s?pot\b/],
    ['instant-pot', /\binstant\s?pot\b|\bpressure\s?cook(er|ing)?\b/],
    ['one-pot', /\bone[\s-]?pot\b|\bone[\s-]?pan\b/],
    ['sheet-pan', /\bsheet\s?pan\b/],
    ['no-bake', /\bno[\s-]?bake\b/],
    ['meal-prep', /\bmeal\s?prep\b/],
    ['leftovers', /\bleftovers?\b/],
    ['kid-friendly', /\bkids?\b/],
    ['make-ahead', /\bmake[\s-]?ahead\b/],
    ['freezer-friendly', /\bfreez(e|er|es|able)\b/],
  ];

  function suggest(input) {
    input = input || {};
    const title = input.title || '';
    const description = input.description || '';
    const category = input.category || '';
    const spiceLevel = input.spiceLevel || '';
    const dietaryTags = input.dietaryTags || [];
    const prepMinutes = Number(input.prepMinutes) || 0;
    const cookMinutes = Number(input.cookMinutes) || 0;
    const ingredientNames = input.ingredientNames || [];
    const stepTexts = input.stepTexts || [];

    const tags = new Set();

    const totalMinutes = prepMinutes + cookMinutes;
    if (totalMinutes > 0 && totalMinutes <= SPEED_QUICK_MAX_MINUTES) tags.add('quick');
    if (totalMinutes > 0 && totalMinutes <= SPEED_WEEKNIGHT_MAX_MINUTES) tags.add('weeknight');

    if (spiceLevel === 'Hot' || spiceLevel === 'Extra hot') tags.add('spicy');

    if (CATEGORY_TAG[category]) tags.add(CATEGORY_TAG[category]);

    dietaryTags.forEach((d) => { if (d) tags.add(String(d).toLowerCase()); });

    if (ingredientNames.length > 0 && ingredientNames.length <= SIMPLE_INGREDIENT_MAX) tags.add('easy');

    const haystack = [title, description].concat(ingredientNames, stepTexts).join(' ').toLowerCase();
    KEYWORD_TAGS.forEach(([tag, pattern]) => { if (pattern.test(haystack)) tags.add(tag); });

    return Array.from(tags);
  }

  window.CookzerTagSuggest = { suggest };
})();
