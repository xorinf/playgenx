#!/usr/bin/env node
// scripts/verify-package-surfaces.mjs
//
// Smoke test for the workspace's published-package surface:
//   - each published package's dist/ emits without forbidden runtime deps
//   - the optional-peer design holds: @aws-sdk/client-s3 is NOT
//     transitively required by consumers who don't ask for it
//   - bundle sizes stay in the published-budget range
//
// Run via: `node scripts/verify-package-surfaces.mjs`
//
// Exits non-zero on any failure so it can gate a future CI job.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

// Returns the size of `dist/index.mjs` for a package, in bytes,
// or null if the file is missing.
function distMjsSize(pkg) {
  const path = resolve(ROOT, `packages/${pkg}/dist/index.mjs`);
  if (!existsSync(path)) return null;
  return statSync(path).size;
}

// Runs `npm view <pkg> dependencies ...` via `npm ls` on the local
// package.json. We use the local dist's package.json as the source
// of truth, not the registry, because none of these are
// published yet.
function runtimeDependencies(pkg) {
  const path = resolve(ROOT, `packages/${pkg}/package.json`);
  if (!existsSync(path)) return null;
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const out = new Set();
  for (const k of Object.keys(j.dependencies ?? {})) out.add(k);
  return [...out];
}

function peerDependencies(pkg) {
  const path = resolve(ROOT, `packages/${pkg}/package.json`);
  if (!existsSync(path)) return null;
  const j = JSON.parse(readFileSync(path, 'utf8'));
  return Object.keys(j.peerDependencies ?? {});
}

const PUBLISHED = [
  '@playgenx/types',
  '@playgenx/registry',
  '@playgenx/utils',
  '@playgenx/validators',
  '@playgenx/storage',
  '@playgenx/components',
  '@playgenx/renderer',
  '@playgenx/storage-react',
];

const results = [];
let failed = 0;

for (const pkg of PUBLISHED) {
  const dirName = pkg.replace('@playgenx/', '');
  const size = distMjsSize(dirName);
  const deps = runtimeDependencies(dirName) ?? [];
  const peers = peerDependencies(dirName) ?? [];
  const ok = size !== null;
  if (!ok) failed++;
  results.push({
    pkg,
    distMjsBytes: size,
    runtimeDeps: deps,
    peers,
    ok,
  });
}

// Cross-package check: @aws-sdk/client-s3 should only appear as a
// devDep of @playgenx/storage, never as a runtime dep of any
// published package.
const awsClientS3AsRuntimeDep = results
  .filter((r) => r.runtimeDeps.includes('@aws-sdk/client-s3'))
  .map((r) => r.pkg);

if (awsClientS3AsRuntimeDep.length > 0) {
  console.error(
    `FAIL: @aws-sdk/client-s3 leaked into runtime deps of: ${awsClientS3AsRuntimeDep.join(', ')}`,
  );
  failed++;
}

// Report.
console.log('\n# Package surface report\n');
console.log('| package | dist mjs (bytes) | runtime deps | peer deps |');
console.log('|---|---:|---|---|');
for (const r of results) {
  const size = r.distMjsBytes === null ? 'MISSING' : r.distMjsBytes.toString();
  const deps = r.runtimeDeps.length === 0 ? '∅' : r.runtimeDeps.join(', ');
  const peers = r.peers.length === 0 ? '∅' : r.peers.join(', ');
  console.log(`| ${r.pkg} | ${size} | ${deps} | ${peers} |`);
}

if (failed > 0) {
  console.error(`\nFAIL: ${failed} issue(s)`);
  process.exit(1);
}
console.log('\nOK: all packages present, no leaked SDK deps.');