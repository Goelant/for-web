import type { JSX } from "solid-js";
import type { Client, Server } from "stoat.js";

/**
 * A client resolver: given an entity ID (server or channel),
 * return the Client that owns it, or undefined.
 */
export type ClientResolver = (entityId: string) => Client | undefined;

/**
 * A server provider: return additional servers to show in the sidebar.
 */
export type ServerProvider = () => Server[];

/**
 * A sidebar action button injected by a plugin.
 */
export interface SidebarAction {
  icon: () => JSX.Element;
  tooltip: string;
  onClick: () => void;
}

/**
 * Per-plugin key-value storage backed by localStorage.
 */
export interface PluginStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

/**
 * The API object passed to plugin.setup().
 */
export interface PluginAPI {
  /** Register a function that resolves entity IDs to Clients */
  registerClientResolver(fn: ClientResolver): void;

  /** Register a function that provides additional servers for the sidebar */
  registerServerProvider(fn: ServerProvider): void;

  /** Register a sidebar action button */
  registerSidebarAction(action: SidebarAction): void;

  /** Per-plugin persistent storage */
  storage: PluginStorage;

  /** Access the primary client (same as useClient() in the base app) */
  getClient(): Client;
}

/**
 * What a plugin module must default-export.
 */
export interface StoatPlugin {
  name: string;
  version?: string;
  setup(api: PluginAPI): void | Promise<void>;
}
