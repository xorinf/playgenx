/**
 * @playgenx/components
 *
 * Default React 19 implementations for every entry in DEFAULT_REGISTRY.
 * Pair with @playgenx/registry and the parser/validator pipeline.
 *
 * v0.2.0 additions: interactive state via PlaygroundStateProvider,
 * ArtifactErrorBoundary for graceful render failures, ShowSource for
 * revealing raw body, and createRegistry for caller extensions.
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

// v0.2.0: interactive state store + Provider + hook
export {
  createPlaygroundState,
  PlaygroundStateProvider,
  usePlaygroundState,
  type PlaygroundState,
  type PlaygroundStateProviderProps,
} from './state.jsx';

// v0.2.0: error boundary for rendered artifacts
export {
  ArtifactErrorBoundary,
  type ArtifactErrorBoundaryProps,
} from './ArtifactErrorBoundary.jsx';

// v0.2.0: ShowSource render-prop component
export { ShowSource, type ShowSourceProps } from './ShowSource.jsx';

// v0.2.0: registry creation with overrides
export {
  componentMap,
  createRegistry,
  type ComponentMap,
} from './createRegistry.js';
