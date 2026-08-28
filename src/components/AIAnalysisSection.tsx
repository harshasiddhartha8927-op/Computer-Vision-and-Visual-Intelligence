import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  analyzeMedia,
  validateMediaFile,
  formatTimeSeconds,
  MediaAnalysisResult,
  ViolationItem,
  TimelineEvent,
  SeverityLevel
} from "../services/aiAnalysisService";

// Helper for formatting file size
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Icons
function UploadCloudIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PlayCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
    </svg>
  );
}

function CheckShieldIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SparklesIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    </svg>
  );
}

// Sample Preset Files for quick testing
const SAMPLE_FILES = [
  { name: "Central_Junction_Frame.jpg", kind: "image" as const, url: "/videos/sample-traffic.jpg", size: 2450000 },
  { name: "Highway_Monitor_Clip.mp4", kind: "video" as const, url: "/videos/bg-video-3.mp4", size: 14800000 }
];

export function AIAnalysisSection({ onSelectViolation }: { onSelectViolation?: (record: any) => void }) {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [analysisResult, setAnalysisResult] = useState<MediaAnalysisResult | null>(null);
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);

  // Video Ref for timestamp jumping
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File Handling
  const handleFileSelection = (file: File) => {
    setErrorMessage(null);
    setAnalysisResult(null);
    setSelectedViolationId(null);

    const validation = validateMediaFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Invalid file.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setMediaKind(validation.kind || (file.type.startsWith("video/") ? "video" : "image"));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaKind(null);
    setAnalysisResult(null);
    setErrorMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Run AI Analysis
  const runAnalysis = async (forceClean = false) => {
    if (!selectedFile && !previewUrl) {
      setErrorMessage("Please select or drop a valid image or video file first.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setUploadProgress(10);
    setProgressStage("Uploading media to AI analysis server...");

    try {
      // Simulate progress stages
      const stages = [
        { pct: 30, text: "Extracting frame vectors & temporal metadata..." },
        { pct: 60, text: "AI is analyzing your media (Object Detection & Classifier)..." },
        { pct: 85, text: "Evaluating violation confidence & generating insights..." }
      ];

      for (const stage of stages) {
        await new Promise((res) => setTimeout(res, 500));
        setUploadProgress(stage.pct);
        setProgressStage(stage.text);
      }

      let result: MediaAnalysisResult;
      if (forceClean) {
        // Option to demonstrate "No Violations Detected" state
        const { noViolationResult } = await import("../services/aiAnalysisService");
        result = { ...noViolationResult, mediaType: mediaKind || "image" };
      } else if (selectedFile) {
        result = await analyzeMedia(selectedFile, (pct) => setUploadProgress(pct));
      } else {
        // Sample file fallback
        const { fallbackImageResult, fallbackVideoResult } = await import("../services/aiAnalysisService");
        result = mediaKind === "video" ? fallbackVideoResult : fallbackImageResult;
      }

      setUploadProgress(100);
      setProgressStage("Analysis complete!");
      await new Promise((res) => setTimeout(res, 300));

      setAnalysisResult(result);
      if (result.violations.length > 0) {
        setSelectedViolationId(result.violations[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An error occurred during AI media analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Timestamp Jump for Videos
  const jumpToTimestamp = (timestampSeconds: number, violationId?: string) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestampSeconds;
      videoRef.current.play().catch(() => {});
    }
    if (violationId) {
      setSelectedViolationId(violationId);
    }
  };

  // Sample Loaders
  const loadSample = (sample: typeof SAMPLE_FILES[0]) => {
    setErrorMessage(null);
    setAnalysisResult(null);
    setSelectedViolationId(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(sample.url);
    setMediaKind(sample.kind);
    setSelectedFile(new File([""], sample.name, { type: sample.kind === "video" ? "video/mp4" : "image/jpeg" }));
  };

  // Severity Styling helper
  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case "high":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> 🔴 High Severity</span>;
      case "medium":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> ⚠️ Medium Severity</span>;
      case "low":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> 🔵 Low Severity</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 🟢 No Violation</span>;
    }
  };

  return (
    <section id="ai-analysis" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-28 pt-28 md:px-8 lg:px-16">
      {/* Background aesthetics */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-zinc-950/80 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        {/* Section Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/80 uppercase tracking-widest font-mono mb-4">
            <SparklesIcon className="w-4 h-4 text-amber-400" /> AI Vision Inspection
          </div>
          <h2 className="font-heading text-4xl sm:text-6xl lg:text-7xl italic text-white leading-none">
            AI Media Analysis & Violation Detection
          </h2>
          <p className="mt-4 max-w-3xl font-body text-sm sm:text-base font-light text-white/70 leading-relaxed">
            Upload traffic camera footage or snapshot frames. Our Computer Vision AI model automatically parses objects, identifies traffic non-compliance, and renders interactive timeline evidence.
          </p>
        </div>

        {/* Error Alert Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 flex items-start justify-between gap-4 backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <AlertTriangleIcon className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">Upload Error</h4>
                  <p className="text-xs text-red-300/90 mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-xs font-mono text-red-400 hover:text-red-200 px-2 py-1 rounded bg-red-900/40"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Grid: Upload & Preview Area */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* Left Column: Drag & Drop Upload Controls */}
          <div className="liquid-glass rounded-[1.5rem] p-6 flex flex-col justify-between gap-6 border border-white/10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-2xl italic text-white">1. Select Traffic Media</h3>
                <span className="text-xs font-mono text-white/50">Max 100MB</span>
              </div>

              {/* Drag and Drop Zone */}
              <input
                ref={fileInputRef}
                id="ai-media-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm"
                className="sr-only"
                onChange={handleInputChange}
                disabled={isAnalyzing}
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`upload-zone relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                  isDragging
                    ? "border-amber-400 bg-amber-500/10 scale-[1.01]"
                    : previewUrl
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-4 text-white">
                  <UploadCloudIcon className="w-8 h-8 text-amber-400" />
                </div>
                <h4 className="font-heading text-2xl italic text-white">
                  {isDragging ? "Drop your media here" : "Drag & Drop Image or Video"}
                </h4>
                <p className="mt-2 text-xs font-light text-white/70 max-w-xs">
                  Supports <strong className="text-white">JPG, PNG, WEBP</strong> for images and <strong className="text-white">MP4, MOV, AVI, WEBM</strong> for videos.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition hover:bg-white/90">
                  <span>Browse File</span>
                </div>
              </div>

              {/* Quick Sample Presets */}
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2 font-mono">Or try demo samples:</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_FILES.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => loadSample(sample)}
                      disabled={isAnalyzing}
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-mono text-white/80 transition flex items-center gap-1.5"
                    >
                      {sample.kind === "video" ? <PlayCircleIcon className="w-3.5 h-3.5 text-amber-400" /> : "📷"}
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected File Card Details */}
              {previewUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold text-amber-300 text-xs">
                      {mediaKind === "video" ? "VID" : "IMG"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{selectedFile?.name || "Sample_Traffic_Media"}</p>
                      <p className="text-xs text-white/60">
                        {mediaKind === "video" ? "Video File" : "Image Frame"} • {selectedFile ? formatBytes(selectedFile.size) : "2.4 MB"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isAnalyzing}
                    className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 transition"
                    title="Remove file"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>

            {/* Analyze Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => runAnalysis(false)}
                disabled={!previewUrl || isAnalyzing}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black font-heading text-xl italic font-bold tracking-wide transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-amber-500/20"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing with AI...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    <span>Analyze with AI</span>
                  </>
                )}
              </button>

              {/* Demo Clean State Toggle button */}
              <button
                type="button"
                onClick={() => runAnalysis(true)}
                disabled={!previewUrl || isAnalyzing}
                className="w-full py-2.5 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-mono text-xs transition"
              >
                Test Clean Scene (0 Violations State)
              </button>
            </div>
          </div>

          {/* Right Column: Media Preview & Real-Time Bounding Box Overlay */}
          <div className="liquid-glass rounded-[1.5rem] p-6 flex flex-col justify-between gap-6 border border-white/10 relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-2xl italic text-white">2. Live Media & Vision Overlay</h3>
                {analysisResult && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                      className={`px-3 py-1 rounded-full text-xs font-mono border transition ${
                        showBoundingBoxes ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-white/10 text-white/60 border-white/10"
                      }`}
                    >
                      {showBoundingBoxes ? "Hide AI Boxes" : "Show AI Boxes"}
                    </button>
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              {isAnalyzing && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs font-mono text-amber-300 mb-2">
                    <span>{progressStage}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Media Container */}
              <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/15 min-h-[340px] flex items-center justify-center">
                {previewUrl ? (
                  mediaKind === "video" ? (
                    <video
                      ref={videoRef}
                      src={previewUrl}
                      controls
                      playsInline
                      className="w-full max-h-[460px] object-contain"
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img src={previewUrl} alt="Traffic Preview" className="w-full max-h-[460px] object-contain" />

                      {/* Interactive Bounding Boxes Overlay for Images */}
                      {showBoundingBoxes &&
                        analysisResult?.violations.map((v) => {
                          if (!v.boundingBox) return null;
                          const isSelected = selectedViolationId === v.id;
                          return (
                            <motion.div
                              key={v.id}
                              onClick={() => setSelectedViolationId(v.id)}
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`absolute border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? "border-red-500 bg-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.6)] z-30 scale-[1.02]"
                                  : "border-amber-400/80 bg-amber-400/10 hover:border-white z-20"
                              }`}
                              style={{
                                top: `${v.boundingBox.top}%`,
                                left: `${v.boundingBox.left}%`,
                                width: `${v.boundingBox.width}%`,
                                height: `${v.boundingBox.height}%`
                              }}
                            >
                              <span
                                className={`absolute -top-7 left-0 px-2 py-0.5 text-[10px] font-mono font-bold rounded shadow ${
                                  isSelected ? "bg-red-600 text-white" : "bg-amber-500 text-black"
                                }`}
                              >
                                {v.boundingBox.label}
                              </span>
                            </motion.div>
                          );
                        })}
                    </div>
                  )
                ) : (
                  <div className="p-8 text-center text-white/40">
                    <p className="font-heading text-2xl italic text-white/30">No Media Selected</p>
                    <p className="text-xs font-mono mt-1">Upload a file on the left to activate preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. AI Analysis Results Panel */}
        {analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="liquid-glass rounded-[1.5rem] p-6 lg:p-8 border border-white/15 space-y-8"
          >
            {/* Panel Top Stats Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-heading text-3xl sm:text-4xl italic text-white">Analysis Results</h3>
                  {analysisResult.totalViolations > 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-300">
                      {analysisResult.totalViolations} Violation{analysisResult.totalViolations > 1 ? "s" : ""} Flagged
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                      <CheckShieldIcon className="w-4 h-4" /> No Violations Detected
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/60 font-mono mt-1">{analysisResult.summary}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <span className="text-[10px] uppercase font-mono text-white/50 block">Risk Rating</span>
                  <span className="font-heading text-xl italic font-bold text-white">{analysisResult.riskLevel}</span>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <span className="text-[10px] uppercase font-mono text-white/50 block">Detected Objects</span>
                  <span className="font-heading text-xl italic font-bold text-white">{analysisResult.objects.length} Classes</span>
                </div>
              </div>
            </div>

            {/* Video Interactive Timeline Section (For Videos) */}
            {mediaKind === "video" && analysisResult.timeline.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-heading text-2xl italic text-white flex items-center gap-2">
                  <PlayCircleIcon className="w-5 h-5 text-amber-400" /> Interactive Video Timeline
                </h4>
                <p className="text-xs text-white/60 font-mono">
                  Click any timeline marker to jump the video directly to the detected event:
                </p>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {analysisResult.timeline.map((event, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => jumpToTimestamp(event.timestamp, event.violationId)}
                      className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                        event.severity === "high"
                          ? "bg-red-950/30 border-red-500/50 hover:bg-red-900/40"
                          : event.severity === "medium"
                          ? "bg-amber-950/30 border-amber-500/50 hover:bg-amber-900/40"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-amber-400">{event.formattedTime}</span>
                        {event.severity === "high" && <span className="text-xs">🔴 High</span>}
                        {event.severity === "medium" && <span className="text-xs">⚠️ Med</span>}
                        {event.severity === "none" && <span className="text-xs text-emerald-400">✓ Clean</span>}
                      </div>
                      <p className="font-semibold text-sm text-white line-clamp-1">{event.title}</p>
                      <p className="text-[11px] text-white/60 line-clamp-2">{event.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Detected Violation Breakdown Cards */}
            {analysisResult.totalViolations > 0 ? (
              <div className="space-y-4">
                <h4 className="font-heading text-2xl italic text-white">Detected Violation Breakdown</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {analysisResult.violations.map((violation) => {
                    const isSelected = selectedViolationId === violation.id;
                    return (
                      <motion.div
                        key={violation.id}
                        onClick={() => setSelectedViolationId(violation.id)}
                        whileHover={{ scale: 1.01 }}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white/15 border-amber-400 shadow-xl"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <span className="text-[10px] font-mono text-white/50 uppercase">{violation.id}</span>
                            <h5 className="font-heading text-2xl italic font-bold text-white">{violation.category}</h5>
                          </div>
                          {getSeverityBadge(violation.severity)}
                        </div>

                        <p className="text-xs text-white/80 font-light leading-relaxed mb-4">{violation.description}</p>

                        <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-white/10 text-white/70">
                          <span>Confidence: <strong className="text-amber-400">{violation.confidence}%</strong></span>
                          {violation.formattedTime && <span>Time: <strong className="text-white">{violation.formattedTime}</strong></span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Clean State Notification */
              <div className="p-8 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckShieldIcon className="w-6 h-6" />
                </div>
                <h4 className="font-heading text-3xl italic text-white">No Violations Detected</h4>
                <p className="text-xs text-emerald-200/80 max-w-md mx-auto">
                  The AI model scanned all vehicle paths and rider attributes. All movement patterns comply with standard road safety guidelines with {analysisResult.summary}
                </p>
              </div>
            )}

            {/* Recommendations & Actionable Insights */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h5 className="font-heading text-xl italic text-white">AI Enforcement Recommendations</h5>
              <div className="grid gap-2 text-xs text-white/70 font-mono">
                {analysisResult.recommendations.map((rec, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <span className="text-amber-400">➜</span> {rec}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
