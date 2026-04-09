import { sanitizeAiText } from './core/sanitize.js';

export {
  sanitizeInvisible,
  type SanitizeOptions,
  type SanitizeResult,
  type SanitizeChanges,
} from './core/sanitize.js';

export { sanitizeAiText } from './core/sanitize.js';

export { unifiedDiff } from './core/diff.js';

export {
  detectSynthIdScore,
} from './detect/synthid.js';
export {
  softWatermarkPValue,
} from './detect/softWatermark.js';
export { heuristicFlags } from './detect/heuristics.js';
export {
  type DetectorConfigs,
  type DetectorKind,
  type WatermarkFinding,
  type SynthIdConfig,
  type SoftWatermarkConfig,
  type HeuristicConfig,
} from './detect/types.js';

export { rewriteText, RewriteStrategy } from './rewrite/rewrite.js';

export default { sanitizeAiText };
