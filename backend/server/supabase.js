import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./gemini.js";

loadLocalEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("[Server/Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. DB writes will be skipped.");
}

/**
 * Server-side Supabase client with service role — bypasses RLS for trusted inserts.
 * Never expose this key to the browser.
 */
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })
  : null;

/**
 * Save an AI analysis result to Supabase.
 * @param {object} result - The normalised analysis object from analyzeTrafficWithGemini
 * @param {string} fileName - Original uploaded file name
 * @param {string} mediaType - "image" | "video"
 * @returns {Promise<void>}
 */
export async function saveAnalysisResult(result, fileName, mediaType) {
  if (!supabaseAdmin) return;

  try {
    const { error } = await supabaseAdmin
      .from("ai_analysis_results")
      .insert({
        file_name: fileName || "unknown",
        media_type: mediaType || "image",
        total_violations: result.detectedViolations?.length ?? 0,
        risk_level: result.riskLevel || "Low",
        summary: result.summary || "",
        violations_json: result.detectedViolations || [],
        objects_json: result.objects || [],
        recommendations_json: result.recommendations || [],
        timeline_json: [],
        analyzed_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[Server/Supabase] Failed to save analysis result:", error.message);
    }
  } catch (err) {
    console.error("[Server/Supabase] Unexpected error saving analysis result:", err);
  }
}

/**
 * Save a detected violation record to Supabase.
 */
export async function saveViolationRecord(record) {
  if (!supabaseAdmin) return;

  try {
    const { error } = await supabaseAdmin
      .from("violation_records")
      .upsert(record, { onConflict: "id" });

    if (error) {
      console.error("[Server/Supabase] Failed to save violation record:", error.message);
    }
  } catch (err) {
    console.error("[Server/Supabase] Unexpected error saving violation:", err);
  }
}
