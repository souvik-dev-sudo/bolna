import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only ever calls same-origin /api/* paths. In development Vite forwards them to
// the backends; in production nginx does the same, so the app code is identical in both.
//   /api/bolna/*     -> bolna-app  (agents, database, call websocket)
//   /api/telephony/* -> plivo-app  (placing calls, transfer, recordings)
const BOLNA_API_URL = process.env.BOLNA_API_URL ?? "http://localhost:5001";
const TELEPHONY_API_URL = process.env.TELEPHONY_API_URL ?? "http://localhost:8002";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // File events do not cross into Docker from this repo's NTFS (fuseblk) drive, so poll.
    watch: { usePolling: process.env.VITE_USE_POLLING === "true", interval: 300 },
    proxy: {
      "/api/bolna": {
        target: BOLNA_API_URL,
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api\/bolna/, ""),
      },
      "/api/telephony": {
        target: TELEPHONY_API_URL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/telephony/, ""),
      },
    },
  },
});
