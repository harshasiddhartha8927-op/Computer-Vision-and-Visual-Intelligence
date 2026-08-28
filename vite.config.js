import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { sendGeminiAnalysis } from "./server/gemini.js";

function geminiApiPlugin(env) {
  return {
    name: "traffic-gemini-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze-traffic", async (req, res) => {
        await sendGeminiAnalysis(req, res, { ...process.env, ...env });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), geminiApiPlugin(env)],
    server: {
      port: 5173
    }
  };
});
