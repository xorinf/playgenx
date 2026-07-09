import type { ComponentName, Registry } from './types.js';

/**
 * Create a fresh {@link Registry} seeded with the given component names.
 *
 * @example
 * const r = createRegistry(['Button', 'Card']);
 * r.isAllowed('Button'); // → true
 * r.add('Chart');
 * r.list(); // → ['Button', 'Card', 'Chart']
 */
export function createRegistry(seed: readonly ComponentName[] = []): Registry {
  const set = new Set<ComponentName>(seed);
  return {
    isAllowed(name) {
      return set.has(name);
    },
    list() {
      return Array.from(set);
    },
    add(name) {
      set.add(name);
    },
  };
}
