/**
 * Count the UTF-8 byte length of a string without allocating the
 * encoded byte array.
 *
 * `string.length` counts UTF-16 code units, which is wrong for any
 * character outside the Basic Multilingual Plane (emoji, math
 * symbols, many CJK characters): a single emoji can be 4 bytes in
 * UTF-8 but only 2 code units in UTF-16. Using `length` to gate a
 * byte-size limit (as the pipeline does for `maxResponseBytes`) would
 * truncate Unicode-heavy responses prematurely.
 *
 * TextEncoder + byteLength is the standard, runtime-agnostic
 * approach: available in all modern browsers, Node 18+, Workers,
 * Deno, Bun.
 *
 * @example
 *   utf8ByteLength('A');                  // 1
 *   utf8ByteLength('🎉');                 // 4
 *   utf8ByteLength('café');               // 5 (c, a, f, 2-byte é)
 */
const ENCODER = new TextEncoder();

export function utf8ByteLength(s: string): number {
  // TextEncoder.encode returns a fresh Uint8Array each call; for our
  // use case (one check per LLM response, never in a hot loop), the
  // allocation is fine. If this ever lands in a hot path, swap for a
  // manual UTF-8 length scan.
  return ENCODER.encode(s).length;
}