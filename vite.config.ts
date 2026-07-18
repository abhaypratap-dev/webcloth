import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// "node-server" for local dev/self-host; the deploy workflow sets
// NITRO_PRESET=azure-swa to produce Nitro's Azure Static Web Apps output
// (static public/ + a managed Azure Functions app for SSR) instead.
const nitroPreset = process.env.NITRO_PRESET ?? "node-server";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // src/server.ts wraps SSR requests with a friendly error page.
    tanstackStart({ server: { entry: "server" } }),
    nitro({
      preset: nitroPreset,
      azure: {
        config: {
          globalHeaders: {
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "same-origin",
            "X-Frame-Options": "DENY",
          },
        },
      },
    }),
    viteReact(),
  ],
  server: {
    port: 8081,
    strictPort: true,
    host: "localhost",
  },
});
