# Stoat Plugin System

A lightweight plugin system that lets third-party `.js` files extend the Stoat client at runtime. Plugins are loaded from `public/plugins/` and have access to a controlled API for UI injection, routing, and client access.

## Quick start

1. Drop a compiled `.js` file into `packages/client/public/plugins/`.
2. The Vite `pluginsManifest` plugin auto-generates `plugins.json`, or add the filename manually:
   ```json
   ["my-plugin.js"]
   ```
3. Start the app. The plugin loads automatically after the client connects.

## Writing a plugin

A plugin must default-export an object implementing `StoatPlugin`:

```ts
interface StoatPlugin {
  name: string;
  version?: string;
  setup(api: PluginAPI): void | Promise<void>;
}
```

Example:

```ts
const plugin = {
  name: "hello-world",
  version: "1.0.0",
  setup(api) {
    api.registerSidebarAction({
      icon: () => "👋",
      tooltip: "Hello",
      onClick: () => alert("Hello from plugin!"),
    });
  },
};
export default plugin;
```

## Plugin API

The `PluginAPI` object is passed to `setup()` and provides the following methods:

### `registerInterfaceWrapper(wrapper)`

Register a SolidJS component that wraps the content area (channel sidebar + route content). Multiple wrappers nest — first registered = outermost.

```ts
type InterfaceWrapper = Component<{ children: JSX.Element }>;
```

The wrapper is rendered inside `<PluginInterfaceWrappers>`, which wraps:
- The main content area (`Interface.tsx` children)
- The server channel sidebar (`Sidebar.tsx` `<Server />` component)

It does **not** wrap the server list sidebar (which always uses the primary client).

Use cases: overriding `clientContext` for multi-instance support, adding global providers.

### `registerSidebarAction(action)`

Add a button to the server list sidebar.

```ts
interface SidebarAction {
  icon: () => JSX.Element;
  tooltip: string;
  onClick: () => void;
}
```

The button renders as a 42px Avatar with the icon as fallback, inside a Tooltip.

### `registerContentPage(page)`

Register a plugin-owned page rendered at `/ext/:pageId`.

```ts
interface ContentPage {
  id: string;          // unique route id
  component: Component; // rendered in the main content area
}
```

If no plugin claims a `pageId`, the user is redirected to `/`. The redirect only fires after all plugins have finished loading (`ready: true`).

### `registerChannelDecorator(decorator)`

Register a function that can inject JSX into channel headers. Called with the channel ID; return `null` if the decorator doesn't apply.

```ts
type ChannelDecorator = (channelId: string) => JSX.Element | null;
```

Currently rendered in the DM header (after the recipient's username). Multiple decorators are rendered in registration order.

### `storage`

Per-plugin key-value storage backed by `localStorage`. Keys are namespaced as `stoat-plugin:<pluginName>:<key>`.

```ts
interface PluginStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}
```

### `getClient()`

Returns the primary `Client` instance (same as `useClient()()` in the base app).

## Shared dependencies

Plugins must **not** bundle their own Solid.js — they must use the host app's runtime, otherwise reactivity breaks. The host exposes shared modules on `window.__STOAT__`:

| Module | Exposed by |
|---|---|
| `solid-js` | `exposeSharedDependencies()` |
| `solid-js/store` | `exposeSharedDependencies()` |
| `solid-js/web` | `exposeSharedDependencies()` |
| `@revolt/client` | `exposeAppModules()` |
| `@revolt/routing` | `exposeAppModules()` |
| `@revolt/ui` | `exposeAppModules()` |
| `@revolt/app/sidebar` | `exposeAppModules()` |
| `stoat.js` | `exposeAppModules()` |

Plugins access these via `window.__STOAT__["solid-js"]`, etc. Use a Vite `windowExternals` plugin to rewrite imports at build time.

## Plugin state

All plugin registrations are stored in a SolidJS store (`PluginState`) provided via `PluginContext`:

```ts
interface PluginState {
  interfaceWrappers: InterfaceWrapper[];
  sidebarEntries: (() => JSX.Element)[];
  sidebarActions: SidebarAction[];
  contentPages: ContentPage[];
  channelDecorators: ChannelDecorator[];
  loaded: string[];
  ready: boolean;
}
```

Components access this via `usePlugins()`. The store is also exposed on `window.__STOAT_PLUGIN_STATE__` so plugins can directly push sidebar entries without going through the API.

## Architecture

```
packages/client/src/plugins/
├── types.ts     # Type definitions (StoatPlugin, PluginAPI, etc.)
├── context.tsx  # PluginProvider, usePlugins(), PluginInterfaceWrappers, PluginContentPage
├── loader.ts    # loadPlugins() — fetches manifest, loads .js files, calls setup()
├── expose.ts    # exposeSharedDependencies(), exposeAppModules()
└── index.ts     # Re-exports
```

### Loading flow

1. `exposeSharedDependencies()` runs early to put Solid.js on `window.__STOAT__`
2. `exposeAppModules()` runs after app modules are available
3. `<PluginProvider>` wraps the app, creating the store and exposing it on `window.__STOAT_PLUGIN_STATE__`
4. `loadPlugins()` is called in `onMount`:
   - Fetches `plugins/plugins.json`
   - For each `.js` file: fetch, create blob URL, dynamic import, call `plugin.setup(api)`
   - Sets `ready: true` in a `finally` block

### Integration points in the host app

- **`Interface.tsx`**: `<PluginInterfaceWrappers>` wraps `{props.children}` inside the Content area
- **`Sidebar.tsx`**: `<PluginInterfaceWrappers>` wraps `<Server />` (channel sidebar for the selected server)
- **`ServerList.tsx`**: Renders `sidebarEntries` and `sidebarActions` from the plugin state
- **`ChannelHeader.tsx`**: Renders `channelDecorators` in the DM header
- **`index.tsx` (routes)**: `<Route path="/ext/:pageId/*">` renders `<PluginContentPage />`
- **`ProfileActions.tsx`** / **`UserContextMenu.tsx`**: DM navigation uses `channel.path` (not `channel.url`) for cross-instance compatibility

## SolidJS pitfalls for plugin authors

- **Component bodies run once.** Don't use `if/return` at the top level for reactive logic — use `<Show>`, `<Switch>`, or wrap logic in a function called inside JSX.
- **Context Provider values are not reactive.** If you provide a value via `<Provider value={...}>`, it's read once. Use a stable Proxy or a getter-based pattern for reactive resolution.
- **Plugin loading is async.** Components that depend on plugin state must handle the case where plugins haven't loaded yet. The `ready` flag indicates when loading is complete.
