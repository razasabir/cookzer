// Cooking unit conversion — pure functions, no DOM/Supabase. Used by the
// inline ingredient converter on recipe pages and the standalone
// cookzer-convert.html tool.
//
// Mass and volume convert exactly (fixed ratios). Converting mass<->volume
// (e.g. "how many cups is 200g of flour?") depends on the ingredient's
// density, which varies a lot by ingredient — only attempted when the
// ingredient name matches a known entry in INGREDIENT_DENSITY below;
// otherwise cross-category conversion is left out rather than guessing.
(function () {
  const MASS_TO_GRAMS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
  const VOLUME_TO_ML = { ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, 'fl oz': 29.5735 };

  const UNIT_ALIASES = {
    g: 'g', gram: 'g', grams: 'g', gm: 'g', gms: 'g',
    kg: 'kg', kilogram: 'kg', kilograms: 'kg',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
    cup: 'cup', cups: 'cup',
    'fl oz': 'fl oz', floz: 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  };

  // Grams per US cup for common cooking/baking ingredients — the same
  // approximations used by nutrition-data.js's cost estimator, kept here
  // as an independent copy since that module isn't a shared dependency.
  const INGREDIENT_DENSITY_PER_CUP = {
    flour: 120, 'all-purpose flour': 120, 'plain flour': 120,
    sugar: 200, 'granulated sugar': 200, 'caster sugar': 200,
    'brown sugar': 220, 'powdered sugar': 120, 'icing sugar': 120,
    butter: 227, milk: 240, water: 236, cream: 240, 'sour cream': 240, yogurt: 245,
    honey: 340, 'maple syrup': 322, oil: 218, 'olive oil': 216,
    rice: 185, oats: 90, salt: 273, 'cocoa powder': 84, cornstarch: 128, cornflour: 128,
  };

  const UNIT_LIST = [
    { unit: 'g', label: 'Grams (g)', category: 'mass' },
    { unit: 'kg', label: 'Kilograms (kg)', category: 'mass' },
    { unit: 'oz', label: 'Ounces (oz)', category: 'mass' },
    { unit: 'lb', label: 'Pounds (lb)', category: 'mass' },
    { unit: 'ml', label: 'Milliliters (ml)', category: 'volume' },
    { unit: 'l', label: 'Liters (l)', category: 'volume' },
    { unit: 'tsp', label: 'Teaspoons (tsp)', category: 'volume' },
    { unit: 'tbsp', label: 'Tablespoons (tbsp)', category: 'volume' },
    { unit: 'cup', label: 'Cups', category: 'volume' },
    { unit: 'fl oz', label: 'Fluid ounces (fl oz)', category: 'volume' },
  ];

  const FRACTION_CHARS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

  function canonicalUnit(unit) {
    if (!unit) return null;
    return UNIT_ALIASES[unit.trim().toLowerCase()] || null;
  }

  function categoryOf(canonical) {
    if (MASS_TO_GRAMS[canonical]) return 'mass';
    if (VOLUME_TO_ML[canonical]) return 'volume';
    return null;
  }

  function densityGramsPerMl(ingredientName) {
    if (!ingredientName) return null;
    const name = ingredientName.toLowerCase();
    // Exact match first, then substring (e.g. "salted butter, softened" -> "butter").
    if (INGREDIENT_DENSITY_PER_CUP[name] != null) {
      return INGREDIENT_DENSITY_PER_CUP[name] / VOLUME_TO_ML.cup;
    }
    for (const key of Object.keys(INGREDIENT_DENSITY_PER_CUP)) {
      if (name.indexOf(key) !== -1) return INGREDIENT_DENSITY_PER_CUP[key] / VOLUME_TO_ML.cup;
    }
    return null;
  }

  // Parses a leading number off a free-text quantity string: unicode
  // fraction glyphs, "1 1/2", "1/2", or a plain decimal/integer.
  function parseLeadingNumber(str) {
    const s = str.trim();
    if (s.length === 0) return null;
    if (FRACTION_CHARS[s[0]] != null) {
      return { value: FRACTION_CHARS[s[0]], consumed: s[0] };
    }
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
    if (mixed) {
      const whole = parseInt(mixed[1], 10);
      const num = parseInt(mixed[2], 10);
      const den = parseInt(mixed[3], 10);
      return { value: whole + num / den, consumed: mixed[0] };
    }
    const frac = s.match(/^(\d+)\/(\d+)/);
    if (frac) {
      return { value: parseInt(frac[1], 10) / parseInt(frac[2], 10), consumed: frac[0] };
    }
    const dec = s.match(/^\d+(\.\d+)?/);
    if (dec) {
      return { value: parseFloat(dec[0]), consumed: dec[0] };
    }
    return null;
  }

  // "400g" -> {amount:400, unit:'g', rest:''}; "1/2 tsp" -> {amount:0.5, unit:'tsp', rest:''};
  // "to taste" / "2 large" -> {amount, unit:null, rest:<whatever couldn't be parsed as a unit>}.
  function parseQuantity(str) {
    const original = str || '';
    const parsed = parseLeadingNumber(original);
    if (!parsed) return { amount: null, unit: null, rest: original.trim() };
    const afterNumber = original.slice(original.indexOf(parsed.consumed) + parsed.consumed.length).trim();
    const unitMatch = afterNumber.match(/^([a-zA-Z]+(?:\s+oz)?)/);
    if (unitMatch) {
      const candidate = unitMatch[0].toLowerCase();
      const canonical = canonicalUnit(candidate);
      if (canonical) {
        return { amount: parsed.value, unit: canonical, rest: afterNumber.slice(unitMatch[0].length).trim() };
      }
    }
    return { amount: parsed.value, unit: null, rest: afterNumber };
  }

  // Converts between any two recognized units, crossing mass<->volume only
  // when densityGramsPerMl() finds a match for ingredientName. Returns
  // null when the conversion can't be done (unknown unit, or a mass<->volume
  // conversion with no known density).
  function convert(amount, fromUnit, toUnit, ingredientName) {
    const from = canonicalUnit(fromUnit);
    const to = canonicalUnit(toUnit);
    if (!from || !to || amount == null || Number.isNaN(amount)) return null;
    if (from === to) return amount;

    const fromCat = categoryOf(from);
    const toCat = categoryOf(to);
    if (fromCat === 'mass' && toCat === 'mass') {
      return (amount * MASS_TO_GRAMS[from]) / MASS_TO_GRAMS[to];
    }
    if (fromCat === 'volume' && toCat === 'volume') {
      return (amount * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to];
    }
    const density = densityGramsPerMl(ingredientName);
    if (!density) return null;
    if (fromCat === 'mass' && toCat === 'volume') {
      const grams = amount * MASS_TO_GRAMS[from];
      const ml = grams / density;
      return ml / VOLUME_TO_ML[to];
    }
    if (fromCat === 'volume' && toCat === 'mass') {
      const ml = amount * VOLUME_TO_ML[from];
      const grams = ml * density;
      return grams / MASS_TO_GRAMS[to];
    }
    return null;
  }

  // Rounds for display: up to 2 decimal places, trailing zeros trimmed.
  function formatAmount(value) {
    if (value == null || Number.isNaN(value)) return '';
    if (value !== 0 && Math.abs(value) < 0.01) return '<0.01';
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }

  // Returns alternate-unit readings for a given amount+unit, same category
  // always, cross-category (mass<->volume) only when the ingredient's
  // density is known.
  function getAlternateUnits(amount, unit, ingredientName) {
    const canonical = canonicalUnit(unit);
    if (!canonical || amount == null) return [];
    const category = categoryOf(canonical);
    if (!category) return [];
    const hasDensity = densityGramsPerMl(ingredientName) != null;
    const out = [];
    UNIT_LIST.forEach((entry) => {
      if (entry.unit === canonical) return;
      if (entry.category !== category && !hasDensity) return;
      const converted = convert(amount, canonical, entry.unit, ingredientName);
      if (converted == null) return;
      out.push({ unit: entry.unit, label: entry.label, amount: converted, display: formatAmount(converted) + ' ' + entry.unit });
    });
    return out;
  }

  window.CookzerUnitConvert = {
    parseQuantity,
    convert,
    getAlternateUnits,
    formatAmount,
    canonicalUnit,
    categoryOf,
    UNIT_LIST,
  };
})();
