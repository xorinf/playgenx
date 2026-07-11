import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256.js';

describe('sha256Hex', () => {
  it('matches the canonical sha-256 of "abc"', async () => {
    // ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the canonical sha-256 of an empty string', async () => {
    // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('returns 64-char lowercase hex for arbitrary input', async () => {
    const out = await sha256Hex('arbitrary');
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different inputs', async () => {
    expect(await sha256Hex('a')).not.toBe(await sha256Hex('b'));
  });

  it('produces the same hash for the same input twice', async () => {
    expect(await sha256Hex('round-trip')).toBe(await sha256Hex('round-trip'));
  });

  it('handles unicode without crashing', async () => {
    const out = await sha256Hex('héllo 🌍');
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });
});
