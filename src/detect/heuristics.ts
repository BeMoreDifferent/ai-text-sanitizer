import {
  EXOTIC_SPACES,
  isDefaultIgnorable,
  isTagCharacter,
  isVariationSelector,
  ZERO_WIDTH_POINTS,
} from '../tables/unicode.js';
import type { HeuristicConfig, WatermarkFinding } from './types.js';

function countMatches(text: string, predicate: (cp: number) => boolean): number {
  let count = 0;
  for (const ch of text) if (predicate(ch.codePointAt(0)!)) count++;
  return count;
}

function codePointsFor(
  text: string,
  predicate: (cp: number) => boolean
): string[] {
  const points = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (predicate(cp)) {
      points.add(`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }
  return Array.from(points);
}

function isDefaultIgnorablePayload(cp: number): boolean {
  return (
    isDefaultIgnorable(cp) &&
    !isTagCharacter(cp) &&
    !isVariationSelector(cp)
  );
}

export function heuristicFlags(
  raw: string,
  cfg?: HeuristicConfig
): WatermarkFinding[] {
  const zeroWidthThreshold = cfg?.zeroWidthThreshold ?? 0;
  const exoticSpaceThreshold = cfg?.exoticSpaceThreshold ?? 0;
  const tagThreshold = cfg?.tagThreshold ?? 0;
  const variationSelectorThreshold = cfg?.variationSelectorThreshold ?? 0;
  const defaultIgnorableThreshold = cfg?.defaultIgnorableThreshold ?? 0;

  const zeroWidthCount = countMatches(raw, (cp) => ZERO_WIDTH_POINTS.has(cp));
  const exoticSpaces = countMatches(raw, (cp) => EXOTIC_SPACES.has(cp));
  const tagCount = countMatches(raw, (cp) => isTagCharacter(cp));
  const variationSelectorCount = countMatches(raw, (cp) =>
    isVariationSelector(cp)
  );
  const defaultIgnorableCount = countMatches(raw, isDefaultIgnorablePayload);

  const findings: WatermarkFinding[] = [];
  if (zeroWidthCount > zeroWidthThreshold) {
    findings.push({
      kind: 'heuristic',
      category: 'zero-width',
      count: zeroWidthCount,
      codePoints: codePointsFor(raw, (cp) => ZERO_WIDTH_POINTS.has(cp)),
      note: `zero-width count=${zeroWidthCount}`,
    });
  }

  if (exoticSpaces > exoticSpaceThreshold) {
    findings.push({
      kind: 'heuristic',
      category: 'exotic-space',
      count: exoticSpaces,
      codePoints: codePointsFor(raw, (cp) => EXOTIC_SPACES.has(cp)),
      note: `exotic-space count=${exoticSpaces}`,
    });
  }

  if (tagCount > tagThreshold) {
    findings.push({
      kind: 'heuristic',
      category: 'unicode-tag',
      count: tagCount,
      codePoints: codePointsFor(raw, (cp) => isTagCharacter(cp)),
      note: `unicode-tag count=${tagCount}`,
    });
  }

  if (variationSelectorCount > variationSelectorThreshold) {
    findings.push({
      kind: 'heuristic',
      category: 'variation-selector',
      count: variationSelectorCount,
      codePoints: codePointsFor(raw, (cp) => isVariationSelector(cp)),
      note: `variation-selector count=${variationSelectorCount}`,
    });
  }

  if (defaultIgnorableCount > defaultIgnorableThreshold) {
    findings.push({
      kind: 'heuristic',
      category: 'default-ignorable',
      count: defaultIgnorableCount,
      codePoints: codePointsFor(raw, isDefaultIgnorablePayload),
      note: `default-ignorable count=${defaultIgnorableCount}`,
    });
  }

  return findings;
}
