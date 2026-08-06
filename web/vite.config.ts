import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the UI on 5173 and proxies /api to the Express server on 3001.
// Prod: `vite build` emits web/dist, which the Express server serves directly.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: { "/api": "http://localhost:3001" },
  },
});
