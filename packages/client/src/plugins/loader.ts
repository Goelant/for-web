import type { StoatPlugin, PluginAPI, PluginStorage } from "./types";
import type { Client } from "stoat.js";

/**
 * Plugins directory — absolute path from web root.
 * Drop .js files in public/plugins/ — like BetterDiscord's plugins folder.
 */
const base = import.meta.env.BASE_URL ?? "/";
const PLUGINS_DIR = `${base}plugins`;
const MANIFEST = `${PLUGINS_DIR}/plugins.json`;

/**
 * Create a per-plugin PluginStorage backed by localStorage.
 */
function createPluginStorage(pluginName: string): PluginStorage {
  const prefix = `stoat-plugin:${pluginName}:`;
  return {
    get<T>(key: string): T | undefined {
      const raw = localStorage.getItem(prefix + key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    set<T>(key: string, value: T): void {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    },
    remove(key: string): void {
      localStorage.removeItem(prefix + key);
    },
  };
}

/**
 * Create a PluginAPI for a specific plugin.
 */
function createPluginAPI(
  pluginName: string,
  getClient: () => Client,
): PluginAPI {
  const { setState } = (
    window as unknown as Record<string, { state: unknown; setState: Function }>
  ).__STOAT_PLUGIN_STATE__;

  return {
    registerClientResolver(fn) {
      setState("clientResolvers", (prev: unknown[]) => [...prev, fn]);
    },
    registerServerProvider(fn) {
      setState("serverProviders", (prev: unknown[]) => [...prev, fn]);
    },
    registerSidebarAction(action) {
      setState("sidebarActions", (prev: unknown[]) => [...prev, action]);
    },
    storage: createPluginStorage(pluginName),
    getClient,
  };
}

/**
 * Load all plugins from the plugins/ directory.
 *
 * Reads plugins/plugins.json for the list of .js files to load.
 * Each plugin file must default-export a { name, setup } object.
 */
export async function loadPlugins(
  getClient: () => Client,
): Promise<void> {
  let files: string[];

  try {
    const res = await fetch(MANIFEST);
    if (!res.ok) {
      // No manifest = no plugins, that's fine
      if (res.status === 404) return;
      console.warn(`[plugins] Failed to fetch manifest: ${res.status}`);
      return;
    }
    files = await res.json();
  } catch {
    // No plugins directory or network error — silent
    return;
  }

  if (!Array.isArray(files) || files.length === 0) return;

  const { setState } = (
    window as unknown as Record<string, { state: unknown; setState: Function }>
  ).__STOAT_PLUGIN_STATE__;

  for (const file of files) {
    const url = `${PLUGINS_DIR}/${file}`;
    try {
      // Fetch + blob URL to bypass Vite's module interception in dev
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[plugins] Failed to fetch ${file}: ${res.status}`);
        continue;
      }
      const blob = new Blob([await res.text()], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      const module = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl);
      const plugin: StoatPlugin = module.default ?? module;

      if (!plugin.name || !plugin.setup) {
        console.warn(`[plugins] Invalid plugin ${file}: missing name/setup`);
        continue;
      }

      const api = createPluginAPI(plugin.name, getClient);
      await plugin.setup(api);
      setState("loaded", (prev: string[]) => [...prev, plugin.name]);
      console.info(`[plugins] Loaded: ${plugin.name}`);
    } catch (err) {
      console.error(`[plugins] Failed to load ${file}:`, err);
    }
  }
}
