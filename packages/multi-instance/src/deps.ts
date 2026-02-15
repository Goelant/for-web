/**
 * Dependency shims: pull shared deps from window.__STOAT__
 * so this plugin doesn't bundle its own Solid.js / UI components.
 */
const S = (window as Record<string, unknown>).__STOAT__ as Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

// Re-export Solid.js primitives from the host app
export const {
  createSignal,
  createMemo,
  createContext,
  useContext,
  onMount,
  onCleanup,
  For,
  Show,
  Match,
  Switch,
} = S["solid-js"] as typeof import("solid-js");

export const { createStore } =
  S["solid-js/store"] as typeof import("solid-js/store");
