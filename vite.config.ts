import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    strictPort: false, // Try next available port if 5173 is taken
  },
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d"],
  },
});
