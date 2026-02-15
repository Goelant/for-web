import { createContext, useContext, type JSXElement } from "solid-js";
import { createStore } from "solid-js/store";

import type { Client, Server } from "stoat.js";

import type {
  ClientResolver,
  ServerProvider,
  SidebarAction,
} from "./types";

export interface PluginState {
  clientResolvers: ClientResolver[];
  serverProviders: ServerProvider[];
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
    clientResolvers: [],
    serverProviders: [],
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
 * Resolve an entity ID (server or channel) to a Client
 * using all registered plugin resolvers.
 */
export function resolveClientFromPlugins(
  state: PluginState | undefined,
  entityId: string,
): Client | undefined {
  if (!state) return undefined;
  for (const resolver of state.clientResolvers) {
    const client = resolver(entityId);
    if (client) return client;
  }
  return undefined;
}

/**
 * Get all extra servers from all plugins.
 */
export function getAllPluginServers(
  state: PluginState | undefined,
): Server[] {
  if (!state) return [];
  const servers: Server[] = [];
  for (const provider of state.serverProviders) {
    servers.push(...provider());
  }
  return servers;
}
