import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
  envPrefix: ["VITE_"],
  server: {
    host: true,
    port: 3000,
    strictPort: false,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro({
      // Lovable/CF Workers locally; Vercel when VERCEL=1 (platform injects this)
      preset: process.env.VERCEL ? "vercel" : "cloudflare-module",
      cloudflare: {
        nodeCompat: true,
        deployConfig: true,
      },
    }),
    viteReact(),
  ],
});
