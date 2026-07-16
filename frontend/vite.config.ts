import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { defineConfig } from "vite";

const localConfigUrl = new URL("../var/vite.mjs", import.meta.url);
const localConfig = existsSync(localConfigUrl) ? (await import(localConfigUrl.href)).default : {};

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [...(localConfig.plugins ?? []), react()],
  server: {
    ...(localConfig.server ?? {}),
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  }
});
