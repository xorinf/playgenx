/**
 * `createRegistry(overrides)` — build a component map with the default
 * 11 components plus caller overrides. Returns a frozen map so post-hoc
 * mutation can't surprise concurrent renders.
 *
 * Lowercase HTML tags (div, span, etc.) are NOT in this map; they're
 * intrinsic to React and handled by `renderBody` directly.
 *
 * @packageDocumentation
 */

import type { ComponentType } from 'react';

import { Button } from './Button.js';
import { Card } from './Card.js';
import { Chart } from './Chart.js';
import { Code } from './Code.js';
import { Container } from './Container.js';
import { Heading } from './Heading.js';
import { List } from './List.js';
import { Slider } from './Slider.js';
import { Stepper } from './Stepper.js';
import { Text } from './Text.js';
import { TextField } from './TextField.js';

/**
 * Map of PascalCase component name to React component. Loose typing
 * (`ComponentType<any>`) because each component's prop shape differs and
 * the runtime doesn't know which one it's looking up. Consumers who
 * need stricter types can build their own typed wrapper around
 * `renderBody`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentMap = Record<string, ComponentType<any>>;

const DEFAULT_REGISTRY: ComponentMap = Object.freeze({
  Button,
  Card,
  Chart,
  Code,
  Container,
  Heading,
  List,
  Slider,
  Stepper,
  Text,
  TextField,
});

/**
 * The full default registry (Button, Card, Chart, Code, Container,
 * Heading, List, Slider, Stepper, Text, TextField). Frozen. Use
 * `createRegistry(overrides)` to extend.
 */
export const componentMap: ComponentMap = DEFAULT_REGISTRY;

/**
 * Build a new registry by merging the defaults with caller-supplied
 * overrides. The returned map is frozen (Object.freeze) to prevent
 * post-hoc mutation that would surprise concurrent renders.
 *
 * **Lowercase HTML tags are NOT in this map.** The renderer handles
 * `div`, `span`, etc. as React intrinsic elements separately. Calling
 * `createRegistry({ div: StubDiv })` will NOT override the renderer
 * for `<div>` (the renderer uses the lowercase lookup path first).
 *
 * @example
 * ```ts
 * const map = createRegistry({
 *   MathExpression: MathExpressionComponent,
 *   LatexBlock: LatexBlockComponent,
 * });
 * ```
 */
export function createRegistry(overrides: Partial<ComponentMap>): ComponentMap {
  // Merge: defaults are the base; overrides win. Lowercase keys are
  // filtered out because they refer to React intrinsic HTML tags
  // (div, span, etc.) that renderBody handles intrinsically — the
  // caller cannot override intrinsic rendering via the registry.
  // Object.freeze on the result prevents consumers from accidentally
  // mutating the global componentMap by mutating their copy.
  const merged: ComponentMap = { ...DEFAULT_REGISTRY };
  for (const key of Object.keys(overrides) as (keyof ComponentMap)[]) {
    const value = overrides[key];
    if (value === undefined) continue;
    if (key[0] !== key[0]!.toUpperCase()) continue; // skip lowercase
    merged[key] = value;
  }
  return Object.freeze(merged);
}
