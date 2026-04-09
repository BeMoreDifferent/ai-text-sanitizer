import type {
  DetectorConfigs,
  DetectorKind,
  WatermarkFinding,
} from './types.js';
import { detectSynthIdScore } from './synthid.js';
import { runSoftWatermarkDetector } from './softWatermark.js';
import { heuristicFlags } from './heuristics.js';

export function runDetectors(
  detectors: DetectorKind[],
  raw: string,
  cleaned: string,
  configs?: DetectorConfigs
): WatermarkFinding[] {
  if (!detectors?.length) return [];
  const findings: WatermarkFinding[] = [];

  for (const detector of detectors) {
    if (detector === 'synthid') {
      const result = detectSynthIdScore(raw, configs?.synthid);
      if (result) findings.push(result);
      continue;
    }

    if (detector === 'soft-watermark') {
      const result = runSoftWatermarkDetector(raw, configs?.softWatermark);
      if (result) findings.push(result);
      continue;
    }

    if (detector === 'heuristic') {
      const entries = heuristicFlags(raw, configs?.heuristic);
      findings.push(...entries);
    }
  }

  return findings;
}
