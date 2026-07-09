/**
 * Extract the capitalized JSX-style tag names from a body of code.
 *
 * @example
 * tagNames('<Card><Text>hi</Text></Card>') // → ['Card', 'Text']
 */
export function tagNames(body: string): string[] {
  const re = /<([A-Z][A-Za-z0-9]*)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) seen.add(m[1]);
  }
  return Array.from(seen);
}
