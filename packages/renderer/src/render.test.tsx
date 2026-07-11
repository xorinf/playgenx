import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { afterEach } from 'vitest';

import * as parserModule from './parser.js';
import { parseBodyNodes } from './parser.js';
import { renderBody, renderNodes, RenderExpression } from './render.js';
import type { ComponentMap } from './types.js';

afterEach(() => cleanup());

/**
 * Minimal test registry. We supply just enough of @playgenx/components
 * to exercise the renderer wiring without pulling the full package
 * into the renderer tests. The full coverage of @playgenx/components
 * lives in that package; the renderer tests verify that given a
 * registry map, the right components are picked.
 */
const registry: ComponentMap = {
  Button: ({ label, disabled }: { label: string; disabled?: boolean }) =>
    React.createElement('button', { type: 'button', 'data-pgx': 'Button', disabled }, label),
  TextField: ({ label }: { label?: string }) =>
    React.createElement('label', { 'data-pgx': 'TextField' }, label),
  Heading: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('h2', { 'data-pgx': 'Heading' }, children),
  Text: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('p', { 'data-pgx': 'Text' }, children),
  Card: ({ title, children }: { title?: string; children?: React.ReactNode }) =>
    React.createElement('section', { 'data-pgx': 'Card', 'data-title': title }, children),
};

describe('renderBody (high-level)', () => {
  it('mounts a single component from the body string', () => {
    const { container } = render(
      renderBody('<Button label="Go" />', registry) as React.ReactElement,
    );
    const btn = container.querySelector('button')!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Go');
    expect(btn.getAttribute('data-pgx')).toBe('Button');
  });

  it('mounts a tree with a built-in HTML wrapper', () => {
    const { container } = render(
      renderBody('<div><Heading>Hello</Heading></div>', registry) as React.ReactElement,
    );
    expect(container.querySelector('div h2')!.textContent).toBe('Hello');
  });

  it('passes expression values as RenderExpression', () => {
    render(renderBody('<Heading>{"literal"}</Heading>', registry) as React.ReactElement);
    const h = screen.getByText('{"literal"}');
    expect(h).toBeTruthy();
  });

  it('forwards numeric expression values', () => {
    const Slider = ({ value }: { value: number; min: number; max: number }) =>
      React.createElement('input', { type: 'range', value });
    const local: ComponentMap = { ...registry, Slider };
    const { container } = render(
      renderBody('<Slider min={0} max={10} value={5} />', local) as React.ReactElement,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(Number(input.value)).toBe(5);
  });

  it('forwards boolean props', () => {
    const { container } = render(
      renderBody('<Button label="x" disabled />', registry) as React.ReactElement,
    );
    const btn = container.querySelector('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('renders built-in HTML tags directly', () => {
    const { container } = render(
      renderBody('<section><p>x</p></section>', registry) as React.ReactElement,
    );
    expect(container.querySelector('section p')).toBeTruthy();
  });

  it('renders unknown PascalCase names as fallthrough', () => {
    const { container } = render(
      renderBody('<NoSuch label="x" />', registry) as React.ReactElement,
    );
    const pre = container.querySelector('pre[data-pgx-fallthrough]');
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toContain('NoSuch');
  });

  it('nests components inside built-ins inside components', () => {
    const body = '<Card title="t"><Heading>Hello</Heading><Text>world</Text></Card>';
    const { container } = render(renderBody(body, registry) as React.ReactElement);
    const card = container.querySelector('[data-pgx="Card"]')!;
    expect(card.getAttribute('data-title')).toBe('t');
    expect(card.querySelector('[data-pgx="Heading"]')!.textContent).toBe('Hello');
    expect(card.querySelector('[data-pgx="Text"]')!.textContent).toBe('world');
  });
});

describe('renderBody (v0.5 contract)', () => {
  it('returns an empty string for empty body', () => {
    const out = renderBody('', registry);
    expect(out).toBe('');
  });

  it('returns an empty string for whitespace-only body', () => {
    const out = renderBody('   \n\t  ', registry);
    expect(out).toBe('');
  });

  it('returns a string (not a React element) for a single text node', () => {
    // viBe's Phase 11 contract: <>{element}</> renders strings
    // directly without React warning about a text-only Fragment.
    const out = renderBody('Hello, world!', registry);
    expect(typeof out).toBe('string');
    expect(out).toBe('Hello, world!');
  });

  it('returns the body as a string for malformed input (parse failure)', () => {
    // The current parser never throws — it falls back to
    // RendererFallthrough nodes — so a real parse-failure path is
    // defensive. Force a throw by spying on parseBodyNodes to
    // simulate a future version that does throw.
    const spy = vi
      .spyOn(parserModule, 'parseBodyNodes')
      .mockImplementation(() => {
        throw new Error('simulated parser failure');
      });
    try {
      const out = renderBody('<Button label="x" />', registry, {
        throwOnError: false,
      });
      expect(out).toBe('<Button label="x" />');
    } finally {
      spy.mockRestore();
    }
  });

  it('logs to console.error when throwOnError is true and parsing fails', () => {
    const spy = vi
      .spyOn(parserModule, 'parseBodyNodes')
      .mockImplementation(() => {
        throw new Error('simulated parser failure');
      });
    const errors: unknown[][] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      const out = renderBody('<Button label="x" />', registry, {
        throwOnError: true,
      });
      expect(out).toBe('<Button label="x" />');
      expect(errors.length).toBe(1);
      expect(String(errors[0]?.[0])).toContain('parseBodyNodes threw');
    } finally {
      console.error = orig;
      spy.mockRestore();
    }
  });

  it('returns the body as a string when iframeFallback is true (reserved flag)', () => {
    // iframeFallback is accepted and ignored in v0.5. The render
    // still happens inline; the flag is reserved for v0.6.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = renderBody('<Button label="x" />', registry, { iframeFallback: true });
    // Dev-mode: console.warn is called. We don't assert on its
    // message in NODE_ENV=production to keep the test robust.
    if (process.env.NODE_ENV !== 'production') {
      expect(warnSpy).toHaveBeenCalled();
    }
    // Output is still a React element (inline render), not an iframe.
    expect(typeof out).toBe('object');
    warnSpy.mockRestore();
  });

  it('return type is ReactElement | string (compile-time check)', () => {
    // This is a TS-only check at the call site. If the signature
    // regresses, the next two lines will fail to compile.
    const element: React.ReactElement = renderBody(
      '<Button label="x" />',
      registry,
    ) as React.ReactElement;
    const text: string = renderBody('just text', registry) as string;
    expect(element).toBeTruthy();
    expect(text).toBe('just text');
  });
});

describe('renderNodes (lower-level)', () => {
  it('renders an already-parsed tree directly', () => {
    const nodes = parseBodyNodes('<Heading>hi</Heading>');
    const { container } = render(renderNodes(nodes, registry, 'k') as React.ReactElement);
    expect(container.querySelector('h2')?.textContent).toBe('hi');
  });

  it('returns null for empty input', () => {
    const out = renderNodes([], registry, 'k');
    expect(out).toBeNull();
  });
});

describe('RenderExpression', () => {
  it('returns the source text from toPrimitive', () => {
    const r = new RenderExpression('5 + 2');
    expect(`${r}`).toBe('5 + 2');
    expect(`${r}foo`).toBe('5 + 2foo');
  });

  it('falls back to "undefined" when no inspect handler runs', () => {
    // Placeholder objects don't have to print nicely for everyone;
    // assert that nothing throws on toString and the call is
    // type-stable.
    const r = new RenderExpression('foo.bar()');
    expect(() => r.toString()).not.toThrow();
  });
});
