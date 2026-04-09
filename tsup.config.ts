import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    dts: false,
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    sourcemap: false,
  },
]);
