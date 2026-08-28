export type ChartDatum = {
  label: string;
  value: number;
};

export type DetectionBox = {
  label: string;
  confidence?: number;
  left: number;
  top: number;
  width: number;
  height: number;
  variant: "vehicle" | "person" | "violation" | "plate";
};

export type CameraFeed = {
  id: string;
  location: string;
  density: string;
  vehicles: number;
  violations: number;
  processing: string;
  confidence: number;
  alert: string;
  boxes: DetectionBox[];
};

export type ViolationRecord = {
  id: string;
  violation: string;
  vehicle: string;
  plate: string;
  location: string;
  camera: string;
  date: string;
  time: string;
  confidence: number;
  status: string;
  severity: string;
};

export const heroStats = [
  { value: "98.4%", label: "Detection accuracy" },
  { value: "24/7", label: "Camera intelligence" },
];

export const dashboardMetrics = [
  { label: "Active cameras", value: "18", trend: "+3", detail: "Across 6 monitored zones" },
  { label: "Violations today", value: "142", trend: "+18%", detail: "Compared with yesterday" },
  { label: "High-risk alerts", value: "09", trend: "Live", detail: "Require immediate review" },
  { label: "Vehicles tracked", value: "2.8K", trend: "+12%", detail: "Across the network" },
  { label: "Evidence captured", value: "96%", trend: "+4%", detail: "Frames retained successfully" },
  { label: "System uptime", value: "99.8%", trend: "Stable", detail: "Last 30 days" },
];

export const liveOverview = {
  camera: "CAM-07",
  location: "Central Junction",
  vehicles: 34,
  density: "Moderate",
  violations: 7,
  confidence: 96.8,
};

const sharedBoxes: DetectionBox[] = [
  { label: "Vehicle", confidence: 98, left: 12, top: 37, width: 23, height: 25, variant: "vehicle" },
  { label: "No helmet", confidence: 97, left: 43, top: 23, width: 16, height: 24, variant: "violation" },
  { label: "Vehicle", confidence: 95, left: 66, top: 42, width: 22, height: 27, variant: "vehicle" },
  { label: "Plate", confidence: 91, left: 47, top: 53, width: 12, height: 7, variant: "plate" },
];

export const cameraFeeds: CameraFeed[] = [
  { id: "CAM-07", location: "Central Junction", density: "Moderate", vehicles: 34, violations: 7, processing: "Analyzing", confidence: 96.8, alert: "Helmet violation", boxes: sharedBoxes },
  { id: "CAM-12", location: "Eastbound Signal", density: "High", vehicles: 48, violations: 11, processing: "Monitoring", confidence: 94.2, alert: "Red-light alert", boxes: sharedBoxes.slice(0, 3) },
  { id: "CAM-18", location: "Market Road", density: "Low", vehicles: 19, violations: 3, processing: "Analyzing", confidence: 98.1, alert: "Triple-riding alert", boxes: sharedBoxes.slice(1) },
];

export const violationDistribution = [
  { label: "No Helmet", count: 58, percent: 82 },
  { label: "Red Light Violation", count: 41, percent: 67 },
  { label: "Triple Riding", count: 26, percent: 48 },
  { label: "Wrong Lane", count: 17, percent: 31 },
];

export const recentViolations: ViolationRecord[] = [
  { id: "VIO-2048", violation: "No Helmet", vehicle: "Motorcycle", plate: "KA 03 HM 4821", location: "Central Junction", camera: "CAM-07", date: "2026-08-28", time: "18:42", confidence: 96.8, status: "Pending Review", severity: "High" },
  { id: "VIO-2047", violation: "Red Light Violation", vehicle: "Sedan", plate: "KA 05 MP 1190", location: "Eastbound Signal", camera: "CAM-12", date: "2026-08-28", time: "18:36", confidence: 94.1, status: "Verified", severity: "Critical" },
  { id: "VIO-2046", violation: "Triple Riding", vehicle: "Motorcycle", plate: "KA 01 EL 7743", location: "Market Road", camera: "CAM-18", date: "2026-08-28", time: "18:21", confidence: 92.4, status: "Pending Review", severity: "Medium" },
  { id: "VIO-2045", violation: "No Helmet", vehicle: "Scooter", plate: "KA 04 RT 3388", location: "Central Junction", camera: "CAM-07", date: "2026-08-28", time: "18:08", confidence: 89.7, status: "Resolved", severity: "High" },
];

export const historyRecords: ViolationRecord[] = [...recentViolations,
  { id: "VIO-2044", violation: "Wrong Lane", vehicle: "Hatchback", plate: "KA 02 NN 6102", location: "Ring Road", camera: "CAM-04", date: "2026-08-28", time: "17:54", confidence: 88.5, status: "Escalated", severity: "Medium" },
  { id: "VIO-2043", violation: "No Helmet", vehicle: "Motorcycle", plate: "KA 09 QW 2901", location: "Market Road", camera: "CAM-18", date: "2026-08-28", time: "17:39", confidence: 91.2, status: "Verified", severity: "High" },
];

export const analysisResults = recentViolations.slice(0, 3);
export const objectDetections = [
  { label: "Vehicles", count: 14, confidence: 98 },
  { label: "People", count: 9, confidence: 96 },
  { label: "Traffic lights", count: 2, confidence: 95 },
  { label: "Number plates", count: 8, confidence: 91 },
];
export const reportMetrics = [
  { label: "Total incidents", value: "1,248", detail: "This month" },
  { label: "Resolution rate", value: "84%", detail: "Across all cases" },
  { label: "Avg confidence", value: "93.6%", detail: "Detection confidence" },
  { label: "Peak hour", value: "18:00", detail: "Highest pressure" },
  { label: "Top location", value: "Central", detail: "Most incidents" },
  { label: "Cameras online", value: "18/18", detail: "Network status" },
];
export const weeklyTrend: ChartDatum[] = [
  { label: "Mon", value: 58 }, { label: "Tue", value: 67 }, { label: "Wed", value: 52 }, { label: "Thu", value: 74 }, { label: "Fri", value: 68 }, { label: "Sat", value: 88 }, { label: "Sun", value: 79 },
];
export const locationRisk: ChartDatum[] = [
  { label: "Central Junction", value: 86 }, { label: "Eastbound Signal", value: 72 }, { label: "Market Road", value: 58 }, { label: "Ring Road", value: 43 },
];
export const hourlyViolations: ChartDatum[] = [
  { label: "08 AM", value: 42 }, { label: "10 AM", value: 31 }, { label: "12 PM", value: 47 }, { label: "02 PM", value: 38 }, { label: "04 PM", value: 64 }, { label: "06 PM", value: 94 }, { label: "08 PM", value: 73 },
];
export const vehicleDistribution: ChartDatum[] = [
  { label: "Motorcycle", value: 82 }, { label: "Sedan", value: 61 }, { label: "Scooter", value: 49 }, { label: "Hatchback", value: 35 },
];
export const cameraPerformance: ChartDatum[] = [
  { label: "CAM-07", value: 97 }, { label: "CAM-12", value: 94 }, { label: "CAM-18", value: 91 }, { label: "CAM-04", value: 88 },
];
export const sampleSources = ["CAM-07 Central Junction", "CAM-12 Eastbound Signal", "CAM-18 Market Road"];