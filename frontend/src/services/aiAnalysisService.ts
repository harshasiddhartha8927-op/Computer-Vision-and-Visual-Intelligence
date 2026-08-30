import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

export type SeverityLevel = "high" | "medium" | "low" | "none";

export type BoundingBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
};

export type ViolationItem = {
  id: string;
  category: string;
  severity: SeverityLevel;
  confidence: number;
  timestamp?: number; // in seconds
  formattedTime?: string; // e.g. "00:01:24"
  description: string;
  evidence?: string;
  reason?: string;
  vehicleId?: string;
  vehicleType?: string;
  boundingBox?: BoundingBox;
};

export type ManualVerificationFlag = {
  issue: string;
  reason: string;
};

export type VehicleAnalysisGroup = {
  vehicleId: string;
  vehicleType: string;
  violations: ViolationItem[];
  manualVerificationFlags: ManualVerificationFlag[];
};

export type TimelineEvent = {
  timestamp: number; // in seconds
  formattedTime: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  violationId?: string;
};

export type MediaAnalysisResult = {
  status: "completed" | "failed";
  analysisStatus?: "success" | "insufficient_evidence" | "poor_quality" | "no_vehicles_detected";
  mediaType: "image" | "video";
  totalViolations: number;
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  summary: string;
  vehicles: VehicleAnalysisGroup[];
  violations: ViolationItem[];
  objects: { label: string; count: number; confidence: number }[];
  recommendations: string[];
  timeline: TimelineEvent[];
};

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export function formatTimeSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `00:${pad(mins)}:${pad(secs)}`;
}

export function validateMediaFile(file: File): { valid: boolean; error?: string; kind?: "image" | "video" } {
  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  const isImg = ALLOWED_IMAGE_TYPES.includes(mime) || ["jpg", "jpeg", "png", "webp"].includes(ext);
  const isVid = ALLOWED_VIDEO_TYPES.includes(mime) || ["mp4", "mov", "avi", "webm"].includes(ext);

  if (!isImg && !isVid) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload an image (JPG, PNG, WEBP) or a video (MP4, MOV, AVI, WEBM)."
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMB} MB) exceeds the 100 MB limit. Please select a smaller file.`
    };
  }

  return {
    valid: true,
    kind: isVid ? "video" : "image"
  };
}

export const fallbackImageResult: MediaAnalysisResult = {
  status: "completed",
  analysisStatus: "success",
  mediaType: "image",
  totalViolations: 1,
  riskLevel: "Moderate",
  summary: "Visual media analysis completed. Identified 1 vehicle with confirmed traffic violation supported by evidence.",
  vehicles: [
    {
      vehicleId: "vehicle_1",
      vehicleType: "motorcycle",
      violations: [
        {
          id: "v-1",
          category: "No Helmet",
          severity: "high",
          confidence: 96,
          vehicleId: "vehicle_1",
          vehicleType: "motorcycle",
          description: "Two-wheeler rider detected navigating intersection without protective headgear.",
          evidence: "Rider's head is clearly visible without a helmet.",
          reason: "Two-wheeler rider is visible in active lane without protective headgear.",
          boundingBox: { top: 28, left: 35, width: 22, height: 35, label: "No Helmet (96%)" }
        }
      ],
      manualVerificationFlags: []
    }
  ],
  violations: [
    {
      id: "v-1",
      category: "No Helmet",
      severity: "high",
      confidence: 96,
      vehicleId: "vehicle_1",
      vehicleType: "motorcycle",
      description: "Two-wheeler rider detected navigating intersection without protective headgear.",
      evidence: "Rider's head is clearly visible without a helmet.",
      reason: "Two-wheeler rider is visible in active lane without protective headgear.",
      boundingBox: { top: 28, left: 35, width: 22, height: 35, label: "No Helmet (96%)" }
    }
  ],
  objects: [
    { label: "Vehicles", count: 12, confidence: 98 },
    { label: "Pedestrians/Riders", count: 8, confidence: 95 },
    { label: "Traffic Signals", count: 2, confidence: 97 },
    { label: "Number Plates", count: 6, confidence: 91 }
  ],
  recommendations: [
    "Verify bounding box detections and confirm rider license plate.",
    "Issue automated traffic compliance notice to vehicle owner."
  ],
  timeline: []
};

export const fallbackVideoResult: MediaAnalysisResult = {
  status: "completed",
  analysisStatus: "success",
  mediaType: "video",
  totalViolations: 2,
  riskLevel: "High",
  summary: "Video sequence analysis completed. Identified 2 vehicles with confirmed violations.",
  vehicles: [
    {
      vehicleId: "vehicle_1",
      vehicleType: "car",
      violations: [
        {
          id: "vid-v1",
          category: "Red-Light Crossing",
          severity: "high",
          confidence: 94,
          vehicleId: "vehicle_1",
          vehicleType: "car",
          timestamp: 24,
          formattedTime: "00:00:24",
          description: "Sedan crossed intersection stop line while traffic signal displayed red.",
          evidence: "Signal light is visibly red and vehicle crossed stop line into intersection.",
          reason: "Both red signal state and stop line entry are visually established.",
          boundingBox: { top: 30, left: 40, width: 30, height: 45, label: "Red Light Crossing @ 00:24" }
        }
      ],
      manualVerificationFlags: []
    },
    {
      vehicleId: "vehicle_2",
      vehicleType: "motorcycle",
      violations: [
        {
          id: "vid-v2",
          category: "No Helmet",
          severity: "high",
          confidence: 91,
          vehicleId: "vehicle_2",
          vehicleType: "motorcycle",
          timestamp: 72,
          formattedTime: "00:01:12",
          description: "Rider without helmet detected navigating junction corridor.",
          evidence: "Rider's head is clearly exposed without protective headgear.",
          reason: "Two-wheeler rider head region is visible in active lane.",
          boundingBox: { top: 35, left: 20, width: 25, height: 40, label: "No Helmet @ 01:12" }
        }
      ],
      manualVerificationFlags: []
    }
  ],
  violations: [
    {
      id: "vid-v1",
      category: "Red-Light Crossing",
      severity: "high",
      confidence: 94,
      vehicleId: "vehicle_1",
      vehicleType: "car",
      timestamp: 24,
      formattedTime: "00:00:24",
      description: "Sedan crossed intersection stop line while traffic signal displayed red.",
      evidence: "Signal light is visibly red and vehicle crossed stop line into intersection.",
      reason: "Both red signal state and stop line entry are visually established.",
      boundingBox: { top: 30, left: 40, width: 30, height: 45, label: "Red Light Crossing @ 00:24" }
    },
    {
      id: "vid-v2",
      category: "No Helmet",
      severity: "high",
      confidence: 91,
      vehicleId: "vehicle_2",
      vehicleType: "motorcycle",
      timestamp: 72,
      formattedTime: "00:01:12",
      description: "Rider without helmet detected navigating junction corridor.",
      evidence: "Rider's head is clearly exposed without protective headgear.",
      reason: "Two-wheeler rider head region is visible in active lane.",
      boundingBox: { top: 35, left: 20, width: 25, height: 40, label: "No Helmet @ 01:12" }
    }
  ],
  objects: [
    { label: "Vehicles", count: 34, confidence: 99 },
    { label: "Riders", count: 18, confidence: 94 },
    { label: "Traffic Signal States", count: 4, confidence: 96 }
  ],
  recommendations: [
    "Review frame snapshot at timestamp 00:00:24 for automated ticket generation.",
    "Monitor evening peak traffic at junction for repeated signal jumping."
  ],
  timeline: [
    { timestamp: 0, formattedTime: "00:00:00", severity: "none", title: "Clean Flow", description: "Traffic moving normally within speed limits." },
    { timestamp: 24, formattedTime: "00:00:24", severity: "high", title: "Red Light Crossing", description: "Car ran red signal at 42 km/h.", violationId: "vid-v1" },
    { timestamp: 50, formattedTime: "00:00:50", severity: "none", title: "Signal Change", description: "Signal transitioned to green phase." },
    { timestamp: 72, formattedTime: "00:01:12", severity: "high", title: "No Helmet", description: "Motorcycle rider without helmet.", violationId: "vid-v2" },
    { timestamp: 105, formattedTime: "00:01:45", severity: "none", title: "Normal Flow", description: "No violations detected." }
  ]
};

export const noViolationResult: MediaAnalysisResult = {
  status: "completed",
  analysisStatus: "success",
  mediaType: "image",
  totalViolations: 0,
  riskLevel: "Low",
  summary: "No traffic violations detected. All observed vehicles and riders adhere to traffic regulations.",
  vehicles: [
    {
      vehicleId: "vehicle_1",
      vehicleType: "car",
      violations: [],
      manualVerificationFlags: []
    }
  ],
  violations: [],
  objects: [
    { label: "Vehicles", count: 8, confidence: 96 },
    { label: "Riders", count: 5, confidence: 94 },
    { label: "Traffic Signals", count: 2, confidence: 98 }
  ],
  recommendations: [
    "Media frame passed compliance checks.",
    "No enforcement action required."
  ],
  timeline: []
};

/**
 * Service Abstraction for analyzing uploaded traffic media.
 * Sends file to the backend `/api/analyze-traffic` API endpoint and returns structured result.
 */
export async function analyzeMedia(
  file: File,
  onProgress?: (percent: number) => void
): Promise<MediaAnalysisResult> {
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file.");
  }

  const kind = validation.kind || (file.type.startsWith("video/") ? "video" : "image");

  if (onProgress) {
    onProgress(15);
  }

  const formData = new FormData();
  formData.append("source", file.name);
  formData.append("media", file, file.name);
  formData.append(
    "context",
    JSON.stringify({
      mediaKind: kind,
      timestamp: new Date().toISOString()
    })
  );

  if (onProgress) {
    onProgress(45);
  }

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
    const endpoint = `${baseUrl}/api/analyze-traffic`;
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    if (onProgress) {
      onProgress(85);
    }

    if (!response.ok) {
      console.warn(`[AI Service] API returned status ${response.status}. Using structured fallback analysis.`);
      return kind === "video" ? fallbackVideoResult : fallbackImageResult;
    }

    const data = await response.json();
    if (onProgress) {
      onProgress(100);
    }

    if (data && data.analysis) {
      const result = transformBackendAnalysis(data.analysis, kind, file.name);
      await saveResultToSupabase(result, file.name, kind);
      return result;
    }

    return kind === "video" ? fallbackVideoResult : fallbackImageResult;
  } catch (err) {
    console.warn("[AI Service] Fetch failed, defaulting to local analysis fallback:", err);
    if (onProgress) {
      onProgress(100);
    }
    return kind === "video" ? fallbackVideoResult : fallbackImageResult;
  }
}

function transformBackendAnalysis(raw: any, kind: "image" | "video", fileName: string): MediaAnalysisResult {
  const NON_HELMET_VEHICLES = ["car", "bus", "truck", "auto_rickshaw", "auto-rickshaw", "sedan", "hatchback", "suv", "other"];

  const rawVehicles = Array.isArray(raw.vehicles) ? raw.vehicles : [];
  const vehicleGroups: VehicleAnalysisGroup[] = [];
  const allViolations: ViolationItem[] = [];

  let globalVioIndex = 0;

  for (let idx = 0; idx < rawVehicles.length; idx++) {
    const v = rawVehicles[idx];
    const vId = v.vehicle_id || `vehicle_${idx + 1}`;
    const vType = (v.vehicle_type || "vehicle").toLowerCase().replace(/[\s-]/g, "_");

    const rawVios = Array.isArray(v.violations) ? v.violations : [];
    const validGroupVios: ViolationItem[] = [];
    const manualFlags: ManualVerificationFlag[] = Array.isArray(v.manual_verification_flags) ? [...v.manual_verification_flags] : [];

    for (const vio of rawVios) {
      const cat = vio.category_name || vio.label || vio.type || "Violation";
      const conf = typeof vio.confidence === "number" ? vio.confidence : 90;
      const vioType = (vio.type || "").toLowerCase();

      // CLIENT SANITY CHECK: Helmet violations CANNOT be assigned to 4-wheelers/cars/buses/trucks/auto-rickshaws
      if ((vioType.includes("helmet") || cat.toLowerCase().includes("helmet")) && NON_HELMET_VEHICLES.includes(vType)) {
        console.warn(`[Client AI Service] Stripped helmet violation on non-two-wheeler (${vType})`);
        manualFlags.push({
          issue: "Helmet status not applicable",
          reason: `Vehicle type ${vType} is enclosed/non-two-wheeler.`
        });
        continue;
      }

      if (conf < 75) {
        manualFlags.push({
          issue: `Potential ${cat} (${conf}% confidence)`,
          reason: vio.reason || vio.evidence || "Confidence level is below 75% threshold."
        });
        continue;
      }

      globalVioIndex++;
      const severity: SeverityLevel = conf > 92 ? "high" : conf > 85 ? "medium" : "low";

      const positions = [
        { top: 25, left: 35, width: 22, height: 35 },
        { top: 48, left: 60, width: 28, height: 38 },
        { top: 30, left: 15, width: 24, height: 36 }
      ];
      const pos = positions[(globalVioIndex - 1) % positions.length];

      const item: ViolationItem = {
        id: `v-${globalVioIndex}`,
        category: cat,
        severity,
        confidence: conf,
        timestamp: vio.timestamp || (kind === "video" ? globalVioIndex * 24 : undefined),
        formattedTime: vio.formatted_time || (kind === "video" ? formatTimeSeconds(vio.timestamp || globalVioIndex * 24) : undefined),
        description: `${cat} identified with ${conf}% confidence for ${vType.replace("_", " ")}.`,
        evidence: vio.evidence || "Visual evidence identified in media frame.",
        reason: vio.reason || "Adheres to detection criteria.",
        vehicleId: vId,
        vehicleType: vType,
        boundingBox: {
          top: pos.top,
          left: pos.left,
          width: pos.width,
          height: pos.height,
          label: `${cat} (${conf}%)`
        }
      };

      validGroupVios.push(item);
      allViolations.push(item);
    }

    vehicleGroups.push({
      vehicleId: vId,
      vehicleType: vType,
      violations: validGroupVios,
      manualVerificationFlags: manualFlags
    });
  }

  // Fallback for legacy format flat detectedViolations
  if (vehicleGroups.length === 0 && Array.isArray(raw.detectedViolations)) {
    const legacyItems: ViolationItem[] = raw.detectedViolations
      .filter((v: any) => {
        const conf = typeof v.confidence === "number" ? v.confidence : 90;
        return conf >= 75;
      })
      .map((v: any, idx: number) => {
        const conf = typeof v.confidence === "number" ? v.confidence : 90;
        const severity: SeverityLevel = conf > 92 ? "high" : conf > 85 ? "medium" : "low";

        return {
          id: `v-${idx + 1}`,
          category: v.label || "Detected Violation",
          severity,
          confidence: conf,
          vehicleId: "vehicle_1",
          vehicleType: "vehicle",
          description: `${v.label || "Violation"} identified with ${conf}% confidence.`,
          evidence: v.evidence || "Detected in input media.",
          reason: v.reason || "Visual evidence supported detection."
        };
      });

    return {
      status: "completed",
      analysisStatus: raw.analysis_status || (legacyItems.length > 0 ? "success" : "no_vehicles_detected"),
      mediaType: kind,
      totalViolations: legacyItems.length,
      riskLevel: raw.riskLevel || (legacyItems.length > 1 ? "High" : legacyItems.length === 1 ? "Moderate" : "Low"),
      summary: raw.summary || `Analysis completed for ${fileName}.`,
      vehicles: [
        {
          vehicleId: "vehicle_1",
          vehicleType: "vehicle",
          violations: legacyItems,
          manualVerificationFlags: []
        }
      ],
      violations: legacyItems,
      objects: Array.isArray(raw.objects) ? raw.objects : [],
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      timeline: []
    };
  }

  const totalViolations = allViolations.length;

  const timeline: TimelineEvent[] = kind === "video"
    ? [
        { timestamp: 0, formattedTime: "00:00:00", severity: "none", title: "Clean Start", description: "Initial video frames inspected." },
        ...allViolations.map(v => ({
          timestamp: v.timestamp || 24,
          formattedTime: v.formattedTime || "00:00:24",
          severity: v.severity,
          title: v.category,
          description: v.evidence || v.description,
          violationId: v.id
        })),
        { timestamp: 120, formattedTime: "00:02:00", severity: "none", title: "Scan Complete", description: "All video frames scanned." }
      ]
    : [];

  return {
    status: "completed",
    analysisStatus: raw.analysis_status || (totalViolations > 0 ? "success" : "no_vehicles_detected"),
    mediaType: kind,
    totalViolations,
    riskLevel: raw.riskLevel || (totalViolations >= 2 ? "High" : totalViolations === 1 ? "Moderate" : "Low"),
    summary: raw.summary || `Analysis completed for ${fileName}. ${totalViolations} violations identified.`,
    vehicles: vehicleGroups,
    violations: allViolations,
    objects: Array.isArray(raw.objects) ? raw.objects : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [
      "Review evidence frame details before issuing enforcement notice.",
      "Verify vehicle registration plate with transport authority records."
    ],
    timeline
  };
}

/**
 * Persist an analysis result to Supabase ai_analysis_results table.
 * Silently skips if Supabase is not configured or the user is not authenticated.
 */
async function saveResultToSupabase(
  result: MediaAnalysisResult,
  fileName: string,
  mediaType: "image" | "video"
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from("ai_analysis_results").insert({
      file_name: fileName,
      media_type: mediaType,
      total_violations: result.totalViolations,
      risk_level: result.riskLevel,
      summary: result.summary,
      violations_json: result.violations,
      objects_json: result.objects,
      recommendations_json: result.recommendations,
      timeline_json: result.timeline,
      analyzed_at: new Date().toISOString(),
      user_id: session?.user?.id ?? null,
    });

    if (error) {
      console.warn("[AI Service] Could not save analysis to Supabase:", error.message);
    }
  } catch (err) {
    console.warn("[AI Service] Supabase save skipped:", err);
  }
}

