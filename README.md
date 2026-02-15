<div align="center">
<h1>
  Stoat Frontend
  
  [![Stars](https://img.shields.io/github/stars/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/stargazers)
  [![Forks](https://img.shields.io/github/forks/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/network/members)
  [![Pull Requests](https://img.shields.io/github/issues-pr/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/pulls)
  [![Issues](https://img.shields.io/github/issues/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/issues)
  [![Contributors](https://img.shields.io/github/contributors/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/graphs/contributors)
  [![License](https://img.shields.io/github/license/stoatchat/for-web?style=flat-square&logoColor=white)](https://github.com/stoatchat/for-web/blob/main/LICENSE)
</h1>
The official web client powering https://stoat.chat/app, built with <a href="https://www.solidjs.com/">Solid.js</a> 💖. <br/>
Track the project roadmap on <a href="https://op.stoatinternal.com/projects/revolt-for-web/roadmap">OpenProject</a>.
</div>
<br/>

## Development Guide

Before contributing, make yourself familiar with [our contribution guidelines](https://developers.stoat.chat/developing/contrib/), the [code style guidelines](./GUIDELINES.md), and the [technical documentation for this project](https://stoatchat.github.io/for-web/).

Before getting started, you'll want to install:

- Git
- mise-en-place

Then proceed to setup:

```bash
# clone the repository
git clone --recursive https://github.com/stoatchat/for-web client
cd client

# update submodules if you pull new changes
# git submodule init && git submodule update

# install all packages
mise install:frozen

# build deps:
mise build:deps

# or build a specific dep (e.g. stoat.js updates):
# pnpm --filter stoat.js run build

# customise the .env
cp packages/client/.env.example packages/client/.env

# run dev server
mise dev

# run all CI checks locally
mise check
```

Finally, navigate to http://local.revolt.chat:5173.

### Pulling in Stoat's brand assets

If you want to pull in Stoat brand assets after pulling, run the following:

```bash
# update the assets
git -c submodule."packages/client/assets".update=checkout submodule update --init packages/client/assets
```

You can switch back to the fallback assets by running deinit and continuing as normal:

```bash
# deinit submodule which clears directory
git submodule deinit packages/client/assets
```

## Deployment Guide

### Build the app

```bash
# install packages
mise install:frozen

# build dependencies
mise build:deps

# build for web
mise build

# ... when building for Stoat production
mise build:prod
```

You can now deploy the directory `packages/client/dist`.

### Routing Information

The app currently needs the following routes:

- `/login`
- `/pwa`
- `/dev`
- `/discover`
- `/settings`
- `/invite`
- `/bot`
- `/friends`
- `/server`
- `/channel`

This corresponds to [Content.tsx#L33](packages/client/src/index.tsx).

## Plugin System

This forked client supports loading plugins at runtime. Drop a `.js` file into `packages/client/public/plugins/` and it will be picked up automatically (the manifest is generated at build time by Vite).
> For a detailed inventory of every file modified and the exact implementation surface, see [PLUGIN_ARCHITECTURE.md](./PLUGIN_ARCHITECTURE.md).

The client ships with a runtime plugin system that lets you extend the UI and behaviour without touching the core codebase. Plugins are plain ES modules loaded at startup from the `packages/client/public/plugins/` directory.

> **Security:** Plugins run in the main browser context with full access to the DOM, `localStorage`, and the authenticated `Client` instance. **Only load plugins you trust.** There is no sandboxing.

### How it works

1. On mount the app reads `public/plugins/plugins.json` — a JSON array of `.js` filenames.
2. Each file is fetched, wrapped in a Blob URL (to bypass Vite's module interception during development), and dynamically imported.
3. The module must default-export (or export at the top level) an object matching the `StoatPlugin` interface.
4. The loader calls `plugin.setup(api)` once, passing a per-plugin `PluginAPI` object.
5. The plugin name is recorded and logged to the console.

Errors are caught per-plugin so a broken plugin cannot take down the app.

### Plugin loading internals

The loading logic lives in `packages/client/src/plugins/` and is wired into the app entry point (`packages/client/src/index.tsx`). Here is what each file does:

| File | Role |
|---|---|
| `types.ts` | TypeScript interfaces (`StoatPlugin`, `PluginAPI`, `SidebarAction`, `PluginStorage`, …). |
| `expose.ts` | Exposes Solid.js and app modules on `window.__STOAT__` so plugins can import them at runtime. |
| `context.tsx` | A Solid store (`PluginState`) that holds everything plugins have registered (sidebar actions, interface wrappers, sidebar entries). Also exposes the store on `window.__STOAT_PLUGIN_STATE__` so the loader and plugins can mutate it from outside the component tree. Provides `PluginInterfaceWrappers` — a component that nests all registered interface wrappers around the app's main layout. |
| `loader.ts` | Fetches the manifest, loads each `.js` file, validates it, creates a per-plugin `PluginAPI`, and calls `setup()`. |
| `index.ts` | Barrel re-export consumed by the app entry point. |

**In `index.tsx`** the app does the following on mount:

1. `exposeSharedDependencies()` — publishes `solid-js`, `solid-js/store`, `solid-js/web` to `window.__STOAT__`.
2. `exposeAppModules(…)` — publishes `@revolt/ui`, `@revolt/client`, `@revolt/modal`, `@revolt/routing`, `@revolt/app/sidebar`, and `stoat.js`.
3. `loadPlugins(getClient)` — reads the manifest and boots every plugin.

The `<PluginProvider>` wraps the entire app so any component can call `usePlugins()` to read the plugin state (e.g. `ServerList.tsx` iterates `sidebarActions` to render extra buttons).


#### What a plugin file must export

Every `.js` file listed in the manifest must default-export an object matching this contract:

```ts
interface StoatPlugin {
  name: string;                               // unique identifier
  version?: string;                           // optional, informational only
  setup(api: PluginAPI): void | Promise<void>;
}
```

The loader validates that `name` and `setup` exist before calling anything — if either is missing the file is skipped with a console warning. `setup` is the single lifecycle hook: it runs once, receives the `PluginAPI`, and that is where the plugin registers everything it needs.

### Plugin API

The `api` object passed to `setup()` exposes the following:

| Method / Property | Description |
|---|---|
| `registerInterfaceWrapper(wrapper)` | Register a component that wraps the main Interface content (sidebar + route content). Applied inside `Interface.tsx` around `<Layout>`. Multiple wrappers nest (first registered = outermost). Useful for overriding contexts (e.g. client context), providing theme contexts, etc. `wrapper` signature: `Component<{ children: JSX.Element }>`. |
| `registerSidebarAction(action)` | Add a button to the server list sidebar. `action` is `{ icon: () => JSX.Element, tooltip: string, onClick: () => void }`. |
| `storage` | Per-plugin key/value store backed by `localStorage` (keys are prefixed with `stoat-plugin:<name>:`). Methods: `get<T>(key): T \| undefined`, `set<T>(key, value)`, `remove(key)`. |
| `getClient()` | Returns the primary `Client` instance (same as `useClient()` inside the app). |

### Direct store access

In addition to the API methods above, plugins can access the plugin state store directly via `window.__STOAT_PLUGIN_STATE__` to push custom sidebar entries:

```js
const { setState } = window.__STOAT_PLUGIN_STATE__;

// Add a custom sidebar entry (rendered in the server list area)
setState("sidebarEntries", (prev) => [...prev, () => <MyCustomEntry />]);
```

The `sidebarEntries` array holds render functions `(() => JSX.Element)[]`. Each function is called in the server list area, giving plugins full control over what they render (servers, folders, buttons, separators, etc.) using `@revolt/ui` components from `window.__STOAT__`.

### Shared dependencies (`window.__STOAT__`)

Plugins **must not** bundle their own copy of Solid.js — using a second instance breaks reactivity. Instead the app exposes all shared dependencies on `window.__STOAT__`:

| Key | What it provides |
|---|---|
| `solid-js` | `createSignal`, `createEffect`, `createMemo`, `onMount`, `Show`, `For`, ... |
| `solid-js/store` | `createStore`, `produce`, `reconcile`, `unwrap` |
| `solid-js/web` | `render`, `Portal`, `Dynamic`, `template`, `delegateEvents`, ... |
| `stoat.js` | `Client`, `Server`, `Channel`, `User`, `Message`, `Collection`, ... |
| `@revolt/ui` | The full UI component library (Avatar, Button, Dialog, IconButton, Text, TextField, ...) |
| `@revolt/client` | `useClient`, `clientContext` |
| `@revolt/modal` | `useModals` |
| `@revolt/routing` | `useSmartParams`, `useParams`, `useNavigate`, `useLocation` |
| `@revolt/app/sidebar` | `entryContainer` CVA (for rendering entries that match the sidebar visual style) |

In your plugin code you access them like this:

```js
const { createSignal, onCleanup } = window.__STOAT__["solid-js"];
const { render, Portal } = window.__STOAT__["solid-js/web"];
```

If you use a bundler (Vite, Rollup, esbuild, ...) you can externalize these imports so bare `import { createSignal } from "solid-js"` statements are rewritten to `window.__STOAT__` lookups at build time (see the multi-instance plugin's `vite.config.ts` for a working example of this pattern).

### Styling

The app uses Material Design 3 CSS custom properties. Plugins can use them for consistent theming:

```
--md-sys-color-primary / --md-sys-color-on-primary
--md-sys-color-surface-container / --md-sys-color-surface-container-high
--md-sys-color-outline
--md-sys-color-error / --md-sys-color-on-error
```

### Hello World example

Below is a minimal plugin that adds a sidebar button. Clicking it opens a modal that says "Hello World".

Create a file `packages/client/public/plugins/hello-world.js`:

<details>
<summary><code>hello-world.js</code> — click to expand</summary>

```js
// Access shared Solid.js — never bundle your own copy!
const { createSignal, createEffect } = window.__STOAT__["solid-js"];
const { render } = window.__STOAT__["solid-js/web"];

// ---------------------------------------------------------------------------
// Modal component (vanilla DOM + Solid reactivity)
// ---------------------------------------------------------------------------

/**
 * Mount a simple modal into the document body.
 *
 * @param {() => boolean} visible  Solid signal — true when the modal is open
 * @param {() => void}    close    Callback to close the modal
 */
function mountModal(visible, close) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  render(() => {
    // Style objects use MD3 CSS custom properties so the modal
    // automatically follows the app's current theme.

    const overlayStyle = () => ({
      display: visible() ? "flex" : "none",
      position: "fixed",
      inset: "0",
      "z-index": "9999",
      "align-items": "center",
      "justify-content": "center",
      background: "rgba(0, 0, 0, 0.5)",
    });

    const cardStyle = () => ({
      background: "var(--md-sys-color-surface-container-high, #2b2d31)",
      color: "var(--md-sys-color-on-surface, #fff)",
      "border-radius": "16px",
      padding: "32px",
      "min-width": "280px",
      "text-align": "center",
      "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
    });

    const buttonStyle = () => ({
      "margin-top": "20px",
      padding: "8px 24px",
      border: "none",
      "border-radius": "20px",
      background: "var(--md-sys-color-primary, #5865f2)",
      color: "var(--md-sys-color-on-primary, #fff)",
      cursor: "pointer",
      "font-size": "14px",
    });

    // Build the DOM tree imperatively.
    // createEffect re-runs whenever `visible()` changes.
    const el = document.createElement("div");

    createEffect(() => {
      Object.assign(el.style, overlayStyle());
      el.innerHTML = "";

      if (visible()) {
        const card = document.createElement("div");
        Object.assign(card.style, cardStyle());

        card.innerHTML =
          '<h2 style="margin:0 0 8px">Hello World</h2>' +
          '<p style="margin:0;opacity:0.8">This modal was created by a plugin!</p>';

        const btn = document.createElement("button");
        Object.assign(btn.style, buttonStyle());
        btn.textContent = "Close";
        btn.onclick = close;

        card.appendChild(btn);
        el.appendChild(card);
      }
    });

    return el;
  }, container);
}

// ---------------------------------------------------------------------------
// SVG icon for the sidebar button
// ---------------------------------------------------------------------------

function WaveIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "currentColor");
  svg.innerHTML =
    '<path d="M7 22V11l-2-2 1.4-1.4L8 9.2V6l2-2v7l5.15-5.15' +
    "a1.5 1.5 0 0 1 2.12 2.12L14 11.24l3.57-3.57a1.5 1.5 0 0 1 2.12" +
    " 2.12L15 14.36l2.69-2.69a1.5 1.5 0 0 1 2.12 2.12L14.5 19.1A6.5" +
    ' 6.5 0 0 1 10 22H7z"/>';
  return svg;
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default {
  name: "hello-world",
  version: "1.0.0",

  setup(api) {
    // Create a signal that controls modal visibility
    const [showModal, setShowModal] = createSignal(false);

    // Mount the modal into the DOM (hidden by default)
    mountModal(showModal, () => setShowModal(false));

    // Add a button to the sidebar server list
    api.registerSidebarAction({
      icon: () => WaveIcon(),
      tooltip: "Say Hello",
      onClick: () => setShowModal(true),
    });

    console.log("[hello-world] Plugin loaded!");
  },
};
```

</details>

Then register it in the manifest `packages/client/public/plugins/plugins.json`:

```json
["multi-instance.js", "hello-world.js"]
```

Start the dev server (`mise dev`) and you will see a new icon in the sidebar. Click it to open the Hello World modal.

### Building a larger plugin with Vite

The Hello World example above is a single `.js` file that uses `window.__STOAT__` directly — that works fine for small plugins. But when a plugin grows (multiple source files, TypeScript, JSX, npm dependencies, etc.) you want a proper bundler to:

- Compile **TypeScript / JSX** down to plain JS.
- Merge all your source files into a **single `.js` output** (the loader expects one file per plugin).
- **Rewrite bare imports** like `import { createSignal } from "solid-js"` so they read from `window.__STOAT__` at runtime instead of bundling a second copy of Solid (which would break reactivity).

Note that this is purely a **build-time concern for your own plugin's source code**, not part of the plugin system itself. Each plugin that uses a bundler needs its own Vite (or Rollup/esbuild) config to produce a single `.js` file with shared imports rewritten. The multi-instance plugin (`packages/multi-instance/vite.config.ts`) already solves this with Vite's library mode and a small custom Rollup plugin called `windowExternals` that rewrites `import … from "solid-js"` into `window.__STOAT__["solid-js"]` lookups. Feel free to copy that config as a starting point for your own plugin.

Build and deploy:

```bash
# build (replace "multi-instance" with your package name)
pnpm --filter multi-instance exec vite build

# copy the output to the plugins folder
cp packages/multi-instance/dist/multi-instance.js packages/client/public/plugins/

# make sure the filename is listed in the manifest
# packages/client/public/plugins/plugins.json → ["multi-instance.js"]
```

