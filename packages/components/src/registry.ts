/**
 * Default @playgenx/components barrel.
 *
 * Re-exports every component named in `DEFAULT_REGISTRY` and a
 * `componentMap` keyed by PascalCase component name, so render-time
 * code can do `ComponentMap[tagName](props)`.
 *
 * @packageDocumentation
 */

export { Button, type ButtonProps } from './Button.js';
export { TextField, type TextFieldProps } from './TextField.js';
export { Slider, type SliderProps } from './Slider.js';
export { Chart, type ChartProps, type ChartKind } from './Chart.js';
export { Container, type ContainerProps } from './Container.js';
export { Code, type CodeProps } from './Code.js';
export { Heading, type HeadingProps } from './Heading.js';
export { Text, type TextProps } from './Text.js';
export { Stepper, type StepperProps, type Step } from './Stepper.js';
export { Card, type CardProps } from './Card.js';
export { List, type ListProps } from './List.js';

import type { ComponentType } from 'react';
import { Button } from './Button.js';
import { TextField } from './TextField.js';
import { Slider } from './Slider.js';
import { Chart } from './Chart.js';
import { Container } from './Container.js';
import { Code } from './Code.js';
import { Heading } from './Heading.js';
import { Text } from './Text.js';
import { Stepper } from './Stepper.js';
import { Card } from './Card.js';
import { List } from './List.js';

/**
 * Map of PascalCase component name to React component. Use this when
 * you have a renderer that walks an AST and needs to pick an
 * implementation at runtime:
 *
 *   const C = componentMap[tagName];
 *   if (C) el = <C {...props}>{children}</C>;
 *
 * Keys mirror `DEFAULT_REGISTRY.list()`.
 *
 * Type note: components vary in their props shape, so the map is
 * typed permissively (`Record<string, ComponentType<any>>`). Each
 * individual export above is still strictly typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const componentMap: Record<string, ComponentType<any>> = {
  Button,
  TextField,
  Slider,
  Chart,
  Container,
  Code,
  Heading,
  Text,
  Stepper,
  Card,
  List,
};

export type ComponentMapKey = keyof typeof componentMap;
