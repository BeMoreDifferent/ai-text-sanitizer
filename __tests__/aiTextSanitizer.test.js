import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  sanitizeAiText,
  sanitizeInvisible,
  unifiedDiff,
  rewriteText,
  softWatermarkPValue,
} from '../dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '..', 'dist', 'cli.js');

describe('sanitizeAiText pipeline', () => {
  test('removes invisible marks but preserves emoji graphemes', () => {
    const input = `A\u200DBC 👨‍👩‍👧‍👦`;
    const { cleaned } = sanitizeAiText(input);
    expect(cleaned).toBe('ABC 👨‍👩‍👧‍👦');
  });

  test('removes unicode tag watermark payloads and reports counters', () => {
    const input = `Alpha${String.fromCodePoint(0xe0061)}Beta`;
    const result = sanitizeAiText(input);

    expect(result.cleaned).toBe('AlphaBeta');
    expect(result.changes.removedInvisible).toBe(1);
    expect(result.changes.removedTags).toBe(1);
    expect(result.changes.rawTagCount).toBe(1);
  });

  test('removes supplementary variation-selector watermark payloads', () => {
    const input = `A${String.fromCodePoint(0xe0100)}I`;
    const result = sanitizeAiText(input);

    expect(result.cleaned).toBe('AI');
    expect(result.changes.removedVariationSelectors).toBe(1);
    expect(result.changes.rawVariationSelectorCount).toBe(1);
  });

  test('removes default-ignorable watermark controls without masking emoji', () => {
    const input = `soft\u00ADhyphen\u034F\u061C\u115F\u17B4\u180B\u206A`;
    const result = sanitizeAiText(input);

    expect(result.cleaned).toBe('softhyphen');
    expect(result.changes.removedDefaultIgnorables).toBe(7);
    expect(result.changes.rawDefaultIgnorableCount).toBe(7);

    const emoji = sanitizeAiText('Status: ☑️ 👨‍👩‍👧‍👦');
    expect(emoji.cleaned).toBe('Status: ☑️ 👨‍👩‍👧‍👦');
    expect(emoji.changes.removedVariationSelectors).toBe(0);
  });

  test('strips bidi marks by default but honors keepBidi', () => {
    const rtl = 'مرحبا\u200Fالعالم';
    const stripped = sanitizeAiText(rtl);
    expect(stripped.cleaned).toBe('مرحباالعالم');

    const preserved = sanitizeAiText(rtl, { keepBidi: true });
    expect(preserved.cleaned).toBe(rtl);
  });

  test('supports aggressive nfkc folding only when requested', () => {
    const circled = '① tasks';
    const gentle = sanitizeAiText(circled);
    expect(gentle.cleaned).toBe(circled);

    const folded = sanitizeAiText(circled, { nfkc: true });
    expect(folded.cleaned).toBe('1 tasks');
  });

  test('reports heuristic findings when detectors enabled', () => {
    const text = 'Hello\u200B\u200Bworld';
    const result = sanitizeAiText(text, { detectors: ['heuristic'] });
    expect(result.findings?.[0]?.kind).toBe('heuristic');
    expect(result.changes.rawInvisibleCount).toBeGreaterThan(0);
  });

  test('reports structured heuristic findings for tag and variation payloads', () => {
    const text = `A${String.fromCodePoint(0xe0061)}B${String.fromCodePoint(0xe0100)}`;
    const result = sanitizeAiText(text, { detectors: ['heuristic'] });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'heuristic',
          category: 'unicode-tag',
          count: 1,
          codePoints: ['U+E0061'],
        }),
        expect.objectContaining({
          kind: 'heuristic',
          category: 'variation-selector',
          count: 1,
          codePoints: ['U+E0100'],
        }),
      ])
    );
  });

  test('runs synthid detector via custom scorer', () => {
    const result = sanitizeAiText('token token', {
      detectors: ['synthid'],
      detectorConfigs: {
        synthid: {
          score: (tokens) => tokens.length / 10,
          threshold: 0.1,
        },
      },
    });
    expect(result.findings?.[0]?.kind).toBe('synthid');
    expect(result.findings?.[0]?.score).toBeCloseTo(0.2);
  });

  test('runs soft watermark detector on provided tokens', () => {
    const tokens = [1, 2, 3, 4, 5, 6];
    const pValue = softWatermarkPValue(
      tokens,
      (tok) => tok % 2 === 0,
      0.3
    );
    expect(pValue).toBeGreaterThan(0);
    const result = sanitizeAiText('demo text', {
      detectors: ['soft-watermark'],
      detectorConfigs: {
        softWatermark: {
          tokens,
          greenlist: (tok) => tok % 2 === 0,
          expectedGreenProbability: 0.3,
        },
      },
    });
    expect(result.findings?.[0]?.kind).toBe('soft-watermark');
  });
});

describe('low-level helpers', () => {
  test('sanitizeInvisible respects tab/newline preservation', () => {
    const input = '\tHello\n';
    const stripped = sanitizeInvisible(input, {
      keepEmoji: true,
      keepTabs: false,
      keepNewlines: false,
      keepBidi: false,
    });
    expect(stripped.text).toBe('Hello');
    expect(stripped.removedCtrl).toBeGreaterThan(0);
  });

  test('rewriteText reports rewrite count', () => {
    const { text, rewrites } = rewriteText('"Hello world."', 'aggressive');
    expect(text).toContain("'");
    expect(rewrites).toBeGreaterThan(0);
  });

  test('unifiedDiff returns contextual diff', () => {
    const diff = unifiedDiff('foo', 'bar');
    expect(diff).toContain('-foo');
    expect(diff).toContain('+bar');
  });
});

describe('CLI', () => {
  test('produces report and enforces strict mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanitizer-'));
    const inputPath = join(dir, 'input.txt');
    const outputPath = join(dir, 'output.txt');
    const reportPath = join(dir, 'report.json');
    writeFileSync(inputPath, 'Hi\u200B', 'utf8');

    const run = spawnSync(
      'node',
      [
        cliPath,
        '--in',
        inputPath,
        '--out',
        outputPath,
        '--report',
        reportPath,
        '--strict',
      ],
      { encoding: 'utf8' }
    );

    expect(run.status).toBe(2);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.changes.removedInvisible).toBe(1);
    expect(readFileSync(outputPath, 'utf8')).toBe('Hi');
  });

  test('strict mode reports unicode tag watermark counters', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanitizer-tags-'));
    const inputPath = join(dir, 'input.txt');
    const outputPath = join(dir, 'output.txt');
    const reportPath = join(dir, 'report.json');
    writeFileSync(inputPath, `Hi${String.fromCodePoint(0xe0061)}`, 'utf8');

    const run = spawnSync(
      'node',
      [
        cliPath,
        '--in',
        inputPath,
        '--out',
        outputPath,
        '--report',
        reportPath,
        '--strict',
      ],
      { encoding: 'utf8' }
    );

    expect(run.status).toBe(2);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.changes.removedTags).toBe(1);
    expect(report.changes.rawTagCount).toBe(1);
    expect(readFileSync(outputPath, 'utf8')).toBe('Hi');
  });
});
