import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { historyRecords, recentViolations, type ViolationRecord } from "../data/trafficData";

export type ViolationFilters = {
  query?: string;
  status?: string;
  severity?: string;
  camera?: string;
  location?: string;
  limit?: number;
};

export type UseViolationsResult = {
  violations: ViolationRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isLive: boolean; // true = data from Supabase, false = local fallback
};

/**
 * Fetches violation records from Supabase with optional filters.
 * Falls back gracefully to local mock data if Supabase is not configured.
 */
export function useViolations(filters: ViolationFilters = {}): UseViolationsResult {
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
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
        // Local fallback — filter mock data
        const all = [...historyRecords];
        const filtered = applyLocalFilters(all, filters);
        if (!cancelled) {
          setViolations(filtered);
          setLoading(false);
        }
        return;
      }

      try {
        let query = supabase
          .from("violation_records")
          .select("id,violation,vehicle,plate,location,camera,detected_at,confidence,status,severity,source,ai_summary,risk_level")
          .order("detected_at", { ascending: false })
          .limit(filters.limit ?? 100);

        if (filters.status && filters.status !== "All") {
          query = query.eq("status", filters.status);
        }
        if (filters.severity && filters.severity !== "All") {
          query = query.eq("severity", filters.severity);
        }
        if (filters.camera && filters.camera !== "All") {
          query = query.eq("camera", filters.camera);
        }
        if (filters.location && filters.location !== "All") {
          query = query.eq("location", filters.location);
        }
        if (filters.query) {
          query = query.or(
            `violation.ilike.%${filters.query}%,plate.ilike.%${filters.query}%,location.ilike.%${filters.query}%,camera.ilike.%${filters.query}%,vehicle.ilike.%${filters.query}%,status.ilike.%${filters.query}%`
          );
        }

        const { data, error: sbError } = await query;

        if (!cancelled) {
          if (sbError) {
            console.error("[useViolations] Supabase error:", sbError.message);
            // Show fallback but surface the error
            setViolations(applyLocalFilters([...historyRecords], filters));
            setError("Live data unavailable — showing local records.");
          } else {
            setViolations((data || []).map(rowToViolationRecord));
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setViolations(applyLocalFilters([...historyRecords], filters));
          setError("Could not reach Supabase — showing local records.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, filters.query, filters.status, filters.severity, filters.camera, filters.location, filters.limit]);

  return {
    violations,
    loading,
    error,
    refetch,
    isLive: isSupabaseConfigured && !error,
  };
}

/**
 * Fetches the 4 most recent violations for the Dashboard section.
 */
export function useRecentViolations(): UseViolationsResult {
  return useViolations({ limit: 4 });
}

// ─── helpers ───────────────────────────────────────────────────────────────

function rowToViolationRecord(row: any): ViolationRecord {
  return {
    id: row.id,
    violation: row.violation,
    vehicle: row.vehicle,
    plate: row.plate,
    location: row.location,
    camera: row.camera,
    date: row.detected_at ? row.detected_at.slice(0, 10) : "",
    time: row.detected_at ? row.detected_at.slice(11, 16) : "",
    confidence: Number(row.confidence),
    status: row.status,
    severity: row.severity,
  };
}

function applyLocalFilters(records: ViolationRecord[], filters: ViolationFilters): ViolationRecord[] {
  let result = records;
  if (filters.query) {
    const q = filters.query.toLowerCase();
    result = result.filter((r) =>
      `${r.id} ${r.violation} ${r.vehicle} ${r.plate} ${r.location} ${r.camera} ${r.status}`
        .toLowerCase()
        .includes(q)
    );
  }
  if (filters.status && filters.status !== "All") {
    result = result.filter((r) => r.status === filters.status);
  }
  if (filters.severity && filters.severity !== "All") {
    result = result.filter((r) => r.severity === filters.severity);
  }
  if (filters.camera && filters.camera !== "All") {
    result = result.filter((r) => r.camera === filters.camera);
  }
  if (filters.limit) {
    result = result.slice(0, filters.limit);
  }
  return result;
}
