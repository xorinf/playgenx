/**
 * @playgenx/renderer
 *
 * Parse a TSX/HTML artifact body into a normalised tree, then render
 * that tree against a registry of React 19 components.
 *
 * @packageDocumentation
 */

export type {
  RendererNode,
  RendererElement,
  RendererText,
  RendererFallthrough,
  ParsedProp,
  PropKind,
  ComponentMap,
  RenderInputProps,
} from './types.js';

export {
  parseBody,
  parseBodyNodes,
  isBuiltInTag,
} from './parser.js';

export {
  renderNode,
  renderNodes,
  renderBody,
  RenderExpression,
  propToSource,
} from './render.js';
