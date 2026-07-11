/**
 * SHA-256 hash helper for artifact fingerprints.
 *
 * Returns a 64-character lowercase-hex digest (the WebCrypto convention).
 * Uses `globalThis.crypto.subtle.digest` which is available in:
 *   - all modern browsers
 *   - Node 19+ (via `node:crypto.webcrypto`)
 *   - Cloudflare Workers, Deno, Bun
 *
 * Synchronous digest mode is NOT used because WebCrypto only exposes
 * the async `subtle.digest`. Callers that need a sync fingerprint
 * (rare — usually you call this once per generation) should `await`.
 */

const ENCODER = new TextEncoder();

/**
 * SHA-256 of a string. Returns the hex digest (64 lowercase chars).
 *
 * @example
 *   await sha256Hex('hello'); // '2cf24...'
 */
export async function sha256Hex(input: string): Promise<string> {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj?.subtle) {
    throw new Error(
      'sha256Hex requires globalThis.crypto.subtle (Node 19+, modern browsers, or Workers/Deno)',
    );
  }
  const bytes = await cryptoObj.subtle.digest('SHA-256', ENCODER.encode(input));
  return toHex(bytes);
}

function toHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const byte = view[i] ?? 0;
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}
