import * as solidJs from "solid-js";
import * as solidJsStore from "solid-js/store";
import * as solidJsWeb from "solid-js/web";

/**
 * Expose shared dependencies on window.__STOAT__ so plugins
 * can use them without bundling their own copies.
 *
 * CRITICAL: plugins MUST use the same Solid.js runtime as the base app,
 * otherwise reactivity breaks.
 */
export function exposeSharedDependencies(): void {
  const stoat = ((window as Record<string, unknown>).__STOAT__ ??= {}) as Record<
    string,
    unknown
  >;

  // Core Solid.js
  stoat["solid-js"] = solidJs;
  stoat["solid-js/store"] = solidJsStore;
  stoat["solid-js/web"] = solidJsWeb;
}

/**
 * Expose UI and app modules. Called after they are available.
 */
export function exposeAppModules(modules: Record<string, unknown>): void {
  const stoat = ((window as Record<string, unknown>).__STOAT__ ??= {}) as Record<
    string,
    unknown
  >;
  Object.assign(stoat, modules);
}
