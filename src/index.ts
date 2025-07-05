/**
 * ai-text-sanitizer – TypeScript source
 *
 * Normalises AI-generated text by stripping invisible characters, converting
 * fancy punctuation, folding exotic whitespace, dropping inline citations,
 * and tallying every change.
 */

/** Options accepted by sanitizeAiText. */
export interface SanitizeOptions {
  /** Preserve ZWJ / variation selectors used by emoji. */
  keepEmoji?: boolean;
  /** Collapse runs of ASCII spaces after other cleaning has run. */
  collapseSpaces?: boolean;
}

/** Per-rule change counters returned by sanitizeAiText. */
export interface SanitizeChanges {
  removedInvisible: number;
  removedCtrl: number;
  removedCitations: number;
  prettified: number;
  collapsedSpaces: number;
  total: number;
}

/** Result tuple returned by sanitizeAiText. */
export interface SanitizeResult {
  cleaned: string;
  changes: SanitizeChanges;
}

/** Engine support for Unicode property escapes (`/\p{}/u`). */
const supportsUnicodeProps: boolean = (() => {
  try {
    // eslint-disable-next-line regexp/no-legacy-features
    new RegExp('\\p{C}', 'u');
    return true;
  } catch {
    return false;
  }
})();

/** Availability of `String.prototype.normalize`. */
const hasNormalize = typeof ''.normalize === 'function';

/** Fallback range when Unicode property escapes are unavailable. */
// eslint-disable-next-line regexp/no-control-character
const LEGACY_INVISIBLES_RE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** ASCII control characters except TAB (0x09), LF (0x0A) and CR (0x0D). */
// eslint-disable-next-line no-control-regex
const ASCII_CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Runs of two or more literal spaces. */
const EXTRA_SPACE_RE = / {2,}/g;

/** Variety of space-like Unicode characters folded to ASCII space. */
const SPACE_LIKE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** Carriage-return (CR / CRLF) line endings. */
const CR_RE = /\r\n?|\u000D\n?/g;

/**
 * Citation placeholders emitted by some LLMs (optionally preceded by spaces).
 * Leading spaces are included so their removal doesn't leave stray gaps.
 */
const CITATION_RE = / *(\(oaicite:\d+\){index=\d+})/g;

/** "Pretty" punctuation replacements mapped to plain ASCII. */
const PRETTIES: { re: RegExp; repl: string }[] = [
  { re: /[\u2018\u2019\u201A]/g, repl: "'" },
  { re: /[\u201C\u201D\u201E]/g, repl: '"' },
  { re: /[\u2013\u2014]/g, repl: '-' },
  { re: /\u2026/g, repl: '...' },
  { re: /[\u2022\u25AA-\u25AB\u25B8-\u25B9\u25CF]/g, repl: '-' },
];

/**
 * Counts matches for a global regular expression.
 *
 * @param str Target string.
 * @param re  Global regular expression.
 */
function count(str: string, re: RegExp): number {
  const m = str.match(re);
  return m ? m.length : 0;
}

/**
 * Sanitises AI-generated text.
 */
export function sanitizeAiText(
  text: string,
  opts: SanitizeOptions = {}
): SanitizeResult {
  if (typeof text !== 'string') throw new TypeError('text must be a string');

  const { keepEmoji = true, collapseSpaces = true } = opts;

  if (!text) {
    return {
      cleaned: '',
      changes: {
        removedInvisible: 0,
        removedCtrl: 0,
        removedCitations: 0,
        prettified: 0,
        collapsedSpaces: 0,
        total: 0,
      },
    };
  }

  const hasBom = text[0] === '\uFEFF';
  if (hasBom) text = text.slice(1);

  /* Line-ending normalisation (CRLF/CR → LF). */
  const convertedEol = count(text, CR_RE);
  if (convertedEol) text = text.replace(CR_RE, '\n');

  /* Remove citation placeholders. */
  const removedCitations = count(text, CITATION_RE);
  if (removedCitations) text = text.replace(CITATION_RE, '');

  /* NFKC compatibility fold — count code points that differ post-normalise. */
  let nfkcChanged = 0;
  if (hasNormalize) {
    for (const ch of text) if (ch.normalize('NFKC') !== ch) nfkcChanged++;
    text = text.normalize('NFKC');
  }

  /* Strip invisibles / format chars (optionally keep emoji glue). */
  const invisiblesRe = /[\u00AD\u180E\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
  let removedInvisible = count(text, invisiblesRe);
  text = text.replace(invisiblesRe, '');

  if (!keepEmoji) {
    const emojiGlueRe = /[\u200D\uFE00-\uFE0F]/g;
    removedInvisible += count(text, emojiGlueRe);
    text = text.replace(emojiGlueRe, '');
  }

  /* ASCII control characters. */
  const removedCtrl = count(text, ASCII_CTRL_RE);
  if (removedCtrl) text = text.replace(ASCII_CTRL_RE, '');

  /* Fold exotic spaces to ASCII space. */
  const spaceLikeRepl = count(text, SPACE_LIKE_RE);
  if (spaceLikeRepl) text = text.replace(SPACE_LIKE_RE, ' ');

  /* Fancy punctuation → ASCII. */
  let prettified = spaceLikeRepl + nfkcChanged + convertedEol;
  for (const { re, repl } of PRETTIES) {
    prettified += count(text, re);
    if (prettified) text = text.replace(re, repl);
  }

  /* Collapse redundant spaces. */
  let collapsedSpaces = 0;
  if (collapseSpaces) {
    collapsedSpaces = count(text, EXTRA_SPACE_RE);
    if (collapsedSpaces) text = text.replace(EXTRA_SPACE_RE, ' ').trim();
  }

  if (hasBom) text = '\uFEFF' + text;

  const total =
    removedInvisible +
    removedCtrl +
    removedCitations +
    prettified +
    collapsedSpaces;

  return {
    cleaned: text,
    changes: {
      removedInvisible,
      removedCtrl,
      removedCitations,
      prettified,
      collapsedSpaces,
      total,
    },
  };
}

export default { sanitizeAiText }; 