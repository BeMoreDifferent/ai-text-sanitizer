# ai-text-sanitizer

Utility for post-processing AI-generated text. It normalises output by
removing invisible characters (often used as watermarks or formatting
artifacts), folding exotic whitespace, converting "pretty" punctuation to
ASCII, and stripping inline citation placeholders such as
`(oaicite:12){index=12}`.

## Features

* Removes Unicode *format* and other zero-width characters that can act as
  invisible watermarks.
* Converts *fancy* punctuation (curly quotes, en/em dashes, ellipsis, bullets)
  to plain ASCII equivalents.
* Folds a wide range of Unicode space characters to a standard space.
* Collapses runs of multiple spaces and normalises line endings to `LF`.
* Eliminates citation placeholders emitted by some language models.
* Optionally preserves or removes emoji glue characters (ZWJ / variation
  selectors).
* Returns granular change statistics so you can audit the cleaning process.

## Installation

```bash
pnpm add ai-text-sanitizer
```

This project is published as an ES module and requires Node ≥ 18.

## Usage

```js
import { sanitizeAiText } from 'ai-text-sanitizer';

const input = `\uFEFF"Hello\u200B world…" (oaicite:5){index=5}`;

const { cleaned, changes } = sanitizeAiText(input);

console.log(cleaned);  // "Hello world..."
console.log(changes);  /* {
                          removedInvisible: 2,
                          removedCtrl: 0,
                          removedCitations: 1,
                          prettified: 3,
                          collapsedSpaces: 0,
                          total: 6
                        } */
```

### API

`sanitizeAiText(text, options?)` → `{ cleaned, changes }`

| Parameter  | Type                | Default | Description                                   |
|----------- |-------------------- |---------|----------------------------------------------|
| `text`     | `string`            | –       | Input text to sanitise.                       |
| `options`  | `object` (optional) | –       | Behaviour flags (below).                     |
| `keepEmoji`| `boolean`           | `true`  | Keep ZWJ / variation selectors used by emoji.|
| `collapseSpaces` | `boolean`     | `true`  | Collapse contiguous ASCII spaces.             |

The returned `changes` object reports how many code points were altered for
each rule plus a `total` sum.

## Running the test suite

```bash
pnpm install
pnpm test
```

Tests live in `__tests__/` and exercise typical real-world scenarios including
HTML fragments, code snippets, emoji sequences, and BOM handling.

## Limitations

* The function operates on raw strings; it does **not** parse or sanitise HTML
  structure. HTML tags remain untouched but are treated as plain text.
* The mapping of *fancy* punctuation is intentionally conservative. If you need
  broader transliteration, customise the `PRETTIES` table in
  `aiTextSanitizer.js`.

---
This repository contains only the core library and test suite to keep the
footprint minimal. 