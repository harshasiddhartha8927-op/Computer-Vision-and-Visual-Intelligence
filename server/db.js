import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "emotion-assistant.db"));
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

const EMOTIONS = ["Focused", "Tired", "Stressed", "Neutral"];

export function createSession(sessionId) {
  const startedAt = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO sessions (id, started_at)
      VALUES (?, ?)
    `
  ).run(sessionId, startedAt);

  return { id: sessionId, startedAt };
}

export function endSession(sessionId) {
  const endedAt = new Date().toISOString();
  db.prepare(
    `
      UPDATE sessions
      SET ended_at = ?
      WHERE id = ?
    `
  ).run(endedAt, sessionId);

  return { sessionId, endedAt };
}

export function logEmotionSample({
  sessionId,
  emotion,
  confidence,
  detectedAt,
  metrics
}) {
  db.prepare(
    `
      INSERT INTO emotion_logs (session_id, emotion, confidence, detected_at, metrics_json)
      VALUES (?, ?, ?, ?, ?)
    `
  ).run(
    sessionId,
    emotion,
    confidence,
    detectedAt,
    metrics ? JSON.stringify(metrics) : null
  );

  return getSessionAnalytics(sessionId);
}

export function getSessionAnalytics(sessionId) {
  const session = db
    .prepare(
      `
        SELECT id, started_at AS startedAt, ended_at AS endedAt
        FROM sessions
        WHERE id = ?
      `
    )
    .get(sessionId);

  if (!session) {
    return null;
  }

  const logs = db
    .prepare(
      `
        SELECT emotion, confidence, detected_at AS detectedAt, metrics_json AS metricsJson
        FROM emotion_logs
        WHERE session_id = ?
        ORDER BY detected_at ASC
      `
    )
    .all(sessionId);

  const counts = Object.fromEntries(EMOTIONS.map((emotion) => [emotion, 0]));
  for (const log of logs) {
    counts[log.emotion] = (counts[log.emotion] ?? 0) + 1;
  }

  const totalSamples = logs.length;
  const percentages = Object.fromEntries(
    EMOTIONS.map((emotion) => [
      emotion,
      totalSamples ? Math.round(((counts[emotion] ?? 0) / totalSamples) * 100) : 0
    ])
  );

  const dominantEmotion =
    totalSamples > 0
      ? EMOTIONS.reduce((winner, emotion) =>
          (counts[emotion] ?? 0) > (counts[winner] ?? 0) ? emotion : winner
        )
      : "Neutral";

  const timeline = logs.slice(-30).map((log, index) => ({
    id: `${sessionId}-${index}`,
    emotion: log.emotion,
    confidence: Number(log.confidence.toFixed(2)),
    detectedAt: log.detectedAt,
    metrics: log.metricsJson ? JSON.parse(log.metricsJson) : {}
  }));

  const insights = totalSamples
    ? [
        `You were stressed for ${percentages.Stressed}% of your session.`,
        `Your dominant state was ${dominantEmotion.toLowerCase()}.`,
        `${percentages.Focused}% of your tracked time was focused.`
      ]
    : [
        "Analytics will appear after the first few seconds of live tracking.",
        "Stay centered in the frame so the detector can build your mood timeline.",
        "Your session summary updates automatically as new samples arrive."
      ];

  return {
    session,
    totalSamples,
    counts,
    percentages,
    dominantEmotion,
    timeline,
    insights
  };
}
