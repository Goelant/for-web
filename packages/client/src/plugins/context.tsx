import { Match, Switch, createContext, useContext, type JSX, type JSXElement } from "solid-js";
import { createStore } from "solid-js/store";

import { useParams } from "@revolt/routing";
import { Navigate } from "@revolt/routing";

import type {
  ContentPage,
  InterfaceWrapper,
  SidebarAction,
} from "./types";

export interface PluginState {
  interfaceWrappers: InterfaceWrapper[];
  sidebarEntries: (() => JSX.Element)[];
  sidebarActions: SidebarAction[];
  contentPages: ContentPage[];
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
    contentPages: [],
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

/**
 * Renders a plugin-owned content page based on the :pageId route param.
 * Falls back to redirecting to / if no plugin claims the page.
 */
export function PluginContentPage() {
  const params = useParams<{ pageId: string }>();
  const plugins = usePlugins();

  const page = () => plugins?.contentPages.find((p) => p.id === params.pageId);

  return (
    <Switch fallback={<Navigate href="/" />}>
      <Match when={page()}>
        {(p) => {
          const Page = p().component;
          return <Page />;
        }}
      </Match>
    </Switch>
  );
}
