import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sentryVitePlugin({
    org: process.env.VITE_SENTRY_ORG,
    project: process.env.VITE_SENTRY_PROJECT
  })],

  server: {
    port: 3000,
    proxy: {
      "/api": {
        // Host port of the backend container. Nginx normally strips this prefix.
        target: "http://localhost:5001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/ws": {
        target: "ws://localhost:5001",
        ws: true,
      }
    }
  },

  build: {
    sourcemap: true
  }
});