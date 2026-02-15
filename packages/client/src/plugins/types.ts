import type { Component, JSX } from "solid-js";
import type { Client } from "stoat.js";

/**
 * A component that wraps the Interface content (sidebar + route content).
 * Multiple wrappers nest (first registered = outermost).
 */
export type InterfaceWrapper = Component<{ children: JSX.Element }>;

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
 * A plugin-owned page rendered at /ext/:pageId.
 */
export interface ContentPage {
  /** Unique route id (used in /ext/:pageId) */
  id: string;
  /** Component rendered in the main content area */
  component: Component;
}

/**
 * The API object passed to plugin.setup().
 */
export interface PluginAPI {
  /** Register a component that wraps the Interface content */
  registerInterfaceWrapper(wrapper: InterfaceWrapper): void;

  /** Register a sidebar action button */
  registerSidebarAction(action: SidebarAction): void;

  /** Register a plugin-owned page at /ext/:pageId */
  registerContentPage(page: ContentPage): void;

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
