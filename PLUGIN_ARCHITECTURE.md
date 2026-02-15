# Plugin System — Architecture & Implementation Reference

This document describes every modification made to the base codebase to support the runtime plugin system. It serves as a precise inventory of the implementation surface — useful for code review, auditing, and future extension.

**Baseline commit:** `a113e217` (pre-plugin codebase)

---

## Overview

The plugin system touches **11 files** in the base app (`packages/client/`):

| Category | Files |
|---|---|
| **New files** (5) | `src/plugins/types.ts`, `src/plugins/context.tsx`, `src/plugins/expose.ts`, `src/plugins/loader.ts`, `src/plugins/index.ts` |
| **Modified files** (6) | `src/index.tsx`, `src/Interface.tsx`, `src/interface/Sidebar.tsx`, `src/interface/navigation/servers/ServerList.tsx`, `components/client/index.tsx`, `vite.config.ts` |

Total diff: **+437 lines, −57 lines** (base app only, excluding `packages/multi-instance/`, `README.md`, and `public/plugins/` assets).

---

## New files: `src/plugins/`

### `types.ts` (+52 lines)

Defines the plugin contract:

- **`InterfaceWrapper`** — `Component<{ children: JSX.Element }>`. A component that wraps the main layout; plugins use this to override contexts (e.g. client context).
- **`SidebarAction`** — `{ icon, tooltip, onClick }`. A button injected into the server list.
- **`PluginStorage`** — Per-plugin key/value store backed by `localStorage`.
- **`PluginAPI`** — The API object passed to `plugin.setup()`:
  - `registerInterfaceWrapper(wrapper)`
  - `registerSidebarAction(action)`
  - `storage: PluginStorage`
  - `getClient(): Client`
- **`StoatPlugin`** — What a plugin must export: `{ name, version?, setup(api) }`.

### `context.tsx` (+65 lines)

Solid.js store + context for plugin state:

- **`PluginState`** — Store shape:
  - `interfaceWrappers: InterfaceWrapper[]`
  - `sidebarEntries: (() => JSX.Element)[]`
  - `sidebarActions: SidebarAction[]`
  - `loaded: string[]`
- **`PluginProvider`** — Context provider; also exposes `{ state, setState }` on `window.__STOAT_PLUGIN_STATE__` so the loader and plugins can mutate state from outside the component tree.
- **`usePlugins()`** — Hook to read plugin state from any component.
- **`PluginInterfaceWrappers`** — Component that nests all registered wrappers around its children (first registered = outermost).

### `expose.ts` (+33 lines)

Two functions that publish shared dependencies on `window.__STOAT__`:

- **`exposeSharedDependencies()`** — Publishes `solid-js`, `solid-js/store`, `solid-js/web`.
- **`exposeAppModules(modules)`** — Publishes app-level modules passed as a dictionary.

### `loader.ts` (+118 lines)

Plugin loading pipeline:

1. Fetches `public/plugins/plugins.json` (manifest).
2. For each `.js` file: fetches it, wraps in a Blob URL (bypasses Vite module interception in dev), dynamically imports.
3. Validates the module exports `name` and `setup`.
4. Creates a per-plugin `PluginAPI` via `createPluginAPI(pluginName, getClient)`.
5. Calls `plugin.setup(api)` and records the plugin name in state.
6. Errors are caught per-plugin — a broken plugin cannot crash the app.

### `index.ts` (+17 lines)

Barrel re-export for all plugin system exports.

---

## Modified files

### `src/index.tsx` (+72 lines, −15 lines)

The app entry point. Changes:

1. **New imports:**
   - `* as StoatJS` and `* as RevoltUI` (star imports to pass whole modules to plugins).
   - `clientContext` from `@revolt/client`.
   - `useSmartParams`, `useNavigate`, `useLocation` from `@revolt/routing`.
   - `entryContainer` from `./interface/navigation/servers/ServerList`.
   - `PluginProvider`, `loadPlugins`, `exposeSharedDependencies`, `exposeAppModules` from `./plugins`.

2. **New `PluginLoader` component** (~20 lines) — Runs on mount:
   - Calls `exposeSharedDependencies()`.
   - Calls `exposeAppModules(...)` with the following modules:
     - `@revolt/ui` (full library)
     - `@revolt/client` (`useClient`, `clientContext`)
     - `@revolt/modal` (`useModals`)
     - `@revolt/routing` (`useSmartParams`, `useParams`, `useNavigate`, `useLocation`)
     - `@revolt/app/sidebar` (`entryContainer`)
     - `stoat.js` (full library)
   - Calls `loadPlugins(() => client())`.

3. **`MountContext` modified** — Wraps existing tree with `<PluginProvider>`. Adds `<PluginLoader />` inside the query client provider. Changes `FloatingManager` and `LoadTheme` references to use `RevoltUI.*` (consequence of the star import).

4. **Route structure** — The `/channel/:channel/*` route now uses a nested `<Route path="/*">` pattern instead of a direct `component` prop (structural cleanup, no behavioral change).

### `src/Interface.tsx` (+3 lines, −1 line)

Single change: wraps the `<Layout>` block with `<PluginInterfaceWrappers>`:

```tsx
<PluginInterfaceWrappers>
  <Layout ...>
    <Sidebar ... />
    <Content ...>{props.children}</Content>
  </Layout>
</PluginInterfaceWrappers>
```

This is the injection point where plugin interface wrappers take effect — they wrap both the sidebar and the route content.

### `src/interface/Sidebar.tsx` (+7 lines, −7 lines)

1. **`orderedServers()`** extracted into its own function (was inline in the JSX). Pure refactor, no plugin logic involved.
2. **`Server` component** — Minor refactor: adds a `serverId` null-check before calling `client()!.servers.get()`. No plugin-specific code — the plugin's interface wrapper handles client context overriding at a higher level.

### `src/interface/navigation/servers/ServerList.tsx` (+15 lines, −1 line)

1. **Imports `usePlugins`** from `../../../plugins/context`.
2. **Calls `usePlugins()`** to get plugin state.
3. **Renders `sidebarEntries`** — `<For each={plugins?.sidebarEntries}>{(Entry) => <Entry />}</For>` inserted after the `<Draggable>` server list and before the "Create or join" button.
4. **Renders `sidebarActions`** — `<For each={plugins?.sidebarActions}>` inserted after the "Create or join" button, rendering each action as a tooltip + avatar button.
5. **Exports `entryContainer`** — The CVA function is now `export const` instead of `const`, so plugins can import it via `window.__STOAT__["@revolt/app/sidebar"]` and render entries matching the sidebar's visual style.

### `components/client/index.tsx` (+6 lines)

Exports the existing `clientContext` with a doc comment. This was already created via `createContext()` but not exported — plugins need it to wrap subtrees with a different Client.

### `vite.config.ts` (+37 lines)

New `pluginsManifest()` Vite plugin:

- On `buildStart` and during dev server startup, scans `public/plugins/` for `.js` files and writes `plugins.json` automatically.
- Watches for file changes in dev mode and regenerates the manifest.
- Eliminates the need to manually maintain the manifest.

---

## Shared dependency surface (`window.__STOAT__`)

| Key | Exports |
|---|---|
| `solid-js` | `createSignal`, `createEffect`, `createMemo`, `onMount`, `Show`, `For`, ... |
| `solid-js/store` | `createStore`, `produce`, `reconcile`, `unwrap` |
| `solid-js/web` | `render`, `Portal`, `Dynamic`, ... |
| `stoat.js` | `Client`, `Server`, `Channel`, `User`, `Message`, `Collection`, ... |
| `@revolt/ui` | Full UI component library |
| `@revolt/client` | `useClient`, `clientContext` |
| `@revolt/modal` | `useModals` |
| `@revolt/routing` | `useSmartParams`, `useParams`, `useNavigate`, `useLocation` |
| `@revolt/app/sidebar` | `entryContainer` |

## Plugin state surface (`window.__STOAT_PLUGIN_STATE__`)

Exposes `{ state, setState }` from a Solid store. Plugins can mutate state directly:

```js
const { setState } = window.__STOAT_PLUGIN_STATE__;
setState("sidebarEntries", (prev) => [...prev, MyComponent]);
```

---

## Security considerations

- Plugins run in the **main browser context** — full DOM, `localStorage`, and authenticated `Client` access.
- **No sandboxing.** Only load plugins you trust.
- The Blob URL loading pattern avoids Vite module interception but does not add any isolation.
