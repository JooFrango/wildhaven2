import { defineConfig } from "vite";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");
const server = process.env.WH_SERVER ?? "http://127.0.0.1:8787";

export default defineConfig({
  resolve: { alias: { "@continental": resolve(repoRoot, "build real/continental/src") } },
  server: {
    fs: { allow: [repoRoot] },
    proxy: {
      "/api/v1/stream": { target: server.replace(/^http/, "ws"), ws: true },
      "/api": server,
      "/glb": server,
      "/physics": server,
    },
  },
  // V04.2: o laboratório WebGL × WebGPU sai como página separada (lab/webgpu.html); o jogo não o importa
  build: { outDir: "dist", assetsDir: "static", emptyOutDir: true, chunkSizeWarningLimit: 900, rollupOptions: { input: { main: resolve(__dirname, "index.html"), labWebgpu: resolve(__dirname, "lab/webgpu.html") } } },
});
