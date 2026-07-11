// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Re-declare @typescript-eslint/no-unused-vars with the
      // project's `^_` ignore patterns. The original config declared
      // this under `files: ['src/**/*.ts']`, which only matched the
      // repo-root `src/` (one file), so the rule's options never
      // actually applied to per-package sources — the `recommended`
      // preset's severity-only `[2]` declaration won. The v0.4 PR
      // adds mock `complete(_prompt: string)` callbacks in
      // `*.test.ts` where the lone-arg case fires under the default
      // `args: 'after-used'` setting, so we widen the glob and pass
      // `args: 'all'` so single-arg `_prompt` is ignored.
      //
      // `consistent-type-imports` is intentionally NOT re-declared
      // here: keeping it off preserves the previous behavior where
      // the rule was effectively dead code. The v0.4 PR introduces
      // 19+ new inline `import()` type usages in `generate.ts` and
      // `generate.test.ts`; refactoring them all into named type
      // imports is out of scope for this changeset.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
);
