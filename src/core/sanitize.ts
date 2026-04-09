import {
  buildAsciiControlSet,
  BIDI_POINTS,
  EMOJI_GLUE_POINTS,
  EXOTIC_SPACES,
  isDefaultIgnorable,
  isInvisible,
  isTagCharacter,
  isVariationSelector,
} from '../tables/unicode.js';
import {
  collapseAsciiSpaces,
  foldExoticSpaces,
  normalizeForm,
  normalizeLineEndings,
  replacePrettyPunctuation,
  stripBom,
  stripCitations,
} from './normalize.js';
import { runDetectors } from '../detect/index.js';
import type {
  DetectorConfigs,
  DetectorKind,
  WatermarkFinding,
} from '../detect/types.js';
import { rewriteText, RewriteStrategy } from '../rewrite/rewrite.js';

const supportsUnicodeProps = (() => {
  try {
    // eslint-disable-next-line regexp/no-legacy-features
    new RegExp('\\p{Emoji}', 'u');
    return true;
  } catch {
    return false;
  }
})();

const EMOJI_RE = supportsUnicodeProps
  ? // eslint-disable-next-line regexp/no-legacy-features
    new RegExp('\\p{Emoji}', 'u')
  : /[\u2190-\u2bff\u2600-\u27bf\u1f1e6-\u1f1ff\u1f300-\u1f6ff\u1f900-\u1f9ff\u1fa70-\u1faff]/u;

export type DetectorOption = DetectorKind;

export interface SanitizeOptions {
  keepEmoji?: boolean;
  collapseSpaces?: boolean;
  keepBidi?: boolean;
  keepTabs?: boolean;
  keepNewlines?: boolean;
  nfkc?: boolean;
  detectors?: DetectorOption[];
  detectorConfigs?: DetectorConfigs;
  rewriteStrategy?: RewriteStrategy;
}

export interface SanitizeChanges {
  removedInvisible: number;
  removedTags: number;
  removedVariationSelectors: number;
  removedDefaultIgnorables: number;
  removedCtrl: number;
  removedBidi: number;
  removedCitations: number;
  prettified: number;
  collapsedSpaces: number;
  rewrittenSegments: number;
  total: number;
  rawInvisibleCount: number;
  rawTagCount: number;
  rawVariationSelectorCount: number;
  rawDefaultIgnorableCount: number;
  rawBidiCount: number;
  rawExoticSpaceCount: number;
  flags?: string[];
}

export interface SanitizeResult {
  cleaned: string;
  changes: SanitizeChanges;
  findings?: WatermarkFinding[];
}

export interface SanitizeInvisibleOptions {
  keepEmoji: boolean;
  keepTabs: boolean;
  keepNewlines: boolean;
  keepBidi: boolean;
}

interface SanitizeInvisibleResult {
  text: string;
  removedInvisible: number;
  removedTags: number;
  removedVariationSelectors: number;
  removedDefaultIgnorables: number;
  removedCtrl: number;
  removedBidi: number;
  rawInvisibleCount: number;
  rawTagCount: number;
  rawVariationSelectorCount: number;
  rawDefaultIgnorableCount: number;
  rawBidiCount: number;
}

interface RawStats {
  rawExoticSpaceCount: number;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    SanitizeOptions,
    | 'keepEmoji'
    | 'collapseSpaces'
    | 'keepBidi'
    | 'keepTabs'
    | 'keepNewlines'
    | 'nfkc'
    | 'rewriteStrategy'
  >
> = {
  keepEmoji: true,
  collapseSpaces: true,
  keepBidi: false,
  keepTabs: true,
  keepNewlines: true,
  nfkc: false,
  rewriteStrategy: 'none',
};

function collectRawStats(text: string): RawStats {
  let rawExoticSpaceCount = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (EXOTIC_SPACES.has(cp)) rawExoticSpaceCount++;
  }
  return { rawExoticSpaceCount };
}

function isEmojiCandidate(char: string): boolean {
  return EMOJI_RE.test(char);
}

function shouldPreserveEmojiGlue(
  codePoint: number,
  glyphs: string[],
  index: number
): boolean {
  if (!EMOJI_GLUE_POINTS.has(codePoint)) return false;
  const prev = glyphs[index - 1];
  const next = glyphs[index + 1];
  return Boolean(
    (prev && isEmojiCandidate(prev)) || (next && isEmojiCandidate(next))
  );
}

export function sanitizeInvisible(
  text: string,
  opts: SanitizeInvisibleOptions
): SanitizeInvisibleResult {
  const asciiCtrl = buildAsciiControlSet({
    keepTabs: opts.keepTabs,
    keepNewlines: opts.keepNewlines,
  });

  const glyphs = Array.from(text);
  const kept: string[] = [];
  let removedInvisible = 0;
  let removedTags = 0;
  let removedVariationSelectors = 0;
  let removedDefaultIgnorables = 0;
  let removedCtrl = 0;
  let removedBidi = 0;
  let rawInvisibleCount = 0;
  let rawTagCount = 0;
  let rawVariationSelectorCount = 0;
  let rawDefaultIgnorableCount = 0;
  let rawBidiCount = 0;

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const cp = glyph.codePointAt(0)!;
    const tag = isTagCharacter(cp);
    const variationSelector = isVariationSelector(cp);
    const defaultIgnorable = isDefaultIgnorable(cp);
    const defaultIgnorablePayload =
      defaultIgnorable && !tag && !variationSelector;
    const bidi = BIDI_POINTS.has(cp);

    if (tag) rawTagCount++;
    if (variationSelector) rawVariationSelectorCount++;
    if (defaultIgnorablePayload) rawDefaultIgnorableCount++;

    if (bidi) {
      rawBidiCount++;
      if (!opts.keepBidi) {
        removedBidi++;
        if (defaultIgnorablePayload) removedDefaultIgnorables++;
        continue;
      }
    }

    if (asciiCtrl.has(cp)) {
      removedCtrl++;
      continue;
    }

    if (EMOJI_GLUE_POINTS.has(cp)) {
      rawInvisibleCount++;
      if (opts.keepEmoji && shouldPreserveEmojiGlue(cp, glyphs, i)) {
        kept.push(glyph);
      } else {
        removedInvisible++;
        if (variationSelector) removedVariationSelectors++;
        if (defaultIgnorablePayload) removedDefaultIgnorables++;
      }
      continue;
    }

    if (isInvisible(cp)) {
      rawInvisibleCount++;
      removedInvisible++;
      if (tag) removedTags++;
      if (variationSelector) removedVariationSelectors++;
      if (defaultIgnorablePayload) removedDefaultIgnorables++;
      continue;
    }

    kept.push(glyph);
  }

  return {
    text: kept.join(''),
    removedInvisible,
    removedTags,
    removedVariationSelectors,
    removedDefaultIgnorables,
    removedCtrl,
    removedBidi,
    rawInvisibleCount,
    rawTagCount,
    rawVariationSelectorCount,
    rawDefaultIgnorableCount,
    rawBidiCount,
  };
}

export function sanitizeAiText(
  text: string,
  options: SanitizeOptions = {}
): SanitizeResult {
  if (typeof text !== 'string') throw new TypeError('text must be a string');

  if (!text) {
    return {
      cleaned: '',
      changes: {
        removedInvisible: 0,
        removedCtrl: 0,
        removedBidi: 0,
        removedCitations: 0,
        prettified: 0,
        collapsedSpaces: 0,
        rewrittenSegments: 0,
        total: 0,
        rawInvisibleCount: 0,
        rawTagCount: 0,
        rawVariationSelectorCount: 0,
        rawDefaultIgnorableCount: 0,
        rawBidiCount: 0,
        rawExoticSpaceCount: 0,
        removedTags: 0,
        removedVariationSelectors: 0,
        removedDefaultIgnorables: 0,
      },
    };
  }

  const opts: Required<typeof DEFAULT_OPTIONS> & SanitizeOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const rawStats = collectRawStats(text);
  const { text: bomFree, hadBom } = stripBom(text);
  const normalizedEol = normalizeLineEndings(bomFree);
  let working = normalizedEol.text;

  const citationResult = stripCitations(working);
  working = citationResult.text;

  const invisibleResult = sanitizeInvisible(working, {
    keepEmoji: opts.keepEmoji,
    keepTabs: opts.keepTabs,
    keepNewlines: opts.keepNewlines,
    keepBidi: opts.keepBidi,
  });
  working = invisibleResult.text;

  const normalization = normalizeForm(working, Boolean(opts.nfkc));
  working = normalization.text;

  const foldedSpaces = foldExoticSpaces(working);
  working = foldedSpaces.text;

  const pretties = replacePrettyPunctuation(working);
  working = pretties.text;

  let collapsedSpaces = 0;
  if (opts.collapseSpaces) {
    const collapsed = collapseAsciiSpaces(working);
    collapsedSpaces = collapsed.collapsed;
    working = collapsed.text;
  } else {
    working = working.trimEnd();
  }

  if (hadBom) working = '\ufeff' + working;

  let rewriteApplied = 0;
  if (opts.rewriteStrategy && opts.rewriteStrategy !== 'none') {
    const rewrite = rewriteText(working, opts.rewriteStrategy);
    rewriteApplied = rewrite.rewrites;
    working = rewrite.text;
  }

  const findings = runDetectors(
    opts.detectors ?? [],
    text,
    working,
    opts.detectorConfigs
  );

  const heuristicNotes = findings
    ?.filter((f) => f.kind === 'heuristic')
    .map((f) => f.note ?? f.kind);
  const flags =
    heuristicNotes && heuristicNotes.length ? heuristicNotes : undefined;

  const prettifiedTotal =
    pretties.prettified +
    normalization.changed +
    foldedSpaces.folded +
    normalizedEol.converted;

  const grandTotal =
    invisibleResult.removedInvisible +
    invisibleResult.removedCtrl +
    invisibleResult.removedBidi +
    citationResult.removed +
    prettifiedTotal +
    collapsedSpaces +
    rewriteApplied;

  return {
    cleaned: working,
    changes: {
      removedInvisible: invisibleResult.removedInvisible,
      removedTags: invisibleResult.removedTags,
      removedVariationSelectors: invisibleResult.removedVariationSelectors,
      removedDefaultIgnorables: invisibleResult.removedDefaultIgnorables,
      removedCtrl: invisibleResult.removedCtrl,
      removedBidi: invisibleResult.removedBidi,
      removedCitations: citationResult.removed,
      prettified: prettifiedTotal,
      collapsedSpaces,
      rewrittenSegments: rewriteApplied,
      total: grandTotal,
      rawInvisibleCount: invisibleResult.rawInvisibleCount,
      rawTagCount: invisibleResult.rawTagCount,
      rawVariationSelectorCount: invisibleResult.rawVariationSelectorCount,
      rawDefaultIgnorableCount: invisibleResult.rawDefaultIgnorableCount,
      rawBidiCount: invisibleResult.rawBidiCount,
      rawExoticSpaceCount: rawStats.rawExoticSpaceCount,
      flags,
    },
    findings: findings?.length ? findings : undefined,
  };
}
