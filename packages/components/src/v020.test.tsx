/**
 * v0.2.0 acceptance tests for the new interactive-state, error-boundary,
 * and registry-extension surfaces. These cover:
 *  - PlaygroundStateProvider + usePlaygroundState + createPlaygroundState
 *  - ArtifactErrorBoundary
 *  - ShowSource
 *  - createRegistry
 *
 * The original v0.1.0 component tests live in `components.test.tsx`.
 */

import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import * as React from 'react';

import {
  PlaygroundStateProvider,
  usePlaygroundState,
  createPlaygroundState,
  ArtifactErrorBoundary,
  ShowSource,
  createRegistry,
  componentMap,
  Button,
} from './index.js';

describe('createPlaygroundState (A.1)', () => {
  it('set/get roundtrip', () => {
    const state = createPlaygroundState();
    state.set('foo', 42);
    expect(state.get('foo')).toBe(42);
  });

  it('initial values are populated', () => {
    const state = createPlaygroundState({ x: 'hello', y: 99 });
    expect(state.get('x')).toBe('hello');
    expect(state.get('y')).toBe(99);
  });

  it('set with ===-equal value is a no-op (no NEW subscriber fire)', async () => {
    // The "no-op" semantic: a set to the current value does not
    // schedule a NEW pending event. But subscribers added AFTER an
    // existing set was queued will still see the queued fire (we
    // can't unsee a pending event by not being subscribed yet). The
    // contract: no NEW set event is produced.
    const state = createPlaygroundState();
    const cb = vi.fn();
    state.subscribe('x', cb); // subscribe FIRST
    state.set('x', 1); // queues an event
    state.set('x', 1); // no-op: no new event queued
    state.set('x', 2); // queues an event with value 2
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    // Two events queued: 1 (from first set), 2 (from third set).
    // The second set was a no-op.
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, 1);
    expect(cb).toHaveBeenNthCalledWith(2, 2);
  });

  it('subscribe fires on change', async () => {
    const state = createPlaygroundState();
    const seen: Array<unknown> = [];
    state.subscribe('x', (v) => seen.push(v));
    state.set('x', 1);
    state.set('x', 2);
    await new Promise<void>((r) => queueMicrotask(r));
    expect(seen).toEqual([1, 2]);
  });

  it('unsubscribe stops firing', async () => {
    const state = createPlaygroundState();
    const seen: Array<unknown> = [];
    const unsub = state.subscribe('x', (v) => seen.push(v));
    state.set('x', 1);
    await new Promise<void>((r) => queueMicrotask(r));
    unsub();
    state.set('x', 2);
    await new Promise<void>((r) => queueMicrotask(r));
    expect(seen).toEqual([1]); // second value not received
  });

  it('snapshot returns a shallow copy', () => {
    const state = createPlaygroundState({ a: 1, b: 2 });
    const snap = state.snapshot();
    expect(snap).toEqual({ a: 1, b: 2 });
    state.set('a', 99);
    expect(snap.a).toBe(1); // original snapshot immutable
  });

  it('replaceAll merges and fires for changed keys', async () => {
    const state = createPlaygroundState({ a: 1, b: 2 });
    const seen: Array<unknown> = [];
    state.subscribe('b', (v) => seen.push(v));
    state.replaceAll({ a: 1, b: 99, c: 3 });
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(seen).toEqual([99]); // only b changed; a no-op, c isn't subscribed
    expect(state.get('a')).toBe(1);
    expect(state.get('b')).toBe(99);
    expect(state.get('c')).toBe(3);
  });
});

describe('usePlaygroundState (A.1)', () => {
  it('throws outside a Provider', () => {
    expect(() => renderHook(() => usePlaygroundState())).toThrow(
      /PlaygroundStateProvider/,
    );
  });

  it('returns the store inside a Provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlaygroundStateProvider>{children}</PlaygroundStateProvider>
    );
    const { result } = renderHook(() => usePlaygroundState(), { wrapper });
    act(() => result.current.set('foo', 1));
    expect(result.current.get('foo')).toBe(1);
  });

  it('Provider accepts initial values', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlaygroundStateProvider initial={{ count: 42 }}>
        {children}
      </PlaygroundStateProvider>
    );
    const { result } = renderHook(() => usePlaygroundState(), { wrapper });
    expect(result.current.get('count')).toBe(42);
  });
});

describe('ArtifactErrorBoundary (A.3)', () => {
  function BrokenChild(): React.JSX.Element {
    throw new Error('render exploded');
  }

  it('renders children when no error', () => {
    const { container } = render(
      <ArtifactErrorBoundary>
        <div>ok</div>
      </ArtifactErrorBoundary>,
    );
    expect(container.textContent).toContain('ok');
  });

  it('shows default fallback on error', () => {
    // React logs the error to console.error by default; suppress it
    // in this test to keep output clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ArtifactErrorBoundary>
        <BrokenChild />
      </ArtifactErrorBoundary>,
    );
    expect(container.textContent).toContain('render exploded');
    expect(
      container.querySelector('[data-pgx="ArtifactErrorBoundary"]'),
    ).toBeTruthy();
    spy.mockRestore();
  });

  it('calls onError when boundary catches', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <ArtifactErrorBoundary onError={onError}>
        <BrokenChild />
      </ArtifactErrorBoundary>,
    );
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0]![0].message).toBe('render exploded');
    spy.mockRestore();
  });

  it('shows the source body when fallback includes a body', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ArtifactErrorBoundary body="<Button />">
        <BrokenChild />
      </ArtifactErrorBoundary>,
    );
    const btn = container.querySelector(
      '[data-pgx="show-source-toggle"]',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    spy.mockRestore();
  });

  it('uses custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ArtifactErrorBoundary fallback={<div>custom</div>}>
        <BrokenChild />
      </ArtifactErrorBoundary>,
    );
    expect(container.textContent).toContain('custom');
    expect(container.textContent).not.toContain('render exploded');
    spy.mockRestore();
  });
});

describe('ShowSource (A.4)', () => {
  it('does not render panel when closed', () => {
    const { container } = render(
      <ShowSource body="<Button />">
        {(toggle) => <button onClick={toggle}>show</button>}
      </ShowSource>,
    );
    expect(container.querySelector('[data-pgx="ShowSource"]')).toBeNull();
  });

  it('renders panel after toggle', () => {
    const { container } = render(
      <ShowSource body="<Button />" language="tsx">
        {(toggle) => <button onClick={toggle}>show</button>}
      </ShowSource>,
    );
    const btn = container.querySelector('button')!;
    act(() => {
      btn.click();
    });
    const pre = container.querySelector('[data-pgx="ShowSource"]')!;
    expect(pre).toBeTruthy();
    expect(pre.textContent).toContain('<Button />');
    expect(pre.getAttribute('data-language')).toBe('tsx');
  });
});

describe('createRegistry (A.5)', () => {
  it('returns the default registry with no overrides', () => {
    const map = createRegistry({});
    expect(Object.keys(map).sort()).toEqual(
      Object.keys(componentMap).sort(),
    );
    expect(map['Button']).toBe(Button);
  });

  it('adds an override and preserves defaults', () => {
    const Stub = () => null;
    const map = createRegistry({ MathJax: Stub });
    expect(map['MathJax']).toBe(Stub);
    expect(map['Button']).toBe(Button);
  });

  it('returns a frozen map', () => {
    const map = createRegistry({});
    expect(Object.isFrozen(map)).toBe(true);
  });

  it('does not affect lowercase HTML tag passthrough', () => {
    // The plan: lowercase tags are handled by renderBody intrinsically;
    // createRegistry does NOT include them. We document the contract by
    // asserting the returned map never contains any lowercase key.
    const map = createRegistry({ div: () => null });
    for (const key of Object.keys(map)) {
      expect(key[0]).toEqual(key[0]!.toUpperCase());
    }
    // div is intentionally NOT in the result — renderBody has its own
    // passthrough for lowercase tags that bypasses this map.
    expect(map['div']).toBeUndefined();
  });
});
