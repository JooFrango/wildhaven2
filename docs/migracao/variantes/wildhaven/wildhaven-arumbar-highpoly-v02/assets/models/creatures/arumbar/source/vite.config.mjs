import {defineConfig} from "vite";
import {resolve} from "node:path";
export default defineConfig({build:{rollupOptions:{input:{studio:resolve(import.meta.dirname,"index.html"),highpoly:resolve(import.meta.dirname,"index-v02.html")}}}});
