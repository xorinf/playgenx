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
 * and fails if ANY external `@playgenx/*` import remains after bundling.
 * tsdown's `deps.alwaysBundle` config is supposed to inline workspace deps,
 * but we hit a case where the explicit per-package allowlist wasn't
 * honoured (some builds externalised the listed deps anyway). The fix was
 * to use a regex `^@playgenx\/` instead of an explicit name list. This
 * test guards against that regression silently coming back.
 *
 * We deliberately do NOT scan `index.mjs.map` because the source map
 * contains the original TypeScript source verbatim, including legitimate
 * `import ... from "@playgenx/parser"` lines from `src/generate.ts`. Those
 * are just source-text references; the runtime code in `index.mjs` must
 * not require them to resolve at install time.
 */
const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist', 'index.mjs');

describe('published bundle is self-contained', () => {
  const dist = readFileSync(distPath, 'utf8');

  it('does not import any @playgenx/* workspace deps externally', () => {
    // Match ESM imports of the form: import ... from "@playgenx/<name>"
    const externalWorkspaceImport = /import\s[\s\S]*?\sfrom\s*['"]@playgenx\/[^'"]+['"]/;
    expect(dist).not.toMatch(externalWorkspaceImport);
  });

  it('does not import any workspace deps via require() either', () => {
    const externalWorkspaceRequire = /require\s*\(\s*['"]@playgenx\/[^'"]+['"]\s*\)/;
    expect(dist).not.toMatch(externalWorkspaceRequire);
  });
});
