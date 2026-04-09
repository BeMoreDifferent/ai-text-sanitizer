export type RewriteStrategy = 'none' | 'light' | 'aggressive';

interface RewriteOutcome {
  text: string;
  rewrites: number;
}

const SYNONYM_RULES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\buse\b/gi, replacement: 'utilize' },
  { pattern: /\bshow\b/gi, replacement: 'demonstrate' },
  { pattern: /\bhe|\bshe\b/gi, replacement: 'they' },
  { pattern: /\bmake sure\b/gi, replacement: 'ensure' },
  { pattern: /\bhelp\b/gi, replacement: 'assist' },
];

function flipQuotes(input: string): RewriteOutcome {
  let rewrites = 0;
  const text = input.replace(/"([^"]*)"/gu, (_, inner: string) => {
    rewrites++;
    return `'${inner}'`;
  });
  return { text, rewrites };
}

function chunkSentences(input: string): RewriteOutcome {
  const sentences = input
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return { text: input, rewrites: 0 };
  }

  return { text: sentences.join('\n'), rewrites: sentences.length - 1 };
}

function applySynonyms(input: string): RewriteOutcome {
  let rewrites = 0;
  let text = input;
  for (const rule of SYNONYM_RULES) {
    text = text.replace(rule.pattern, (match: string) => {
      rewrites++;
      const capitalized = match[0] === match[0].toUpperCase();
      const replacement = capitalized
        ? rule.replacement[0].toUpperCase() + rule.replacement.slice(1)
        : rule.replacement;
      return replacement;
    });
  }
  return { text, rewrites };
}

export function rewriteText(
  input: string,
  strategy: RewriteStrategy
): RewriteOutcome {
  if (strategy === 'none') return { text: input, rewrites: 0 };

  let { text, rewrites } = flipQuotes(input);
  const chunked = chunkSentences(text);
  rewrites += chunked.rewrites;
  text = chunked.text;

  if (strategy === 'aggressive') {
    const synonyms = applySynonyms(text);
    text = synonyms.text;
    rewrites += synonyms.rewrites;
  }

  return { text, rewrites };
}
