import { sanitizeAiText } from '../aiTextSanitizer.js';

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
}); 