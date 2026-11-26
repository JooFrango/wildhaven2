import {defineConfig} from "vite";
import {resolve} from "node:path";
export default defineConfig({build:{rollupOptions:{input:{inspector:resolve(import.meta.dirname,"index.html")}}}});
