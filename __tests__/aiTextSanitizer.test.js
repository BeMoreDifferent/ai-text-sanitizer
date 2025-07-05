import { sanitizeAiText } from '../dist/index.js';

describe('sanitizeAiText', () => {
  test('removes invisible characters and exotic spaces', () => {
    const input = '\u200BHello\u00A0world\u200B'; // ZWSP + NBSP + ZWSP
    const { cleaned, changes } = sanitizeAiText(input);

    expect(cleaned).toBe('Hello world');
    expect(changes.total).toBeGreaterThan(0);
  });

  test('removes citation placeholders', () => {
    const input = 'This is text (oaicite:5){index=5}.';
    const { cleaned } = sanitizeAiText(input);
    expect(cleaned).toBe('This is text.');
  });

  test('converts fancy punctuation to ASCII', () => {
    const input = '“Quotes” — and ellipsis…';
    const { cleaned } = sanitizeAiText(input);
    expect(cleaned).toBe('"Quotes" - and ellipsis...');
  });

  test('option keepEmoji false strips ZWJ and variation selectors', () => {
    const input = 'A\u200DBC'; // Contains ZWJ between letters
    const { cleaned: keep } = sanitizeAiText(input);
    const { cleaned: strip } = sanitizeAiText(input, { keepEmoji: false });

    expect(keep).toBe('A\u200DBC');
    expect(strip).toBe('ABC');
  });

  test('HTML snippet retains markup while cleaning text nodes', () => {
    const html = '<p>“Hello\u200B&nbsp;world…”</p>'; // fancy quotes + ZWSP + NBSP + ellipsis
    const { cleaned } = sanitizeAiText(html);
    expect(cleaned).toBe('<p>"Hello&nbsp;world..."</p>');
  });

  test('code snippet cleans exotic whitespace but keeps syntax chars', () => {
    const code = 'const foo = "bar";\u200B\u00A0// comment';
    const { cleaned } = sanitizeAiText(code);
    expect(cleaned).toBe('const foo = "bar"; // comment');
  });

  test('preserves complex emoji sequence by default', () => {
    const family = '👨‍👩‍👧‍👦'; // Family emoji uses ZWJ
    const { cleaned } = sanitizeAiText(family);
    expect(cleaned).toBe(family);
  });

  test('strips ZWJ from emoji when keepEmoji is false', () => {
    const family = '👨‍👩‍👧‍👦';
    // Remove ZWJ (U+200D) to get plain individual emojis joined without glyph fusion
    const expected = family.replace(/\u200D/g, '');
    const { cleaned } = sanitizeAiText(family, { keepEmoji: false });
    expect(cleaned).toBe(expected);
  });

  test('retains BOM round-trip', () => {
    const bomText = '\uFEFFHello';
    const { cleaned } = sanitizeAiText(bomText);
    expect(cleaned.charCodeAt(0)).toBe(0xFEFF);
    expect(cleaned.slice(1)).toBe('Hello');
  });
}); 