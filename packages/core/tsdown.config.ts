import { defineConfig } from 'tsdown';

/**
 * tsdown config for @playgenx/core.
 *
 * Workspace deps are marked `alwaysBundle` so they get bundled into
 * the single published output. This lets us publish one npm package
 * (`@playgenx/core` — published as `playgenx`) while keeping the
 * sub-packages private workspace deps.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  deps: {
    alwaysBundle: [
      '@playgenx/parser',
      '@playgenx/prompts',
      '@playgenx/providers',
      '@playgenx/registry',
      '@playgenx/types',
      '@playgenx/validators',
    ],
  },
});
