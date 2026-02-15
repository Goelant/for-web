import { lingui as linguiSolidPlugin } from "@lingui-solid/vite-plugin";
import devtools from "@solid-devtools/transform";
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import babelMacrosPlugin from "vite-plugin-babel-macros";
import Inspect from "vite-plugin-inspect";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import solidSvg from "vite-plugin-solid-svg";

import codegenPlugin from "./codegen.plugin";

/**
 * Auto-generates public/plugins/plugins.json from *.js files in the folder.
 * Just drop a .js file in public/plugins/ — no manual manifest needed.
 */
function pluginsManifest(): Plugin {
  const pluginsDir = resolve(__dirname, "public/plugins");

  function generate() {
    if (!existsSync(pluginsDir)) mkdirSync(pluginsDir, { recursive: true });
    const files = readdirSync(pluginsDir).filter(
      (f) => f.endsWith(".js") && f !== "plugins.json",
    );
    writeFileSync(join(pluginsDir, "plugins.json"), JSON.stringify(files));
  }

  return {
    name: "plugins-manifest",
    buildStart: generate,
    configureServer(server) {
      // Regenerate on file changes in public/plugins/
      server.watcher.on("all", (_event, path) => {
        if (path.startsWith(pluginsDir) && path.endsWith(".js")) {
          generate();
        }
      });
      generate();
    },
  };
}

const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    pluginsManifest(),
    Inspect(),
    devtools(),
    codegenPlugin(),
    babelMacrosPlugin(),
    linguiSolidPlugin(),
    solidPlugin(),
    solidSvg({
      defaultAsComponent: false,
    }),
    VitePWA({
      srcDir: "src",
      registerType: "autoUpdate",
      filename: "serviceWorker.ts",
      strategies: "injectManifest",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000,
      },
      manifest: {
        name: "Stoat",
        short_name: "Stoat",
        description: "User-first open source chat platform.",
        categories: ["communication", "chat", "messaging"],
        start_url: base,
        orientation: "portrait",
        display_override: ["window-controls-overlay"],
        display: "standalone",
        background_color: "#101823",
        theme_color: "#101823",
        icons: [
          {
            src: `${base}assets/web/android-chrome-192x192.png`,
            type: "image/png",
            sizes: "192x192",
          },
          {
            src: `${base}assets/web/android-chrome-512x512.png`,
            type: "image/png",
            sizes: "512x512",
          },
          {
            src: `${base}assets/web/monochrome.svg`,
            type: "image/svg+xml",
            sizes: "48x48 72x72 96x96 128x128 256x256",
            purpose: "monochrome",
          },
          {
            src: `${base}assets/web/masking-512x512.png`,
            type: "image/png",
            sizes: "512x512",
            purpose: "maskable",
          },
        ],
        // TODO: take advantage of shortcuts
      },
    }),
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      external: ["hast"],
    },
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["hast"],
  },
  resolve: {
    alias: {
      "styled-system": resolve(__dirname, "styled-system"),
      ...readdirSync(resolve(__dirname, "components")).reduce(
        (p, f) => ({
          ...p,
          [`@revolt/${f}`]: resolve(__dirname, "components", f),
        }),
        {},
      ),
    },
  },
});
