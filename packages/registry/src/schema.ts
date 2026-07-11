/**
 * Component schema types for prop-shape validation.
 *
 * The existing {@link Registry} in this package answers a name-only
 * question: "is `<Button />` allowed?". This file introduces a
 * complementary data structure that answers a deeper question: "given
 * a `<Button>` element, are the props on it well-formed?".
 *
 * The split is deliberate: a registry can be a curated allowlist of
 * names without the caller knowing every accepted prop. A schema, by
 * contrast, must declare its props precisely or its purpose is lost.
 *
 * @packageDocumentation
 */

/** Coarse primitive category of a prop value. */
export type PropKind = 'string' | 'number' | 'boolean' | 'node';

/** Description of a single prop on a registered component. */
export interface PropSchema {
  /** Prop name as it appears in JSX. */
  readonly name: string;
  /** What kind of value is accepted. `node` allows arbitrary ReactNode. */
  readonly kind: PropKind;
  /** Whether the caller MUST supply this prop. Default false. */
  readonly required?: boolean;
  /**
   * Optional human-readable hint included in validation error messages.
   * Kept short; long descriptions don't fit alongside a stack trace.
   */
  readonly hint?: string;
}

/** Description of a single registered component, including its props. */
export interface ComponentSchema {
  /** Component name as it appears in JSX (matches the registry). */
  readonly name: string;
  /** Allowed props, in declaration order. */
  readonly props: readonly PropSchema[];
  /**
   * Whether the component is itself considered "container-like" — i.e.
   * it accepts arbitrary children as its primary content. The renderer
   * reads this to decide whether to look at `<Component>{kids}</Component>`
   * vs `<Component ...props />`. Keep loose; just a hint.
   */
  readonly acceptsChildren?: boolean;
}
