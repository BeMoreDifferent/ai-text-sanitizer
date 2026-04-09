import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { sanitizeAiText, type SanitizeOptions } from './core/sanitize.js';
import { unifiedDiff } from './core/diff.js';
import type { DetectorOption } from './core/sanitize.js';
import type { RewriteStrategy } from './rewrite/rewrite.js';

interface CliOptions {
  input?: string;
  output?: string;
  report?: string;
  strict?: boolean;
  rewrite?: RewriteStrategy;
  detectors?: DetectorOption[];
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--in' || token === '--input') {
      opts.input = argv[++i];
      continue;
    }
    if (token === '--out' || token === '--output') {
      opts.output = argv[++i];
      continue;
    }
    if (token === '--report') {
      opts.report = argv[++i];
      continue;
    }
    if (token === '--strict') {
      opts.strict = true;
      continue;
    }
    if (token === '--rewrite') {
      const value = argv[++i] as RewriteStrategy;
      opts.rewrite = value;
      continue;
    }
    if (token === '--detectors') {
      opts.detectors = argv[++i]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean) as DetectorOption[];
      continue;
    }
  }
  return opts;
}

function writeReport(
  reportPath: string,
  payload: Record<string, unknown>
): void {
  const resolved = resolve(process.cwd(), reportPath);
  writeFileSync(resolved, JSON.stringify(payload, null, 2), 'utf8');
}

function ensureInput(path?: string): string {
  if (!path) {
    console.error('Usage: ai-text-sanitizer --in <file>');
    process.exit(1);
  }
  return path;
}

export async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputFile = ensureInput(args.input);
  const raw = readFileSync(resolve(process.cwd(), inputFile), 'utf8');

  const sanitizeOptions: SanitizeOptions = {
    detectors: args.detectors,
    rewriteStrategy: args.rewrite,
  };

  const result = sanitizeAiText(raw, sanitizeOptions);
  const diff = unifiedDiff(raw, result.cleaned);

  if (args.output) {
    writeFileSync(resolve(process.cwd(), args.output), result.cleaned, 'utf8');
  } else {
    process.stdout.write(result.cleaned);
  }

  if (args.report) {
    writeReport(args.report, {
      changes: result.changes,
      findings: result.findings ?? [],
      diff,
    });
  }

  if (args.strict) {
    const detectorHit = Boolean(result.findings?.length);
    const destructiveChange =
      result.changes.removedInvisible > 0 ||
      result.changes.removedCtrl > 0 ||
      result.changes.removedCitations > 0 ||
      result.changes.removedModelArtifacts > 0;

    if (detectorHit || destructiveChange) {
      console.error(
        '[ai-text-sanitizer] Strict mode failed: review report for details.'
      );
      process.exit(2);
    }
  }
}

run().catch((error) => {
  console.error('[ai-text-sanitizer] CLI failed:', error);
  process.exit(1);
});
