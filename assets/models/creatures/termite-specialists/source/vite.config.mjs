import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        models: resolve(import.meta.dirname,"index.html"),
        ecosystem: resolve(import.meta.dirname,"interaction.html"),
      }
    }
  }
});