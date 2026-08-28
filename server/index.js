import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createSession,
  endSession,
  getSessionAnalytics,
  logEmotionSample
} from "./db.js";
import { sendGeminiAnalysis } from "./gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;
const VALID_EMOTIONS = new Set(["Focused", "Tired", "Stressed", "Neutral"]);
const workshopsFilePath = path.join(__dirname, "..", "data", "workshops.json");

app.use(cors());
app.use(express.json({ limit: "110mb" }));

const readWorkshops = () => {
  const fileContents = fs.readFileSync(workshopsFilePath, "utf-8");
  const workshops = JSON.parse(fileContents);

  if (!Array.isArray(workshops)) {
    throw new Error("Workshop dataset must be an array.");
  }

  return workshops;
};

const escapeSvgText = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    };

    return entities[character] ?? character;
  });

const sendWorkshopPlaceholder = (res, workshop) => {
  const title = escapeSvgText(workshop?.title ?? "Workshop image");
  const category = escapeSvgText(workshop?.category ?? "Learning");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="100%" stop-color="#0d9488"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#bg)"/>
      <circle cx="980" cy="140" r="120" fill="rgba(255,255,255,0.12)"/>
      <circle cx="180" cy="580" r="180" fill="rgba(255,255,255,0.10)"/>
      <rect x="120" y="140" width="960" height="440" rx="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)"/>
      <rect x="180" y="220" width="290" height="200" rx="18" fill="rgba(255,255,255,0.18)"/>
      <rect x="520" y="220" width="500" height="24" rx="12" fill="rgba(255,255,255,0.72)"/>
      <rect x="520" y="274" width="400" height="18" rx="9" fill="rgba(255,255,255,0.46)"/>
      <rect x="520" y="322" width="430" height="18" rx="9" fill="rgba(255,255,255,0.46)"/>
      <rect x="520" y="370" width="250" height="18" rx="9" fill="rgba(255,255,255,0.46)"/>
      <text x="180" y="495" fill="#ffffff" font-family="Arial, sans-serif" font-size="42" font-weight="700">${category}</text>
      <text x="180" y="545" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="30">${title}</text>
    </svg>
  `.trim();

  res.set("Content-Type", "image/svg+xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(svg);
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "traffic-violation-intelligence-api" });
});

app.post("/api/analyze-traffic", async (req, res) => {
  await sendGeminiAnalysis(req, res);
});

app.get("/api/workshops", (req, res) => {
  try {
    const workshops = readWorkshops();
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : workshops.length;
    const items = workshops.slice(0, limit);

    res.json({
      ok: true,
      total: workshops.length,
      count: items.length,
      items
    });
  } catch (error) {
    console.error("Failed to load workshops", error);
    res.status(500).json({ ok: false, error: "Unable to load workshop data right now." });
  }
});

app.get("/api/workshops/:workshopId/image", async (req, res) => {
  const workshop = readWorkshops().find((item) => item.id === req.params.workshopId);

  if (!workshop) {
    res.status(404).json({ ok: false, error: "Workshop not found." });
    return;
  }

  try {
    const imageResponse = await fetch(workshop.image, {
      headers: { accept: "image/*" }
    });

    if (!imageResponse.ok) {
      sendWorkshopPlaceholder(res, workshop);
      return;
    }

    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(imageBuffer);
  } catch (error) {
    console.error("Failed to proxy workshop image", error);
    sendWorkshopPlaceholder(res, workshop);
  }
});

app.post("/api/session/start", (_req, res) => {
  const sessionId = randomUUID();
  const session = createSession(sessionId);
  res.status(201).json({ sessionId, ...session, analytics: getSessionAnalytics(sessionId) });
});

app.post("/api/session/:sessionId/log", (req, res) => {
  const { sessionId } = req.params;
  const { emotion, confidence = 0.5, detectedAt, metrics = {} } = req.body ?? {};

  if (!VALID_EMOTIONS.has(emotion)) {
    res.status(400).json({ error: "Emotion must be one of Focused, Tired, Stressed, or Neutral." });
    return;
  }

  const analytics = logEmotionSample({
    sessionId,
    emotion,
    confidence: Number(confidence) || 0.5,
    detectedAt: detectedAt || new Date().toISOString(),
    metrics
  });

  res.status(201).json({ ok: true, analytics });
});

app.get("/api/session/:sessionId/analytics", (req, res) => {
  const analytics = getSessionAnalytics(req.params.sessionId);

  if (!analytics) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  res.json(analytics);
});

app.post("/api/session/:sessionId/end", (req, res) => {
  const result = endSession(req.params.sessionId);
  res.json({ ok: true, ...result });
});

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Emotion-Aware Study Assistant API listening on port ${PORT}`);
});
