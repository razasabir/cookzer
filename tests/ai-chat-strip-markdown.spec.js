const { test, expect } = require('@playwright/test');

// Pure-logic test for api/ai-chat.js's stripMarkdown() — no browser page
// needed. Belt-and-braces cleanup for when Haiku ignores the NO_MARKDOWN
// system-prompt instruction and still sends **bold**/# headings into a
// plain-text chat bubble (observed in live testing right after shipping).
function loadStripMarkdown() {
  delete require.cache[require.resolve('../api/ai-chat.js')];
  return require('../api/ai-chat.js').stripMarkdown;
}

test.describe('ai-chat stripMarkdown', () => {
  test('removes **bold** markers, keeping the text', () => {
    const stripMarkdown = loadStripMarkdown();
    expect(stripMarkdown('Try **Chicken & Spinach Rice Bowl** tonight.')).toBe('Try Chicken & Spinach Rice Bowl tonight.');
  });

  test('removes single *italic* markers without eating a real asterisk from a bold pass', () => {
    const stripMarkdown = loadStripMarkdown();
    expect(stripMarkdown('This is *quick* to make.')).toBe('This is quick to make.');
  });

  test('strips leading # headings', () => {
    const stripMarkdown = loadStripMarkdown();
    expect(stripMarkdown('# Dinner ideas\nTry fried rice.')).toBe('Dinner ideas\nTry fried rice.');
  });

  test('strips leading bullet markers, line by line', () => {
    const stripMarkdown = loadStripMarkdown();
    expect(stripMarkdown('- Chicken fried rice\n* Spinach frittata')).toBe('Chicken fried rice\nSpinach frittata');
  });

  test('a numbered list (the format the system prompt actually asks for) passes through untouched', () => {
    const stripMarkdown = loadStripMarkdown();
    const text = '1. Chicken fried rice\n2. Spinach frittata';
    expect(stripMarkdown(text)).toBe(text);
  });

  test('plain text with no markdown is unchanged', () => {
    const stripMarkdown = loadStripMarkdown();
    expect(stripMarkdown('Sounds like a great combo for dinner.')).toBe('Sounds like a great combo for dinner.');
  });
});
