import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Regression test for v0.2.2: the published bundle had unbundled
 * external imports like `import { extractArtifact } from "@playgenx/parser"`.
 * Those imports broke `npm install playgenx@0.2.2` because `@playgenx/parser`
 * is a private workspace dep that doesn't exist on the npm registry.
 *
 * This test reads the freshly-built `dist/index.mjs` (NOT the source map)
 * and fails if ANY external PRIVATE `@playgenx/*` import remains after
 * bundling. tsdown's `deps.alwaysBundle` config is supposed to inline
 * workspace deps, but we hit a case where the explicit per-package allowlist
 * wasn't honoured (some builds externalised the listed deps anyway). The fix
 * was to use a regex `^@playgenx\/` instead of an explicit name list.
 * This test guards against that regression silently coming back.
 *
 * v0.5.2 allowance: `@playgenx/components`, `@playgenx/renderer`, and
 * `@playgenx/storage-react` are explicitly externalised in
 * `packages/core/package.json` `tsdown.deps.external` so backend-only
 * consumers don't pull React into their bundle. They are PUBLIC scoped
 * packages on npm (published under the `@playgenx` org since v0.5.2)
 * and listed as `peerDependencies` on the umbrella. Consumers who want
 * them get them via `npm install @playgenx/components @playgenx/renderer
 * @playgenx/storage-react` (or via the umbrella re-exports — see the
 * whitelist below). All other `@playgenx/*` deps MUST be bundled.
 *
 * We deliberately do NOT scan `index.mjs.map` because the source map
 * contains the original TypeScript source verbatim, including legitimate
 * `import ... from "@playgenx/parser"` lines from `src/generate.ts`. Those
 * are just source-text references; the runtime code in `index.mjs` must
 * not require them to resolve at install time.
 */
const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist', 'index.mjs');

// v0.5.2 whitelist: 3 public scoped packages (peer deps, external in
// the umbrella bundle). They live on npm under the @playgenx org.
// All other @playgenx/* packages remain bundled as workspace-private.
const V05_EXTERNAL_PUBLIC_PKGS = new Set([
  '@playgenx/components',
  '@playgenx/renderer',
  '@playgenx/storage-react',
]);

describe('published bundle is self-contained', () => {
  const dist = readFileSync(distPath, 'utf8');

  it('does not import any private @playgenx/* workspace deps externally', () => {
    // Match ESM imports of the form: import ... from "@playgenx/<name>"
    // and require('@playgenx/<name>') calls. Allow the v0.5.2 whitelist
    // of public scoped packages (peer deps).
    const importRe = /import\s[\s\S]*?\sfrom\s*['"]@playgenx\/([^'"]+)['"]/g;
    const requireRe = /require\s*\(\s*['"]@playgenx\/([^'"]+)['"]\s*\)/g;
    const offenders: string[] = [];
    for (const match of dist.matchAll(importRe)) {
      const name = match[1]!;
      const specifier = `@playgenx/${name}`;
      if (!V05_EXTERNAL_PUBLIC_PKGS.has(specifier)) {
        offenders.push(specifier);
      }
    }
    for (const match of dist.matchAll(requireRe)) {
      const name = match[1]!;
      const specifier = `@playgenx/${name}`;
      if (!V05_EXTERNAL_PUBLIC_PKGS.has(specifier)) {
        offenders.push(specifier);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not import any whitelisted @playgenx/* deps via require() either', () => {
    const externalWorkspaceRequire = /require\s*\(\s*['"]@playgenx\/[^'"]+['"]\s*\)/;
    expect(dist).not.toMatch(externalWorkspaceRequire);
  });
});
