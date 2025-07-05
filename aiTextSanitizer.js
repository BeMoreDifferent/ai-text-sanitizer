/**
 * aiTextSanitizer.js
 *
 * ES-module utility to normalise AI-generated text by stripping invisible
 * characters, converting fancy punctuation, folding exotic whitespace,
 * removing in-line citation placeholders such as
 * `:contentReference[oaicite:12]{index=12}`, and keeping granular tallies of
 * every change.
 *
 * @module aiTextSanitizer
 */

'use strict';

/** Engine support for Unicode property escapes (`/\p{}/u`). */
const supportsUnicodeProps = (() => {
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
const LEGACY_INVISIBLES_RE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** ASCII control characters except TAB (0x09), LF (0x0A) and CR (0x0D). */
const ASCII_CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Runs of two or more literal spaces. */
const EXTRA_SPACE_RE = / {2,}/g;

/** Variety of space-like Unicode characters folded to ASCII space. */
const SPACE_LIKE_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/** Carriage-return (CR / CRLF) line endings. */
const CR_RE = /\r\n?|\u000D\n?/g;

/** Citation placeholders emitted by some LLMs. */
const CITATION_RE = /\(oaicite:\d+\){index=\d+}/g;

/** "Pretty" punctuation replacements mapped to plain ASCII. */
const PRETTIES = [
  { re: /[\u2018\u2019\u201A]/g, repl: "'" },
  { re: /[\u201C\u201D\u201E]/g, repl: '"' },
  { re: /[\u2013\u2014]/g, repl: '-' },
  { re: /\u2026/g, repl: '...' },
  { re: /[\u2022\u25AA-\u25AB\u25B8-\u25B9\u25CF]/g, repl: '-' }
];

/**
 * Counts matches for a global regular expression.
 *
 * @param {string} str Target string.
 * @param {RegExp} re  Global regular expression.
 * @returns {number}   Number of matches.
 */
function count(str, re) {
  const m = str.match(re);
  return m ? m.length : 0;
}

/**
 * Sanitises AI-generated text.
 *
 * @param {string}  text                       Input string.
 * @param {object} [opts]                      Options.
 * @param {boolean} [opts.keepEmoji=true]      Preserve ZWJ / variation selectors.
 * @param {boolean} [opts.collapseSpaces=true] Collapse contiguous spaces.
 * @returns {{
 *   cleaned: string,
 *   changes: {
 *     removedInvisible: number,
 *     removedCtrl: number,
 *     removedCitations: number,
 *     prettified: number,
 *     collapsedSpaces: number,
 *     total: number
 *   }
 * }} Object with cleaned text and change metrics.
 * @throws {TypeError} If `text` is not a string.
 */
export function sanitizeAiText(text, opts = {}) {
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
        total: 0
      }
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
  // Node.js RegExp engine does not support "&&" intersection. Use an explicit
  // set that excludes ZWJ (U+200D) and variation selectors by default.
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
  text = text.replace(ASCII_CTRL_RE, '');

  /* Fold exotic spaces to ASCII space. */
  const spaceLikeRepl = count(text, SPACE_LIKE_RE);
  text = text.replace(SPACE_LIKE_RE, ' ');

  /* Fancy punctuation → ASCII. */
  let prettified = spaceLikeRepl + nfkcChanged + convertedEol;
  for (const { re, repl } of PRETTIES) {
    prettified += count(text, re);
    text = text.replace(re, repl);
  }

  /* Collapse redundant spaces. */
  let collapsedSpaces = 0;
  if (collapseSpaces) {
    collapsedSpaces = count(text, EXTRA_SPACE_RE);
    text = text.replace(EXTRA_SPACE_RE, ' ').trim();
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
      total
    }
  };
}

export default { sanitizeAiText }; 