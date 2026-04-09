import { EXOTIC_SPACES } from '../tables/unicode.js';

/** Carriage-return (CR / CRLF) line endings. */
const CR_RE = /\r\n?|\u000d\n?/g;

/**
 * Citation placeholders emitted by some LLMs (optionally preceded by spaces).
 * Leading spaces are included so their removal doesn't leave stray gaps.
 */
const CITATION_RE = / *(\(oaicite:\d+\){index=\d+})/g;

/** "Pretty" punctuation replacements mapped to plain ASCII. */
const PRETTIES: { re: RegExp; repl: string }[] = [
  { re: /[\u2018\u2019\u201a]/g, repl: "'" },
  { re: /[\u201c\u201d\u201e]/g, repl: '"' },
  { re: /[\u2013\u2014]/g, repl: '-' },
  { re: /\u2026/g, repl: '...' },
  { re: /[\u2022\u25aa-\u25ab\u25b8-\u25b9\u25cf]/g, repl: '-' },
];

/** Runs of two or more literal spaces. */
const EXTRA_SPACE_RE = / {2,}/g;

/** Availability of `String.prototype.normalize`. */
const hasNormalize = typeof ''.normalize === 'function';

export interface NormalizeLineEndingResult {
  text: string;
  converted: number;
}

export interface StripCitationsResult {
  text: string;
  removed: number;
}

export interface NormalizeFormResult {
  text: string;
  changed: number;
}

export interface FoldSpacesResult {
  text: string;
  folded: number;
}

export interface CollapseSpacesResult {
  text: string;
  collapsed: number;
}

export interface PrettyResult {
  text: string;
  prettified: number;
}

export function normalizeLineEndings(text: string): NormalizeLineEndingResult {
  const converted = text.match(CR_RE)?.length ?? 0;
  return converted ? { text: text.replace(CR_RE, '\n'), converted } : { text, converted: 0 };
}

export function stripCitations(text: string): StripCitationsResult {
  const removed = text.match(CITATION_RE)?.length ?? 0;
  return removed ? { text: text.replace(CITATION_RE, ''), removed } : { text, removed: 0 };
}

export function normalizeForm(
  text: string,
  nfkc: boolean
): NormalizeFormResult {
  if (!hasNormalize) return { text, changed: 0 };

  const form = nfkc ? 'NFKC' : 'NFC';
  let changed = 0;
  for (const ch of text) if (ch.normalize(form) !== ch) changed++;
  return { text: text.normalize(form), changed };
}

export function foldExoticSpaces(text: string): FoldSpacesResult {
  let folded = 0;
  const result = Array.from(text)
    .map((char) => {
      const cp = char.codePointAt(0)!;
      if (EXOTIC_SPACES.has(cp)) {
        folded++;
        return ' ';
      }
      return char;
    })
    .join('');
  return { text: folded ? result : text, folded };
}

export function collapseAsciiSpaces(text: string): CollapseSpacesResult {
  if (!text) return { text, collapsed: 0 };
  const collapsed = text.match(EXTRA_SPACE_RE)?.length ?? 0;
  if (!collapsed) return { text: text.trim(), collapsed: 0 };
  return { text: text.replace(EXTRA_SPACE_RE, ' ').trim(), collapsed };
}

export function replacePrettyPunctuation(text: string): PrettyResult {
  let prettified = 0;
  let next = text;
  for (const { re, repl } of PRETTIES) {
    const matches = next.match(re)?.length ?? 0;
    if (matches) {
      prettified += matches;
      next = next.replace(re, repl);
    }
  }
  return { text: next, prettified };
}

export function stripBom(text: string): { text: string; hadBom: boolean } {
  if (!text || text[0] !== '\ufeff') return { text, hadBom: false };
  return { text: text.slice(1), hadBom: true };
}
