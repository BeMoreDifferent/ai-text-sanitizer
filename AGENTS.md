# Repository Guidelines

## Project Structure & Module Organization
The library is split across small modules: tables under `src/tables/`, core logic in `src/core/`, detectors under `src/detect/`, and rewrite helpers inside `src/rewrite/`. `src/index.ts` simply re-exports the public surface while `src/cli.ts` powers the binary. Runtime bundles and declarations reside in `dist/` (never edit them manually). Jest specs live in `__tests__/aiTextSanitizer.test.js` and should mirror real-world payloads (HTML fragments, emoji runs, bidi injections). Docs stay in `README.md` and `docs/`; update both when behavior or options shift.

## Build, Test, and Development Commands
Use Node 18+ and install dependencies once with `pnpm install`. Core workflows:

```bash
pnpm build           # bundle TypeScript (tsup) to dist/ + .d.ts
pnpm test            # build, then run Jest in ESM mode
pnpm prepublishOnly  # build + full test gate before publishing
```

When iterating on TypeScript, run `pnpm build --watch` (tsup supports incremental rebuilds) to keep `dist/` in sync before exporting new features.

## Coding Style & Naming Conventions
Write modern TypeScript with two-space indentation, single quotes, and `const`-first semantics. Export named functions or `type` aliases from modules; default exports are reserved for compatibility wrappers. Use `PascalCase` for interfaces (`SanitizeOptions`), `camelCase` for functions, and uppercase snake case for point-set constants. Keep helper comments brief and prefer JSDoc when describing sanitizer, detector, or CLI option contracts.

## Testing Guidelines
Tests live in `__tests__` (ESM) and must end in `.test.js` so Jest auto-discovers them. Each scenario should document the payload (e.g., zero-width joiner, bidi block, CLI strict failure) and assert both `cleaned` output and `changes`/`findings`. Run `pnpm test -- --runInBand` before pushing when debugging Unicode edge cases, and extend fixtures instead of replacing them to preserve historical coverage.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat: add citation trimming`, `fix: handle CRLF spans`) for every changeset; this keeps release notes automated. PRs should link the relevant issue, describe affected rules, summarize new commands or flags, and include evidence that `pnpm test` passed (paste the command). Add screenshots or before/after snippets when behavior is visible in rendered text, and request review whenever modifying sanitizer heuristics or regex tables.
