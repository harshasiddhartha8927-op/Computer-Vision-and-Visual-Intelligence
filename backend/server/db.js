import fs from "node:fs";
import path from "node:path";

let db = null;

try {
  const { default: Database } = await import("better-sqlite3");
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, "emotion-assistant.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS emotion_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      emotion TEXT NOT NULL,
      confidence REAL NOT NULL,
      detected_at TEXT NOT NULL,
      metrics_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
} catch (err) {
  console.warn("[Server DB] SQLite unavailable — using in-memory store for session analytics:", err.message);
}

const inMemorySessions = new Map();
const inMemoryLogs = [];
const EMOTIONS = ["Focused", "Tired", "Stressed", "Neutral"];

export function createSession(sessionId) {
  const startedAt = new Date().toISOString();
  if (db) {
    db.prepare(`INSERT INTO sessions (id, started_at) VALUES (?, ?)`).run(sessionId, startedAt);
  } else {
    inMemorySessions.set(sessionId, { id: sessionId, startedAt, endedAt: null });
  }
  return { id: sessionId, startedAt };
}

export function endSession(sessionId) {
  const endedAt = new Date().toISOString();
  if (db) {
    db.prepare(`UPDATE sessions SET ended_at = ? WHERE id = ?`).run(endedAt, sessionId);
  } else {
    const s = inMemorySessions.get(sessionId);
    if (s) s.endedAt = endedAt;
  }
  return { sessionId, endedAt };
}

export function logEmotionSample({ sessionId, emotion, confidence, detectedAt, metrics }) {
  if (db) {
    db.prepare(
      `INSERT INTO emotion_logs (session_id, emotion, confidence, detected_at, metrics_json) VALUES (?, ?, ?, ?, ?)`
    ).run(sessionId, emotion, confidence, detectedAt, metrics ? JSON.stringify(metrics) : null);
  } else {
    inMemoryLogs.push({ sessionId, emotion, confidence, detectedAt, metrics });
  }
  return getSessionAnalytics(sessionId);
}

export function getSessionAnalytics(sessionId) {
  let session = null;
  let logs = [];

  if (db) {
    session = db.prepare(`SELECT id, started_at AS startedAt, ended_at AS endedAt FROM sessions WHERE id = ?`).get(sessionId);
    if (!session) return null;
    logs = db.prepare(`SELECT emotion, confidence, detected_at AS detectedAt, metrics_json AS metricsJson FROM emotion_logs WHERE session_id = ? ORDER BY detected_at ASC`).all(sessionId);
  } else {
    session = inMemorySessions.get(sessionId);
    if (!session) return null;
    logs = inMemoryLogs.filter((l) => l.sessionId === sessionId);
  }

  const counts = Object.fromEntries(EMOTIONS.map((e) => [e, 0]));
  for (const log of logs) {
    counts[log.emotion] = (counts[log.emotion] ?? 0) + 1;
  }

  const totalSamples = logs.length;
  const percentages = Object.fromEntries(
    EMOTIONS.map((e) => [e, totalSamples ? Math.round(((counts[e] ?? 0) / totalSamples) * 100) : 0])
  );

  const dominantEmotion = totalSamples > 0
    ? EMOTIONS.reduce((winner, e) => ((counts[e] ?? 0) > (counts[winner] ?? 0) ? e : winner))
    : "Neutral";

  const timeline = logs.slice(-30).map((log, index) => ({
    id: `${sessionId}-${index}`,
    emotion: log.emotion,
    confidence: Number((log.confidence || 0.5).toFixed(2)),
    detectedAt: log.detectedAt,
    metrics: log.metrics || {}
  }));

  return {
    session,
    totalSamples,
    counts,
    percentages,
    dominantEmotion,
    timeline,
    insights: [
      `Your dominant state was ${dominantEmotion.toLowerCase()}.`,
      `${percentages.Focused}% of your tracked time was focused.`
    ]
  };
}
