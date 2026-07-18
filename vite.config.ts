import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // src/server.ts wraps SSR requests with a friendly error page.
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
  server: {
    port: 8081,
    strictPort: true,
    host: "localhost",
  },
});
