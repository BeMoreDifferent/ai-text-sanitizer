import type {
  SoftWatermarkConfig,
  WatermarkFinding,
} from './types.js';

function erfc(x: number): number {
  // Abramowitz-Stegun approximation
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t *
                                      (-0.82215223 +
                                        t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

function tokensFromConfig(
  text: string,
  cfg: SoftWatermarkConfig
): number[] | undefined {
  if (cfg.tokens && cfg.tokens.length) return cfg.tokens;
  if (cfg.tokenizer) return cfg.tokenizer(text);
  return undefined;
}

export function softWatermarkPValue(
  tokens: number[],
  greenlist: (tokenId: number, position: number) => boolean,
  expectedProbability = 0.5
): number {
  if (!tokens.length) return 1;
  const hits = tokens.reduce(
    (acc, tok, idx) => acc + (greenlist(tok, idx) ? 1 : 0),
    0
  );
  const total = tokens.length;
  const p = Math.min(Math.max(expectedProbability, 1e-6), 1 - 1e-6);
  const mean = total * p;
  const variance = total * p * (1 - p);
  if (!variance) return hits === mean ? 1 : 0;
  const z = (hits - mean) / Math.sqrt(variance);
  const pValue = 0.5 * erfc(z / Math.SQRT2);
  return Math.min(Math.max(pValue, 0), 1);
}

export function runSoftWatermarkDetector(
  text: string,
  cfg?: SoftWatermarkConfig
): WatermarkFinding | undefined {
  if (!cfg) {
    console.warn(
      '[ai-text-sanitizer] Soft watermark detector skipped: no config provided.'
    );
    return undefined;
  }
  if (typeof cfg.greenlist !== 'function') {
    console.warn(
      '[ai-text-sanitizer] Soft watermark detector skipped: greenlistFn missing.'
    );
    return undefined;
  }
  const tokens = tokensFromConfig(text, cfg);
  if (!tokens || !tokens.length) {
    console.warn(
      '[ai-text-sanitizer] Soft watermark detector skipped: tokenizer returned no tokens.'
    );
    return undefined;
  }

  const pValue = softWatermarkPValue(
    tokens,
    cfg.greenlist,
    cfg.expectedGreenProbability ?? 0.5
  );

  return {
    kind: 'soft-watermark',
    pValue,
    note: `tokens=${tokens.length} pValue=${pValue.toExponential(2)}`,
  };
}
