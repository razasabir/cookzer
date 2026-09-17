const { test, expect } = require('@playwright/test');

// Pure-logic tests for unit-convert.js — no browser page needed, the
// module only touches window.CookzerUnitConvert.
function loadConverter() {
  delete require.cache[require.resolve('../unit-convert.js')];
  const fakeWindow = {};
  global.window = fakeWindow;
  require('../unit-convert.js');
  return fakeWindow.CookzerUnitConvert;
}

test.describe('unit-convert quantity parsing', () => {
  test('parses a plain amount + unit', () => {
    const { parseQuantity } = loadConverter();
    expect(parseQuantity('400g')).toEqual({ amount: 400, unit: 'g', rest: '' });
    expect(parseQuantity('3 cups')).toEqual({ amount: 3, unit: 'cup', rest: '' });
  });

  test('parses fractions — "1/2", mixed "1 1/2", and unicode glyphs', () => {
    const { parseQuantity } = loadConverter();
    expect(parseQuantity('1/2 tsp')).toEqual({ amount: 0.5, unit: 'tsp', rest: '' });
    expect(parseQuantity('1 1/2 cups')).toEqual({ amount: 1.5, unit: 'cup', rest: '' });
    expect(parseQuantity('½ cup')).toEqual({ amount: 0.5, unit: 'cup', rest: '' });
  });

  test('non-measurement quantities have no unit, rest holds the leftover text', () => {
    const { parseQuantity } = loadConverter();
    expect(parseQuantity('to taste')).toEqual({ amount: null, unit: null, rest: 'to taste' });
    expect(parseQuantity('2 large')).toEqual({ amount: 2, unit: null, rest: 'large' });
    expect(parseQuantity('4')).toEqual({ amount: 4, unit: null, rest: '' });
  });

  test('recognizes unit synonyms case-insensitively', () => {
    const { parseQuantity } = loadConverter();
    expect(parseQuantity('2 Tablespoons').unit).toBe('tbsp');
    expect(parseQuantity('1 Kilogram').unit).toBe('kg');
  });
});

test.describe('unit-convert same-category conversion', () => {
  test('mass <-> mass is exact', () => {
    const { convert } = loadConverter();
    expect(convert(1, 'kg', 'g')).toBe(1000);
    expect(convert(453.592, 'g', 'lb')).toBeCloseTo(1, 5);
  });

  test('volume <-> volume is exact', () => {
    const { convert } = loadConverter();
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16, 1);
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 5);
  });

  test('same unit returns the input unchanged', () => {
    const { convert } = loadConverter();
    expect(convert(42, 'g', 'g')).toBe(42);
  });
});

test.describe('unit-convert cross-category (mass <-> volume) conversion', () => {
  test('converts using a known ingredient density', () => {
    const { convert } = loadConverter();
    // 120g flour per cup -> 240g should read back as ~2 cups.
    expect(convert(240, 'g', 'cup', 'flour')).toBeCloseTo(2, 1);
  });

  test('matches ingredient density via substring (e.g. "salted butter, softened")', () => {
    const { convert } = loadConverter();
    const viaSubstring = convert(1, 'cup', 'g', 'salted butter, softened');
    const viaExact = convert(1, 'cup', 'g', 'butter');
    expect(viaSubstring).toBeCloseTo(viaExact, 5);
  });

  test('returns null when the ingredient has no known density', () => {
    const { convert } = loadConverter();
    expect(convert(100, 'g', 'cup', 'dragonfruit essence')).toBeNull();
    expect(convert(100, 'g', 'cup', null)).toBeNull();
  });
});

test.describe('unit-convert getAlternateUnits', () => {
  test('lists same-category alternates for a mass quantity', () => {
    const { getAlternateUnits } = loadConverter();
    const alts = getAlternateUnits(400, 'g', 'spaghetti');
    const units = alts.map((a) => a.unit);
    expect(units).toContain('kg');
    expect(units).toContain('oz');
    expect(units).toContain('lb');
    expect(units).not.toContain('g'); // never lists the unit you already have
  });

  test('includes cross-category alternates only when density is known', () => {
    const { getAlternateUnits } = loadConverter();
    const withDensity = getAlternateUnits(200, 'g', 'sugar');
    expect(withDensity.map((a) => a.unit)).toContain('cup');

    const withoutDensity = getAlternateUnits(200, 'g', 'spaghetti');
    expect(withoutDensity.map((a) => a.unit)).not.toContain('cup');
  });

  test('returns an empty list for unrecognized units', () => {
    const { getAlternateUnits } = loadConverter();
    expect(getAlternateUnits(2, null, 'egg')).toEqual([]);
    expect(getAlternateUnits(null, 'g', 'flour')).toEqual([]);
  });
});
