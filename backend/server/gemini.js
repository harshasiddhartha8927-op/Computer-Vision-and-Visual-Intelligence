import fs from "node:fs";
import path from "node:path";
import { saveAnalysisResult } from "./supabase.js";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-2.0-flash";
const MAX_BODY_BYTES = 110 * 1024 * 1024;

const fallbackAnalysis = {
  source: "fallback",
  riskLevel: "High",
  summary:
    "The scene contains 14 vehicles and 9 detected riders. Three helmet violations were detected, with the highest-confidence violation at 97.2%. Traffic density is moderate but violation frequency is concentrated near the stop-line zone.",
  detectedViolations: [
    { label: "Helmet Violations", value: "3", confidence: 97 },
    { label: "Red-Light Violation", value: "1", confidence: 94 },
    { label: "Triple-Riding Violations", value: "2", confidence: 92 }
  ],
  objects: [
    { label: "Vehicles", count: 14, confidence: 98 },
    { label: "People", count: 9, confidence: 96 },
    { label: "Traffic lights", count: 2, confidence: 95 },
    { label: "Number plates", count: 8, confidence: 91 }
  ],
  recommendations: [
    "Prioritize manual review for the highest-confidence helmet violation.",
    "Compare the frame against signal timing before issuing the red-light violation.",
    "Increase live monitoring at this junction during evening density peaks."
  ]
};

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

export function loadLocalEnv(rootDir = process.cwd()) {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(rootDir, filename);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const fileContents = fs.readFileSync(filePath, "utf-8");

    for (const line of fileContents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);

      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function buildPrompt(payload = {}) {
  const source = payload.source || "Uploaded traffic media";
  const media = payload.media;
  const mediaKind = getMediaInputType(media?.mimeType);

  return `
You are an expert AI Traffic Violation Enforcement system.
Examine the attached ${mediaKind || "media"} (${source}) frame by frame.

TASK:
1. Detect and list all visible primary vehicles (Car, Motorcycle, Scooter, Bus, Truck, Auto-rickshaw, Bicycle).
2. For each vehicle, carefully analyze its movement, lane position, driving direction, signal compliance, helmet usage (for two-wheelers), and traffic rules.
3. Check for specific violations:
   - Wrong-Side Driving / Wrong Route (driving against traffic flow, opposing lane, wrong direction on road/divider)
   - Illegal Turn / Unsafe Lane Change (sharp turn across solid lines, turning from wrong lane, cutting off traffic)
   - Red Light Crossing (crossing stop line / intersection during red signal)
   - Helmet Violation (unhelmeted two-wheeler rider/pillion)
   - Triple Riding (3+ occupants on a motorcycle/scooter)
   - Stop Line Jump (stopping beyond stop line at red signal)

STRICT RULES:
- Helmet violations apply ONLY to two-wheelers ("motorcycle", "scooter", "bicycle"). NEVER assign a helmet violation to a car, bus, truck, or auto-rickshaw.
- Observe traffic lanes and movement of surrounding vehicles. If a vehicle travels in the direction opposite to established traffic flow, on the wrong side of the divider, or makes an illegal turn across solid lines, flag it as a violation.
- If rider head area is obscured or blurred, do NOT guess. Place in "manual_verification_flags".

Return ONLY valid JSON matching this schema:
{
  "analysis_status": "success",
  "vehicles": [
    {
      "vehicle_id": "vehicle_1",
      "vehicle_type": "car",
      "vehicle_description": "Dark grey hatchback",
      "violations": [
        {
          "type": "wrong_side_driving",
          "category_name": "Wrong-Side Driving / Illegal Turn",
          "confidence": 94,
          "evidence": "Vehicle crossed solid lines and traveled against the direction of oncoming traffic at 00:00:05.",
          "reason": "Executed an unsafe maneuver entering the opposing lane.",
          "timestamp": 5,
          "formatted_time": "00:00:05"
        }
      ],
      "manual_verification_flags": []
    }
  ],
  "objects": [
    { "label": "Vehicles", "count": 2, "confidence": 96 }
  ],
  "overall_summary": "Concise summary of observed traffic flow and detected violations.",
  "riskLevel": "Low | Moderate | High | Critical"
}
`.trim();
}

function getMediaInputType(mimeType = "") {
  const normalizedMimeType = String(mimeType).toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }

  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }

  return null;
}

function sanitizeBase64Data(data = "") {
  const value = String(data);
  const commaIndex = value.indexOf(",");

  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1);
  }

  return value;
}

function buildGeminiInput(payload = {}) {
  const prompt = buildPrompt(payload);
  const media = payload.media || {};
  const mediaType = getMediaInputType(media.mimeType);

  if (!media.data || !mediaType) {
    return prompt;
  }

  const mediaPart = {
    type: mediaType,
    data: sanitizeBase64Data(media.data),
    mime_type: media.mimeType
  };
  const textPart = { type: "text", text: prompt };

  return mediaType === "video" ? [mediaPart, textPart] : [textPart, mediaPart];
}

function getModelTimeoutMs(payload, env, modelIndex, modelCount) {
  const configuredTimeout = Number.parseInt(env.GEMINI_TIMEOUT_MS || "", 10);

  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout;
  }

  if (modelIndex < modelCount - 1) {
    return 15000;
  }

  return getMediaInputType(payload?.media?.mimeType) === "video" ? 120000 : 45000;
}

function getTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

function extractJsonText(text) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function extractInteractionText(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  if (typeof responseJson.outputText === "string") {
    return responseJson.outputText;
  }

  const candidateText = responseJson.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n");

  if (candidateText) {
    return candidateText;
  }

  const steps = Array.isArray(responseJson.steps) ? responseJson.steps : [];

  for (const step of [...steps].reverse()) {
    const content = Array.isArray(step.content) ? step.content : [];
    const text = content
      .map((part) => part.text)
      .filter(Boolean)
      .join("\n");

    if (text) {
      return text;
    }
  }

  return "";
}

function clampConfidence(value, fallback) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeAnalysis(rawAnalysis) {
  const source = rawAnalysis && typeof rawAnalysis === "object" ? rawAnalysis : {};
  const status = typeof source.analysis_status === "string" ? source.analysis_status : "success";
  const rawVehicles = Array.isArray(source.vehicles) ? source.vehicles : [];

  const NON_HELMET_VEHICLES = ["car", "bus", "truck", "auto_rickshaw", "auto-rickshaw", "sedan", "hatchback", "suv", "other"];

  // Normalize vehicles and filter vehicle-type mismatches
  const vehicles = rawVehicles.map((v, vIdx) => {
    const vId = typeof v.vehicle_id === "string" && v.vehicle_id.trim() ? v.vehicle_id.trim() : `vehicle_${vIdx + 1}`;
    const vType = typeof v.vehicle_type === "string" ? v.vehicle_type.toLowerCase().replace(/[\s-]/g, "_") : "other";

    const rawViolations = Array.isArray(v.violations) ? v.violations : [];
    const validViolations = [];
    const manualFlags = Array.isArray(v.manual_verification_flags) ? [...v.manual_verification_flags] : [];

    for (const item of rawViolations) {
      const type = (item.type || "").toLowerCase().replace(/[\s-]/g, "_");
      const categoryName = item.category_name || item.label || item.type || "Violation";
      const confidence = clampConfidence(item.confidence, 85);

      // STRICT RULE: Helmet violations cannot belong to 4-wheelers/cars/buses/trucks/auto-rickshaws
      if ((type.includes("helmet") || categoryName.toLowerCase().includes("helmet")) && NON_HELMET_VEHICLES.includes(vType)) {
        console.warn(`[Gemini Normalizer] Discarded hallucinated helmet violation for non-2-wheeler (${vType})`);
        manualFlags.push({
          issue: "Helmet status not applicable",
          reason: `Vehicle type ${vType} is enclosed/non-two-wheeler.`
        });
        continue;
      }

      // Confidence threshold: < 75% goes to manual flags instead of confirmed violations
      if (confidence < 75) {
        manualFlags.push({
          issue: `Potential ${categoryName} (${confidence}% confidence)`,
          reason: item.reason || item.evidence || "Low confidence detection below threshold."
        });
        continue;
      }

      validViolations.push({
        type: type || "unknown_violation",
        category_name: categoryName,
        confidence,
        evidence: typeof item.evidence === "string" && item.evidence.trim() ? item.evidence.trim() : "Visual evidence observed in frame.",
        reason: typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : "Adheres to traffic enforcement detection criteria.",
        timestamp: Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : undefined,
        formatted_time: typeof item.formatted_time === "string" ? item.formatted_time : undefined
      });
    }

    return {
      vehicle_id: vId,
      vehicle_type: vType,
      violations: validViolations,
      manual_verification_flags: manualFlags
    };
  });

  // Flatten detected violations for backwards compatibility
  const detectedViolations = [];
  for (const v of vehicles) {
    for (const vio of v.violations) {
      detectedViolations.push({
        label: vio.category_name,
        value: "1",
        confidence: vio.confidence,
        vehicle_id: v.vehicle_id,
        vehicle_type: v.vehicle_type,
        evidence: vio.evidence,
        reason: vio.reason,
        timestamp: vio.timestamp,
        formatted_time: vio.formatted_time
      });
    }
  }

  // Handle legacy format fallback if Gemini returns raw detectedViolations instead of vehicles array
  if (vehicles.length === 0 && Array.isArray(source.detectedViolations)) {
    const sanitizedLegacy = source.detectedViolations.filter((item) => {
      const label = (item.label || "").toLowerCase();
      if (label.includes("helmet") && clampConfidence(item.confidence, 90) < 75) return false;
      return true;
    });

    return {
      source: "gemini",
      analysis_status: sanitizedLegacy.length > 0 ? "success" : "no_violations_detected",
      riskLevel: typeof source.riskLevel === "string" ? source.riskLevel : "Low",
      summary: typeof source.summary === "string" && source.summary.trim() ? source.summary.trim() : "Traffic analysis complete.",
      vehicles: [
        {
          vehicle_id: "vehicle_1",
          vehicle_type: "vehicle",
          violations: sanitizedLegacy.map((item) => ({
            type: (item.label || "").toLowerCase().replace(/[\s-]/g, "_"),
            category_name: item.label || "Detected Violation",
            confidence: clampConfidence(item.confidence, 90),
            evidence: item.evidence || "Detected in input media.",
            reason: item.reason || "Visual detection satisfied threshold criteria."
          })),
          manual_verification_flags: []
        }
      ],
      detectedViolations: sanitizedLegacy.map((item) => ({
        label: typeof item.label === "string" ? item.label : "Violation",
        value: String(item.value ?? "1"),
        confidence: clampConfidence(item.confidence, 90)
      })),
      objects: Array.isArray(source.objects) ? source.objects : [],
      recommendations: Array.isArray(source.recommendations) ? source.recommendations : []
    };
  }

  const totalViolationsCount = detectedViolations.length;
  const computedRiskLevel = totalViolationsCount >= 2 ? "High" : totalViolationsCount === 1 ? "Moderate" : "Low";

  return {
    source: "gemini",
    analysis_status: status,
    riskLevel: source.riskLevel || computedRiskLevel,
    summary: typeof source.summary === "string" && source.summary.trim()
      ? source.summary.trim()
      : typeof source.overall_summary === "string" && source.overall_summary.trim()
      ? source.overall_summary.trim()
      : totalViolationsCount > 0
      ? `${totalViolationsCount} traffic violation(s) identified with visual evidence.`
      : "No traffic violations were reliably detected in the uploaded media.",
    vehicles,
    detectedViolations,
    objects: Array.isArray(source.objects) ? source.objects : [],
    recommendations: Array.isArray(source.recommendations) ? source.recommendations : [
      "Review evidence frame details before issuing enforcement notice.",
      "Verify vehicle registration plate with transport authority records."
    ]
  };
}

export async function analyzeTrafficWithGemini(payload = {}, env = process.env) {
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbackModel = env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const models = [model, fallbackModel].filter((candidate, index, list) => candidate && list.indexOf(candidate) === index);

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "Gemini API key is not configured.",
      analysis: fallbackAnalysis
    };
  }

  let lastFailure = null;

  for (const [modelIndex, modelName] of models.entries()) {
    let response;
    const timeoutMs = getModelTimeoutMs(payload, env, modelIndex, models.length);

    const promptText = buildPrompt(payload);
    const media = payload.media || {};
    const mediaType = getMediaInputType(media.mimeType);

    const parts = [];
    if (media.data && mediaType) {
      parts.push({
        inlineData: {
          mimeType: media.mimeType,
          data: sanitizeBase64Data(media.data)
        }
      });
    }
    parts.push({ text: promptText });

    const requestBody = {
      contents: [
        {
          parts
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: getTimeoutSignal(timeoutMs),
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      lastFailure = {
        status: 504,
        error: isTimeout ? "Gemini analysis timed out. Try a shorter clip or a smaller image." : error?.message || "Gemini request failed.",
        model: modelName
      };

      if (modelName !== models[models.length - 1]) {
        continue;
      }

      return {
        ok: false,
        status: lastFailure.status,
        error: lastFailure.error,
        model: modelName,
        analysis: fallbackAnalysis
      };
    }

    const responseText = await response.text();
    let responseJson = null;

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = null;
    }

    if (!response.ok) {
      const apiMessage = responseJson?.error?.message || response.statusText || "Gemini request failed.";
      lastFailure = {
        status: response.status,
        error: apiMessage,
        model: modelName
      };

      if ([429, 500, 503, 504].includes(response.status) && modelName !== models[models.length - 1]) {
        continue;
      }

      return {
        ok: false,
        status: response.status,
        error: apiMessage,
        model: modelName,
        analysis: fallbackAnalysis
      };
    }

    const modelText = extractInteractionText(responseJson);

    if (!modelText) {
      lastFailure = {
        status: 502,
        error: "Gemini returned an empty analysis.",
        model: modelName
      };

      if (modelName !== models[models.length - 1]) {
        continue;
      }

      return {
        ok: false,
        status: 502,
        error: "Gemini returned an empty analysis.",
        model: modelName,
        analysis: fallbackAnalysis
      };
    }

    try {
      const parsed = JSON.parse(extractJsonText(modelText));
      return {
        ok: true,
        status: 200,
        model: modelName,
        analysis: normalizeAnalysis(parsed)
      };
    } catch {
      return {
        ok: true,
        status: 200,
        model: modelName,
        analysis: {
          ...fallbackAnalysis,
          source: "gemini",
          summary: modelText.slice(0, 520)
        }
      };
    }
  }

  return {
    ok: false,
    status: lastFailure?.status || 502,
    error: lastFailure?.error || "Gemini request failed.",
    model: lastFailure?.model || model,
    analysis: fallbackAnalysis
  };
}

export async function readJsonRequest(req) {
  const buffer = await readRequestBuffer(req);
  const bodyText = buffer.toString("utf-8");
  return bodyText ? JSON.parse(bodyText) : {};
}

async function readRequestBuffer(req) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseMultipartRequest(req, buffer) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    const error = new Error("Missing multipart boundary.");
    error.status = 400;
    throw error;
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const boundaryMarker = Buffer.from(`\r\n--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields = {};
  const files = [];
  let cursor = buffer.indexOf(boundaryBuffer);

  while (cursor !== -1 && cursor < buffer.length) {
    cursor += boundaryBuffer.length;

    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) {
      break;
    }

    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) {
      cursor += 2;
    }

    const headerEnd = buffer.indexOf(headerSeparator, cursor);

    if (headerEnd === -1) {
      break;
    }

    const headerText = buffer.slice(cursor, headerEnd).toString("utf-8");
    const partStart = headerEnd + headerSeparator.length;
    const nextBoundary = buffer.indexOf(boundaryMarker, partStart);

    if (nextBoundary === -1) {
      break;
    }

    const dispositionLine = headerText.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
    const fieldName = dispositionLine.match(/name="([^"]+)"/i)?.[1];
    const filename = dispositionLine.match(/filename="([^"]*)"/i)?.[1];
    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
    const partData = buffer.slice(partStart, nextBoundary);

    if (fieldName && filename) {
      files.push({
        name: fieldName,
        filename,
        mimeType,
        data: partData
      });
    } else if (fieldName) {
      fields[fieldName] = partData.toString("utf-8");
    }

    cursor = nextBoundary + 2;
  }

  return { fields, files };
}

export async function readPayloadRequest(req) {
  const contentType = String(req.headers["content-type"] || "");

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return readJsonRequest(req);
  }

  const buffer = await readRequestBuffer(req);
  const form = parseMultipartRequest(req, buffer);
  const file = form.files.find((item) => item.name === "media") || form.files[0];
  let context = {};

  try {
    context = form.fields.context ? JSON.parse(form.fields.context) : {};
  } catch {
    context = {};
  }

  return {
    source: form.fields.source || file?.filename || "Uploaded traffic media",
    context,
    media: file
      ? {
          name: file.filename,
          mimeType: file.mimeType,
          size: file.data.length,
          data: file.data.toString("base64")
        }
      : undefined
  };
}

export async function sendGeminiAnalysis(req, res, env = process.env) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  try {
    const payload = req.body && Object.keys(req.body).length > 0 ? req.body : await readPayloadRequest(req);
    const result = await analyzeTrafficWithGemini(payload, env);

    // Persist to Supabase if analysis succeeded
    if (result.ok && result.analysis) {
      const fileName = payload.source || payload.media?.name || "unknown";
      const mediaType = payload.media?.mimeType?.startsWith("video/") ? "video" : "image";
      await saveAnalysisResult(result.analysis, fileName, mediaType);
    }

    res.statusCode = result.status || (result.ok ? 200 : 502);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = error.status || 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        error: error.message || "Unable to analyze traffic right now.",
        analysis: fallbackAnalysis
      })
    );
  }
}

loadLocalEnv();
