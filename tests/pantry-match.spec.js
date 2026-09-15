const { test, expect } = require('@playwright/test');

// Pure-logic tests for pantry-match.js — no browser page needed, the
// module only touches window.CookzerPantryMatch.
function loadMatcher() {
  delete require.cache[require.resolve('../pantry-match.js')];
  const fakeWindow = {};
  global.window = fakeWindow;
  require('../pantry-match.js');
  return fakeWindow.CookzerPantryMatch;
}

test.describe('pantry-match token parsing', () => {
  test('splits, lowercases and dedupes comma-separated ingredients', () => {
    const { parseTokens } = loadMatcher();
    expect(parseTokens('Chicken, Rice, chicken, onion')).toEqual(['chicken', 'rice', 'onion']);
  });

  test('strips leftover/half-used filler words down to the food itself', () => {
    const { parseTokens } = loadMatcher();
    expect(parseTokens('half a roast chicken, leftover rice, a bit of spinach')).toEqual([
      'roast chicken', 'rice', 'spinach',
    ]);
  });

  test('ignores blank input', () => {
    const { parseTokens } = loadMatcher();
    expect(parseTokens('')).toEqual([]);
    expect(parseTokens(',,  ,')).toEqual([]);
  });
});

test.describe('pantry-match recipe scoring', () => {
  const recipes = [
    { id: 'r1', title: 'Lemon Chicken', ingredients: [{ name: 'Chicken breast' }, { name: 'Lemon' }, { name: 'Garlic' }] },
    { id: 'r2', title: 'Veggie Stir Fry', ingredients: [{ name: 'Broccoli' }, { name: 'Carrot' }, { name: 'Soy sauce' }] },
    { id: 'r3', title: 'Chicken Fried Rice', ingredients: [{ name: 'Chicken' }, { name: 'Rice' }, { name: 'Egg' }, { name: 'Peas' }] },
  ];

  test('ranks recipes by how much of their ingredient list is covered', () => {
    const { scoreRecipes } = loadMatcher();
    const scored = scoreRecipes(recipes, ['chicken']);
    expect(scored.map((r) => r.id)).toEqual(['r1', 'r3']); // r1: 1/3 = 33%, r3: 1/4 = 25%
    expect(scored[0].pct).toBe(33);
  });

  test('leftover-style input still matches via substring cleanup', () => {
    const { parseTokens, scoreRecipes } = loadMatcher();
    const tokens = parseTokens('leftover roast chicken, some rice');
    const scored = scoreRecipes(recipes, tokens);
    expect(scored[0].id).toBe('r3'); // matches both chicken and rice -> 2/4 = 50%
    expect(scored[0].pct).toBe(50);
  });

  test('returns an empty list when nothing matches or there are no tokens', () => {
    const { scoreRecipes } = loadMatcher();
    expect(scoreRecipes(recipes, ['unobtainium'])).toEqual([]);
    expect(scoreRecipes(recipes, [])).toEqual([]);
  });
});
