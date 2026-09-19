const { test, expect } = require('@playwright/test');

// Pure-logic tests for recipe-tag-suggest.js — no browser page needed,
// the module only touches window.CookzerTagSuggest. Same pattern as
// tests/unit-convert.spec.js.
function loadSuggester() {
  delete require.cache[require.resolve('../recipe-tag-suggest.js')];
  const fakeWindow = {};
  global.window = fakeWindow;
  require('../recipe-tag-suggest.js');
  return fakeWindow.CookzerTagSuggest;
}

test.describe('recipe tag suggestions — speed', () => {
  test('suggests "quick" for a fast total time, and "weeknight" more broadly', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ prepMinutes: 10, cookMinutes: 5 })).toEqual(expect.arrayContaining(['quick', 'weeknight']));
    expect(suggest({ prepMinutes: 10, cookMinutes: 25 })).toEqual(expect.arrayContaining(['weeknight']));
    expect(suggest({ prepMinutes: 10, cookMinutes: 25 })).not.toContain('quick');
  });

  test('suggests neither for a long total time, and neither with no time entered', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ prepMinutes: 30, cookMinutes: 90 })).not.toEqual(expect.arrayContaining(['quick', 'weeknight']));
    expect(suggest({})).toEqual([]);
  });
});

test.describe('recipe tag suggestions — spice, category, dietary', () => {
  test('suggests "spicy" only for Hot/Extra hot', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ spiceLevel: 'Hot' })).toContain('spicy');
    expect(suggest({ spiceLevel: 'Extra hot' })).toContain('spicy');
    expect(suggest({ spiceLevel: 'Mild' })).not.toContain('spicy');
    expect(suggest({ spiceLevel: '' })).not.toContain('spicy');
  });

  test('maps category to its lowercase tag', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ category: 'BBQ' })).toContain('bbq');
    expect(suggest({ category: 'Dessert' })).toContain('dessert');
    expect(suggest({ category: 'Not a real category' })).toEqual([]);
  });

  test('bridges selected dietary tags into lowercase free-text tags', () => {
    const { suggest } = loadSuggester();
    const result = suggest({ dietaryTags: ['Vegan', 'Gluten-free'] });
    expect(result).toEqual(expect.arrayContaining(['vegan', 'gluten-free']));
  });
});

test.describe('recipe tag suggestions — ingredient count and keywords', () => {
  test('suggests "easy" for 5 or fewer ingredients, not for more', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ ingredientNames: ['salt', 'pepper', 'chicken'] })).toContain('easy');
    expect(suggest({ ingredientNames: ['a', 'b', 'c', 'd', 'e', 'f'] })).not.toContain('easy');
    expect(suggest({ ingredientNames: [] })).not.toContain('easy');
  });

  test('matches protein and dish keywords from ingredients and title', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ title: 'Grilled Chicken Tacos', ingredientNames: ['2 chicken breasts', 'tortillas'] }))
      .toEqual(expect.arrayContaining(['chicken', 'grilled']));
    expect(suggest({ ingredientNames: ['shrimp', 'rice noodles'] })).toEqual(expect.arrayContaining(['shrimp']));
  });

  test('matches cooking-method keywords from step text', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ stepTexts: ['Preheat the slow cooker and add everything.'] })).toContain('slow-cooker');
    expect(suggest({ stepTexts: ['Roast in the oven for 40 minutes.'] })).toContain('roasted');
    expect(suggest({ description: 'A one-pot weeknight dinner the kids will love.' }))
      .toEqual(expect.arrayContaining(['one-pot', 'kid-friendly']));
  });

  test('is case-insensitive and matches whole words only', () => {
    const { suggest } = loadSuggester();
    expect(suggest({ title: 'CHICKEN Soup' })).toEqual(expect.arrayContaining(['chicken', 'soup']));
    // "chickens" the bird-farming supply, not the dish — shouldn't false-positive on a substring.
    expect(suggest({ title: 'Backyard Chickens 101' })).not.toContain('chicken');
  });

  test('returns no duplicate tags even when several rules point to the same tag', () => {
    const { suggest } = loadSuggester();
    const result = suggest({ dietaryTags: ['vegan'], title: 'A vegan curry', category: 'Dinner' });
    expect(result.filter((t) => t === 'vegan')).toHaveLength(1);
  });
});
