import { createContext, useContext, type JSX, type JSXElement } from "solid-js";
import { createStore } from "solid-js/store";

import type {
  InterfaceWrapper,
  SidebarAction,
} from "./types";

export interface PluginState {
  interfaceWrappers: InterfaceWrapper[];
  sidebarEntries: (() => JSX.Element)[];
  sidebarActions: SidebarAction[];
  loaded: string[];
}

const PluginContext = createContext<PluginState>();

/**
 * Access plugin state from any component.
 */
export function usePlugins(): PluginState | undefined {
  return useContext(PluginContext);
}

/**
 * Provider that wraps the app and holds all plugin registrations.
 */
export function PluginProvider(props: { children: JSXElement }) {
  const [state, setState] = createStore<PluginState>({
    interfaceWrappers: [],
    sidebarEntries: [],
    sidebarActions: [],
    loaded: [],
  });

  // Expose on window so the loader can register without needing the context
  (window as unknown as Record<string, unknown>).__STOAT_PLUGIN_STATE__ = {
    state,
    setState,
  };

  return (
    <PluginContext.Provider value={state}>
      {props.children}
    </PluginContext.Provider>
  );
}

/**
 * Wraps children with all registered interface wrappers.
 * First registered = outermost.
 */
export function PluginInterfaceWrappers(props: { children: JSX.Element }) {
  const plugins = usePlugins();
  if (!plugins || plugins.interfaceWrappers.length === 0) return props.children;

  // Fold: first registered = outermost
  let result = () => props.children;
  for (let i = plugins.interfaceWrappers.length - 1; i >= 0; i--) {
    const Wrapper = plugins.interfaceWrappers[i];
    const inner = result;
    result = () => <Wrapper>{inner()}</Wrapper>;
  }
  return result();
}
