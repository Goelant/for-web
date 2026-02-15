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

## Plugins

The client supports loading plugins at runtime. Drop a `.js` file into `packages/client/public/plugins/` and it will be picked up automatically (the manifest is generated at build time by Vite).

Plugins are standard ES modules that export a default object with a `name` and a `setup` function:

```js
export default {
  name: "my-plugin",
  setup(api) {
    // api.registerClientResolver(fn)  — resolve a Client for a given entity ID
    // api.registerServerProvider(fn)   — provide extra servers to show in the sidebar
    // api.registerSidebarAction(action) — add a button to the server list
    // api.storage                      — namespaced localStorage wrapper
    // api.getClient()                  — get the primary Client instance
  },
};
```

Shared dependencies (Solid.js, stoat.js, UI components, etc.) are exposed on `window.__STOAT__` so plugins don't need to bundle them. See `packages/multi-instance/` for a full example — it adds multi-instance support as a standalone plugin built with Vite's library mode.

### Building a plugin

```bash
# build the multi-instance plugin as an example
pnpm --filter multi-instance exec vite build

# copy the output to the plugins folder
cp packages/multi-instance/dist/multi-instance.js packages/client/public/plugins/
```
