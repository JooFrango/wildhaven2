import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        rocantraz: resolve(__dirname, "rocantraz.html"),
        detritivoros: resolve(__dirname, "creatures.html"),
      },
    },
  },
});
