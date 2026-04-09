export type DetectorKind = 'synthid' | 'soft-watermark' | 'heuristic';

export interface WatermarkFinding {
  kind: DetectorKind;
  score?: number;
  pValue?: number;
  category?: string;
  count?: number;
  codePoints?: string[];
  note?: string;
}

export interface SynthIdConfig {
  /**
   * Watermark key or identifier passed through to the caller-supplied scorer.
   */
  key?: string;
  /**
   * Optional tokenizer. Defaults to whitespace tokenisation.
   */
  tokenize?: (text: string) => string[];
  /**
   * Deterministic scoring function backed by the caller's SynthID detector.
   */
  score: (tokens: string[], key?: string) => number;
  /**
   * Optional threshold for CLI strict mode.
   */
  threshold?: number;
}

export interface SoftWatermarkConfig {
  /**
   * Pre-tokenised content. If omitted, `tokenizer` must be provided.
   */
  tokens?: number[];
  /**
    * Deterministic tokenizer converting the text to vocab IDs.
    */
  tokenizer?: (text: string) => number[];
  /**
   * Greenlist predicate as defined in Kirchenbauer et al.
   */
  greenlist: (tokenId: number, position: number) => boolean;
  /**
   * Expected probability of green tokens (defaults to 0.5).
   */
  expectedGreenProbability?: number;
}

export interface HeuristicConfig {
  /**
   * Count threshold for zero-width marks before flagging.
   */
  zeroWidthThreshold?: number;
  /**
   * Count threshold for exotic spaces before flagging.
   */
  exoticSpaceThreshold?: number;
  /**
   * Count threshold for Unicode tag payload characters before flagging.
   */
  tagThreshold?: number;
  /**
   * Count threshold for variation selectors before flagging.
   */
  variationSelectorThreshold?: number;
  /**
   * Count threshold for other default-ignorable controls before flagging.
   */
  defaultIgnorableThreshold?: number;
}

export interface DetectorConfigs {
  synthid?: SynthIdConfig;
  softWatermark?: SoftWatermarkConfig;
  heuristic?: HeuristicConfig;
}
