import type { SynthIdConfig, WatermarkFinding } from './types.js';

function defaultTokenize(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

export function detectSynthIdScore(
  text: string,
  cfg?: SynthIdConfig
): WatermarkFinding | undefined {
  if (!cfg || typeof cfg.score !== 'function') {
    console.warn(
      '[ai-text-sanitizer] SynthID detector skipped: no scorer provided.'
    );
    return undefined;
  }

  const tokens = (cfg.tokenize ?? defaultTokenize)(text);
  if (!tokens.length) {
    return {
      kind: 'synthid',
      score: 0,
      note: 'No tokens available for SynthID scoring.',
    };
  }

  try {
    const score = cfg.score(tokens, cfg.key);
    return {
      kind: 'synthid',
      score,
      note:
        cfg.threshold !== undefined
          ? `score=${score.toFixed(4)} threshold=${cfg.threshold}`
          : `score=${score.toFixed(4)}`,
    };
  } catch (error) {
    console.warn(
      '[ai-text-sanitizer] SynthID scorer threw an error:',
      error
    );
    return undefined;
  }
}
