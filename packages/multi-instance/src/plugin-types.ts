/**
 * Minimal type definitions for the plugin API.
 * These mirror the types from the base app's plugin system.
 */
import type { Client, Server } from "stoat.js";

export type ClientResolver = (entityId: string) => Client | undefined;
export type ServerProvider = () => Server[];

export interface SidebarAction {
  icon: () => unknown;
  tooltip: string;
  onClick: () => void;
}

export interface PluginStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface PluginAPI {
  registerClientResolver(fn: ClientResolver): void;
  registerServerProvider(fn: ServerProvider): void;
  registerSidebarAction(action: SidebarAction): void;
  storage: PluginStorage;
  getClient(): Client;
}

export interface StoatPlugin {
  name: string;
  version?: string;
  setup(api: PluginAPI): void | Promise<void>;
}
