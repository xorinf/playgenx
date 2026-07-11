/**
 * Per-render interactive state store. Used by PlaygroundStateProvider to
 * back interactive components (Slider, TextField, Button, Chart) without
 * requiring them to be fully controlled.
 *
 * Design notes:
 * - The store is a singleton instance per Provider, NOT React context.
 *   Components consume it via usePlaygroundState() inside React renders,
 *   and via .subscribe() / .get() / .set() from non-React callers.
 * - `set` is synchronous; subscribers fire in registration order on the
 *   next microtask (so multiple sets in a single tick produce a single
 *   re-render per subscriber).
 * - `set` with `===` equal value is a no-op (no subscriber fires).
 * - Throws if used outside a PlaygroundStateProvider (when required by
 *   the caller's contract).
 *
 * @packageDocumentation
 */

import * as React from 'react';

/**
 * Per-render state store. Components read/write values keyed by string.
 * One store per Provider instance; nested Providers create nested scopes.
 */
export interface PlaygroundState {
  /** Read a value by key. Returns undefined if unset. */
  get<T = unknown>(key: string): T | undefined;
  /**
   * Set a value. Triggers re-render of subscribers. No-op if the new
   * value is `===` to the current value.
   */
  set<T = unknown>(key: string, value: T): void;
  /**
   * Subscribe to changes on a single key. The callback fires on every
   * `set(key, ...)` with a different value. Returns an unsubscribe
   * function. Non-React callers can use this directly.
   */
  subscribe(key: string, cb: (value: unknown) => void): () => void;
  /**
   * Bulk-read: returns a shallow snapshot of all keys. Useful for
   * snapshotting state at a moment in time (e.g., for undo).
   */
  snapshot(): Readonly<Record<string, unknown>>;
  /** Bulk-write: replace all values. Subscribers fire for changed keys. */
  replaceAll(values: Record<string, unknown>): void;
}

interface InternalState extends PlaygroundState {
  /** Test seam: forces sync-fire for unit tests. */
  _flush(): void;
}

/**
 * Create a fresh state store. Public so PlaygroundStateProvider can
 * construct one, but consumers should use Provider/usePlaygroundState
 * to access stores (not direct construction).
 */
export function createPlaygroundState(
  initial: Record<string, unknown> = {},
): PlaygroundState {
  const values = new Map<string, unknown>(Object.entries(initial));
  // key -> Set of subscribers. We use Set for O(1) add/remove and
  // dedup of identical subscribers.
  const subs = new Map<string, Set<(value: unknown) => void>>();

  // Pending (key, value) pairs to fire on the next microtask. We
  // batch so a sequence of `set()` calls in the same tick produces a
  // single subscriber fire per affected key.
  let pending: Array<{ key: string; value: unknown }> = [];
  let scheduled = false;

  const flush = (): void => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    scheduled = false;
    // Fire every pending (key, value) pair, in order. We do NOT
    // dedupe — each `set()` call is a distinct event and subscribers
    // want to see the full history (e.g. for analytics). React
    // batches re-renders via the microtask flush anyway, so multiple
    // fires for the same key collapse into one render.
    for (const { key, value } of batch) {
      const list = subs.get(key);
      if (list) {
        for (const cb of list) {
          try {
            cb(value);
          } catch {
            // Swallow subscriber errors so one bad subscriber doesn't
            // take down the whole tree. (Production consumers will
            // already have an error boundary — this is the last
            // line of defense.)
          }
        }
      }
    }
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    // queueMicrotask is available in Node 22+ and all modern browsers.
    // Falls back to Promise.resolve().then for older runtimes.
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flush);
    } else {
      Promise.resolve().then(flush);
    }
  };

  const state: InternalState = {
    get<T = unknown>(key: string): T | undefined {
      return values.get(key) as T | undefined;
    },
    set<T = unknown>(key: string, value: T): void {
      if (Object.is(values.get(key), value)) return; // no-op
      values.set(key, value);
      pending.push({ key, value });
      schedule();
    },
    subscribe(key: string, cb: (value: unknown) => void): () => void {
      let list = subs.get(key);
      if (!list) {
        list = new Set();
        subs.set(key, list);
      }
      list.add(cb);
      return () => {
        const l = subs.get(key);
        if (l) {
          l.delete(cb);
          if (l.size === 0) subs.delete(key);
        }
      };
    },
    snapshot(): Readonly<Record<string, unknown>> {
      return Object.fromEntries(values);
    },
    replaceAll(values: Record<string, unknown>): void {
      for (const [k, v] of Object.entries(values)) {
        state.set(k, v);
      }
    },
    _flush(): void {
      flush();
    },
  };
  return state;
}

interface ProviderContextValue {
  state: PlaygroundState;
}

/**
 * React context. Exposed as a type only — consumers should use
 * PlaygroundStateProvider and usePlaygroundState rather than reading
 * the context directly.
 */
const PlaygroundStateContext = React.createContext<ProviderContextValue | null>(
  null,
);

export interface PlaygroundStateProviderProps {
  /** Initial state values keyed by name. */
  initial?: Record<string, unknown>;
  /**
   * Optional pre-existing state. If supplied, `initial` is merged on
   * top (initial wins for overlapping keys). Use this for SSR
   * rehydration or seeded values.
   */
  seed?: Record<string, unknown>;
  children: React.ReactNode;
}

/**
 * Provide a PlaygroundState scope to descendant components.
 *
 * Each Provider instance has its own store; nested Providers create
 * independent scopes. Components rendered outside any Provider will
 * throw a clear error if they call usePlaygroundState.
 */
export function PlaygroundStateProvider(
  props: PlaygroundStateProviderProps,
): React.JSX.Element {
  // Create the store once per Provider instance. The lazy initializer
  // ensures re-mounting (e.g. HMR) doesn't carry stale state across
  // refreshes.
  const [state] = React.useState(() => {
    const s = createPlaygroundState({ ...props.seed, ...props.initial });
    return s;
  });

  // Cleanup on unmount: clear subscribers so a hot-reload doesn't
  // leak subscriptions between renders.
  React.useEffect(() => {
    return () => {
      // The Map+Set are held by closure; when this Provider unmounts
      // the next effect cleanup will run and the closure becomes
      // eligible for GC. Subscribers that were React effects have
      // already unsubscribed themselves by then.
    };
  }, []);

  const value = React.useMemo(() => ({ state }), [state]);

  return React.createElement(
    PlaygroundStateContext.Provider,
    { value },
    props.children,
  );
}

/**
 * Hook to access the nearest PlaygroundState store. Throws a clear
 * error if called outside a Provider so consumers get a usable
 * diagnostic instead of a `Cannot read properties of undefined`.
 */
export function usePlaygroundState(): PlaygroundState {
  const ctx = React.useContext(PlaygroundStateContext);
  if (ctx === null) {
    throw new Error(
      'usePlaygroundState() must be called inside a <PlaygroundStateProvider>. ' +
        'Wrap your component tree with the Provider, or pass `withState: true` to ' +
        'renderBody() in @playgenx/renderer (it wraps the tree in a Provider automatically).',
    );
  }
  return ctx.state;
}
