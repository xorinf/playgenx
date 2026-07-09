import { describe, it, expect } from 'vitest';
import { VERSION, version } from './index.js';

describe('playgenx', () => {
  it('exposes the package version', () => {
    expect(VERSION).toBe('0.1.0');
    expect(version()).toBe('0.1.0');
  });
});