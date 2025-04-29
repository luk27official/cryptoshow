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
        target: "http://localhost", // this is used only for development, so it can be localhost
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost",
        ws: true,
      }
    }
  },

  build: {
    sourcemap: true
  }
});