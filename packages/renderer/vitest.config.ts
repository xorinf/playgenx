import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
  resolve: {
    conditions: ['module', 'import', 'default'],
  },
});
