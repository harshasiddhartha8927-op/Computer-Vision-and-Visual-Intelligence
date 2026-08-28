import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

export type AnalysisHistoryRecord = {
  id: string;
  file_name: string;
  media_type: "image" | "video";
  total_violations: number;
  risk_level: string;
  summary: string;
  violations_json: any[];
  objects_json: any[];
  recommendations_json: string[];
  analyzed_at: string;
};

export type UseAnalysisHistoryResult = {
  records: AnalysisHistoryRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Fetches past AI analysis results for the current authenticated user.
 * Returns an empty list with no error if Supabase is not configured.
 */
export function useAnalysisHistory(limit = 10): UseAnalysisHistoryResult {
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setRecords([]);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error: sbError } = await supabase
          .from("ai_analysis_results")
          .select("id,file_name,media_type,total_violations,risk_level,summary,violations_json,objects_json,recommendations_json,analyzed_at")
          .order("analyzed_at", { ascending: false })
          .limit(limit);

        if (!cancelled) {
          if (sbError) {
            console.error("[useAnalysisHistory] Supabase error:", sbError.message);
            setError("Could not load analysis history.");
          } else {
            setRecords(data || []);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not reach Supabase for analysis history.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [revision, limit]);

  return { records, loading, error, refetch };
}
