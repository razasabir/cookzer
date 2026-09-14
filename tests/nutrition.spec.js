const { test, expect } = require('@playwright/test');

// Pure-logic test for nutrition-data.js — no browser page needed since
// the module only touches `window.CookzerNutrition`, which works fine
// under a fake `window` object in plain Node.
function loadEstimator() {
  delete require.cache[require.resolve('../nutrition-data.js')];
  const fakeWindow = {};
  global.window = fakeWindow;
  require('../nutrition-data.js');
  return fakeWindow.CookzerNutrition.estimateForRecipe;
}

function loadCostEstimator() {
  delete require.cache[require.resolve('../nutrition-data.js')];
  const fakeWindow = {};
  global.window = fakeWindow;
  require('../nutrition-data.js');
  return fakeWindow.CookzerNutrition.estimateCostForRecipe;
}

test.describe('nutrition estimate lookup table', () => {
  test('estimates plausible per-serving calories for a real recipe', () => {
    const estimateForRecipe = loadEstimator();
    const result = estimateForRecipe({
      servings: 4,
      ingredients: [
        { name: 'Chicken breast', qty: '600 g' },
        { name: 'Olive oil', qty: '2 tbsp' },
        { name: 'Garlic', qty: '3 cloves' },
        { name: 'Lemon', qty: '1' },
        { name: 'Salt', qty: 'to taste' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result.calories).toBeGreaterThan(100);
    expect(result.calories).toBeLessThan(600);
    expect(result.protein).toBeGreaterThan(10);
  });

  test('returns null when no ingredient matches the lookup table', () => {
    const estimateForRecipe = loadEstimator();
    const result = estimateForRecipe({ servings: 2, ingredients: [{ name: 'unobtainium dust', qty: '2 cups' }] });
    expect(result).toBeNull();
  });

  test('returns null for empty ingredients, null, or undefined recipes', () => {
    const estimateForRecipe = loadEstimator();
    expect(estimateForRecipe({ servings: 2, ingredients: [] })).toBeNull();
    expect(estimateForRecipe(null)).toBeNull();
    expect(estimateForRecipe(undefined)).toBeNull();
  });

  test('parses fraction quantities without throwing', () => {
    const estimateForRecipe = loadEstimator();
    const result = estimateForRecipe({
      servings: 1,
      ingredients: [
        { name: 'Flour', qty: '1 1/2 cups' },
        { name: 'Sugar', qty: '1/2 cup' },
        { name: 'Butter', qty: '¼ cup' },
        { name: 'Egg', qty: '2' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result.calories).toBeGreaterThan(500);
  });

  test('handles a missing servings count and a blank quantity gracefully', () => {
    const estimateForRecipe = loadEstimator();
    const noServings = estimateForRecipe({ ingredients: [{ name: 'Rice', qty: '1 cup' }] });
    expect(noServings).not.toBeNull();
    expect(noServings.calories).toBeGreaterThan(0);

    const blankQty = estimateForRecipe({
      servings: 2,
      ingredients: [{ name: 'Black pepper', qty: '' }, { name: 'Rice', qty: '2 cups' }],
    });
    expect(blankQty).not.toBeNull();
    expect(blankQty.calories).toBeGreaterThan(0);
  });
});

test.describe('cost-per-serve estimate lookup table', () => {
  test('estimates a plausible per-serving cost for a real recipe', () => {
    const estimateCostForRecipe = loadCostEstimator();
    const result = estimateCostForRecipe({
      servings: 4,
      ingredients: [
        { name: 'Chicken breast', qty: '600 g' },
        { name: 'Olive oil', qty: '2 tbsp' },
        { name: 'Garlic', qty: '3 cloves' },
        { name: 'Lemon', qty: '1' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(10);
  });

  test('returns null when nothing matches, and scales down as servings go up', () => {
    const estimateCostForRecipe = loadCostEstimator();
    expect(estimateCostForRecipe({ servings: 2, ingredients: [{ name: 'unobtainium dust', qty: '2 cups' }] })).toBeNull();
    expect(estimateCostForRecipe(null)).toBeNull();

    const recipe = { ingredients: [{ name: 'Rice', qty: '400 g' }] };
    const perServing1 = estimateCostForRecipe({ ...recipe, servings: 1 });
    const perServing4 = estimateCostForRecipe({ ...recipe, servings: 4 });
    expect(perServing1).toBeCloseTo(perServing4 * 4, 2);
  });
});
