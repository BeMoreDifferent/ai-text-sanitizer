/**
 * Unicode code point tables used during sanitization.
 */

function codePointRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
}

/** Zero-width and format code points commonly used for watermarking. */
export const ZERO_WIDTH_POINTS = new Set<number>([
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
  0x2060, // WORD JOINER
  0x2061, // FUNCTION APPLICATION
  0x2062, // INVISIBLE TIMES
  0x2063, // INVISIBLE SEPARATOR
  0x2064, // INVISIBLE PLUS
  0x2065, // reserved default-ignorable format slot
  0x2066, // LEFT-TO-RIGHT ISOLATE
  0x2067, // RIGHT-TO-LEFT ISOLATE
  0x2068, // FIRST STRONG ISOLATE
  0x2069, // POP DIRECTIONAL ISOLATE
  0x206a, // INHIBIT SYMMETRIC SWAPPING
  0x206b, // ACTIVATE SYMMETRIC SWAPPING
  0x206c, // INHIBIT ARABIC FORM SHAPING
  0x206d, // ACTIVATE ARABIC FORM SHAPING
  0x206e, // NATIONAL DIGIT SHAPES
  0x206f, // NOMINAL DIGIT SHAPES
  0xfeff, // ZERO WIDTH NO-BREAK SPACE
]);

/** Variation selectors used as emoji modifiers. */
export const VARIATION_SELECTORS = new Set<number>(
  Array.from({ length: 16 }, (_, idx) => 0xfe00 + idx)
);

/** Supplementary variation selectors used by text watermark payloads. */
export const SUPPLEMENTARY_VARIATION_SELECTORS = new Set<number>(
  codePointRange(0xe0100, 0xe01ef)
);

/** All variation selectors. FE00-FE0F may be preserved inside emoji runs. */
export const ALL_VARIATION_SELECTORS = new Set<number>([
  ...VARIATION_SELECTORS,
  ...SUPPLEMENTARY_VARIATION_SELECTORS,
]);

/** Unicode tag characters often used as invisible payload bytes. */
export const TAG_POINTS = new Set<number>(codePointRange(0xe0000, 0xe007f));

/** Default-ignorable controls beyond tag and variation-selector payloads. */
export const DEFAULT_IGNORABLE_POINTS = new Set<number>([
  0x00ad, // SOFT HYPHEN
  0x034f, // COMBINING GRAPHEME JOINER
  0x061c, // ARABIC LETTER MARK
  0x3164, // HANGUL FILLER
  0xffa0, // HALFWIDTH HANGUL FILLER
  ...codePointRange(0x115f, 0x1160), // HANGUL CHOSEONG/JUNGSEONG FILLERS
  ...codePointRange(0x17b4, 0x17b5), // KHMER INHERENT VOWELS
  ...codePointRange(0x180b, 0x180f), // MONGOLIAN variation/vowel separators
  ...ZERO_WIDTH_POINTS,
  ...codePointRange(0xfff0, 0xfff8), // interlinear annotation controls
  ...codePointRange(0x1bca0, 0x1bca3), // shorthand format controls
  ...codePointRange(0x1d173, 0x1d17a), // musical format controls
]);

/** Exotic spaces folded to ASCII space by default. */
export const EXOTIC_SPACES = new Set<number>([
  0x00a0, // NO-BREAK SPACE
  0x1680, // OGHAM SPACE MARK
  0x2000, // EN QUAD
  0x2001, // EM QUAD
  0x2002, // EN SPACE
  0x2003, // EM SPACE
  0x2004, // THREE-PER-EM SPACE
  0x2005, // FOUR-PER-EM SPACE
  0x2006, // SIX-PER-EM SPACE
  0x2007, // FIGURE SPACE
  0x2008, // PUNCTUATION SPACE
  0x2009, // THIN SPACE
  0x200a, // HAIR SPACE
  0x202f, // NARROW NO-BREAK SPACE
  0x205f, // MEDIUM MATHEMATICAL SPACE
  0x3000, // IDEOGRAPHIC SPACE
]);

/** Base ASCII control characters (C0 + C1). */
const ASCII_CTRL_POINTS = (() => {
  const points = new Set<number>();
  for (let cp = 0x00; cp <= 0x1f; cp++) points.add(cp);
  for (let cp = 0x7f; cp <= 0x9f; cp++) points.add(cp);
  return points;
})();

/**
 * Returns a control-character set honouring tab/newline preservation flags.
 */
export function buildAsciiControlSet(opts: {
  keepTabs: boolean;
  keepNewlines: boolean;
}): Set<number> {
  const { keepTabs, keepNewlines } = opts;
  const next = new Set(ASCII_CTRL_POINTS);
  if (keepTabs) next.delete(0x09);
  if (keepNewlines) {
    next.delete(0x0a);
    next.delete(0x0d);
  }
  return next;
}

/** Emoji glue characters (ZWJ + variation selectors). */
export const EMOJI_GLUE_POINTS = new Set<number>([
  0x200d,
  ...VARIATION_SELECTORS,
]);

/** Convenience list of bidi-only markers. */
export const BIDI_POINTS = new Set<number>([
  0x061c,
  0x200e,
  0x200f,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2066,
  0x2067,
  0x2068,
  0x2069,
]);

/** Controls whether a code point counts as invisible (excluding emoji glue). */
export function isInvisible(cp: number): boolean {
  return (
    (ZERO_WIDTH_POINTS.has(cp) ||
      TAG_POINTS.has(cp) ||
      SUPPLEMENTARY_VARIATION_SELECTORS.has(cp) ||
      DEFAULT_IGNORABLE_POINTS.has(cp)) &&
    !EMOJI_GLUE_POINTS.has(cp) &&
    !BIDI_POINTS.has(cp)
  );
}

/** Returns true when a code point belongs to bidi-only range. */
export function isBidi(cp: number): boolean {
  return BIDI_POINTS.has(cp);
}

/** Returns true for Unicode tag payload characters. */
export function isTagCharacter(cp: number): boolean {
  return TAG_POINTS.has(cp);
}

/** Returns true for any Unicode variation selector. */
export function isVariationSelector(cp: number): boolean {
  return ALL_VARIATION_SELECTORS.has(cp);
}

/** Returns true for default-ignorable controls tracked by the sanitizer. */
export function isDefaultIgnorable(cp: number): boolean {
  return DEFAULT_IGNORABLE_POINTS.has(cp);
}
