function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const matrix = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) matrix[i][j] = matrix[i + 1][j + 1] + 1;
      else matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }
  return matrix;
}

export function unifiedDiff(original: string, updated: string): string {
  if (original === updated) return '';
  const aLines = original.split('\n');
  const bLines = updated.split('\n');
  const matrix = lcsMatrix(aLines, bLines);

  const ops: { type: 'equal' | 'delete' | 'insert'; line: string }[] = [];
  let i = 0;
  let j = 0;

  while (i < aLines.length && j < bLines.length) {
    if (aLines[i] === bLines[j]) {
      ops.push({ type: 'equal', line: aLines[i] });
      i++;
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      ops.push({ type: 'delete', line: aLines[i] });
      i++;
    } else {
      ops.push({ type: 'insert', line: bLines[j] });
      j++;
    }
  }

  while (i < aLines.length) {
    ops.push({ type: 'delete', line: aLines[i++] });
  }

  while (j < bLines.length) {
    ops.push({ type: 'insert', line: bLines[j++] });
  }

  const body: string[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const op of ops) {
    if (op.type === 'equal') {
      oldLine++;
      newLine++;
      continue;
    }
    const marker = op.type === 'delete' ? '-' : '+';
    body.push(`${marker}${op.line}`);
    if (op.type === 'delete') oldLine++;
    else newLine++;
  }

  return ['--- original', '+++ sanitized', `@@ -1 +1 @@`, ...body].join('\n');
}
