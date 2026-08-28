import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend-only Vite config.
// During dev, all /api/* requests are proxied to the backend (localhost:5000).
// In production, set VITE_API_BASE_URL to your deployed backend URL and the
// frontend build will hit that origin directly via the aiAnalysisService fetch.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
