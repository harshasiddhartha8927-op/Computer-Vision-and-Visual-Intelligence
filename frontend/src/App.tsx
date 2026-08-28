import { ChangeEvent, CSSProperties, ReactNode, SVGProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  analysisResults,
  cameraFeeds,
  cameraPerformance,
  dashboardMetrics,
  heroStats,
  historyRecords,
  hourlyViolations,
  liveOverview,
  locationRisk,
  objectDetections,
  recentViolations,
  reportMetrics,
  sampleSources,
  vehicleDistribution,
  violationDistribution,
  weeklyTrend,
  type CameraFeed,
  type ChartDatum,
  type DetectionBox,
  type ViolationRecord,
} from "./data/trafficData";
import { useViolations, useRecentViolations } from "./hooks/useViolations";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";

type IconProps = SVGProps<SVGSVGElement>;

const motionInitial = { filter: "blur(10px)", opacity: 0, y: 20 };
const motionAnimate = { filter: "blur(0px)", opacity: 1, y: 0 };
const motionTransition = { duration: 0.8, ease: "easeOut" as const };

const navLinks = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "Live Monitor", href: "#live-monitor" },
  { label: "AI Analysis", href: "#ai-analysis" },
  { label: "History", href: "#history" },
  { label: "Reports", href: "#reports" },
];

const pipeline = ["Camera Feed", "Computer Vision", "Detection", "Evidence", "Analysis", "Insights", "Action"];
const analysisPipeline = ["Image", "Object Detection", "Violation Classification", "Confidence", "Insight"];
const analysisSteps = ["Processing", "Detection", "Results", "Intelligence"] as const;

type GeminiViolationResult = {
  label: string;
  value: string;
  confidence: number;
};

type GeminiObjectResult = {
  label: string;
  count: number;
  confidence: number;
};

type GeminiTrafficAnalysis = {
  source?: string;
  riskLevel: string;
  summary: string;
  detectedViolations: GeminiViolationResult[];
  objects: GeminiObjectResult[];
  recommendations: string[];
};

type GeminiApiResponse = {
  ok?: boolean;
  error?: string;
  analysis?: unknown;
};

type UploadedTrafficMedia = {
  name: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  kind: "image" | "video";
};

const maxDirectUploadBytes = 100 * 1024 * 1024;

const fallbackTrafficAnalysis: GeminiTrafficAnalysis = {
  source: "fallback",
  riskLevel: "High",
  summary:
    "The scene contains 14 vehicles and 9 detected riders. Three helmet violations were detected, with the highest-confidence violation at 97.2%. Traffic density is moderate but violation frequency is concentrated near the stop-line zone.",
  detectedViolations: [
    { label: "Helmet Violations", value: "3", confidence: 97 },
    { label: "Red-Light Violation", value: "1", confidence: 94 },
    { label: "Triple-Riding Violations", value: "2", confidence: 92 },
  ],
  objects: [
    { label: "Vehicles", count: 14, confidence: 98 },
    { label: "People", count: 9, confidence: 96 },
    { label: "Traffic lights", count: 2, confidence: 95 },
    { label: "Number plates", count: 8, confidence: 91 },
  ],
  recommendations: [
    "Prioritize manual review for the highest-confidence helmet violation.",
    "Compare the frame against signal timing before issuing the red-light violation.",
    "Increase live monitoring at this junction during evening density peaks.",
  ],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function clampPercent(value: unknown, fallback: number) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

function normalizeTrafficAnalysisResponse(value: unknown): GeminiTrafficAnalysis {
  const record = asRecord(value);
  const detectedViolations = Array.isArray(record.detectedViolations) ? record.detectedViolations : fallbackTrafficAnalysis.detectedViolations;
  const objects = Array.isArray(record.objects) ? record.objects : fallbackTrafficAnalysis.objects;
  const recommendations = Array.isArray(record.recommendations) ? record.recommendations : fallbackTrafficAnalysis.recommendations;

  return {
    source: typeof record.source === "string" ? record.source : "gemini",
    riskLevel: typeof record.riskLevel === "string" && record.riskLevel.trim() ? record.riskLevel.trim() : fallbackTrafficAnalysis.riskLevel,
    summary: typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : fallbackTrafficAnalysis.summary,
    detectedViolations: detectedViolations.slice(0, 5).map((item, index) => {
      const violation = asRecord(item);
      const fallback = fallbackTrafficAnalysis.detectedViolations[index] ?? fallbackTrafficAnalysis.detectedViolations[0];

      return {
        label: typeof violation.label === "string" && violation.label.trim() ? violation.label.trim() : fallback.label,
        value: String(violation.value ?? fallback.value),
        confidence: clampPercent(violation.confidence, fallback.confidence),
      };
    }),
    objects: objects.slice(0, 6).map((item, index) => {
      const detectedObject = asRecord(item);
      const fallback = fallbackTrafficAnalysis.objects[index] ?? fallbackTrafficAnalysis.objects[0];

      return {
        label: typeof detectedObject.label === "string" && detectedObject.label.trim() ? detectedObject.label.trim() : fallback.label,
        count: Number.isFinite(Number(detectedObject.count)) ? Number(detectedObject.count) : fallback.count,
        confidence: clampPercent(detectedObject.confidence, fallback.confidence),
      };
    }),
    recommendations: recommendations
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .slice(0, 4),
  };
}

type FadingVideoProps = {
  src: string | string[];
  className?: string;
  playbackRate?: number;
  style?: CSSProperties;
};

function FadingVideo({ src, className = "", playbackRate = 1, style }: FadingVideoProps) {
  const sources = useMemo(() => (Array.isArray(src) ? src : [src]), [src]);
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const opacityRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const fadeOutArmedRef = useRef(false);

  const fadeTo = useCallback((targetOpacity: number, duration: number) => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const startOpacity = opacityRef.current;
    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextOpacity = startOpacity + (targetOpacity - startOpacity) * easedProgress;

      opacityRef.current = nextOpacity;
      setOpacity(nextOpacity);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        opacityRef.current = targetOpacity;
        setOpacity(targetOpacity);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    setIndex(0);
    fadeOutArmedRef.current = false;
    opacityRef.current = 0;
    setOpacity(0);
  }, [sources]);

  useEffect(() => {
    fadeOutArmedRef.current = false;
    opacityRef.current = 0;
    setOpacity(0);
  }, [index]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, index]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleLoadedData = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }

    fadeOutArmedRef.current = false;
    fadeTo(1, 500);
  };

  const handleTimeUpdate = () => {
    if (sources.length === 1) {
      return;
    }

    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) {
      return;
    }

    const remainingTime = video.duration - video.currentTime;

    if (remainingTime <= 0.55 && !fadeOutArmedRef.current) {
      fadeOutArmedRef.current = true;
      fadeTo(0, 550);
    }
  };

  const handleEnded = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    fadeOutArmedRef.current = false;

    if (sources.length === 1) {
      fadeTo(1, 500);
      return;
    }

    setIndex((currentIndex) => (currentIndex + 1) % sources.length);
  };

  return (
    <video
      ref={videoRef}
      key={`${sources[index]}-${index}`}
      src={sources[index]}
      className={className}
      style={{ ...style, opacity }}
      autoPlay
      loop={sources.length === 1}
      muted
      playsInline
      preload="auto"
      onLoadedData={handleLoadedData}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}

type BlurTextProps = {
  text: string;
  className?: string;
};

function BlurText({ text, className = "" }: BlurTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const words = useMemo(() => text.split(" "), [text]);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        rowGap: "0.1em",
      }}
    >
      {words.map((word, wordIndex) => (
        <motion.span
          key={`${word}-${wordIndex}`}
          initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
          animate={isVisible ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: 50 }}
          transition={{ duration: 0.7, delay: wordIndex * 0.1, ease: "easeOut" }}
          style={{ display: "inline-block", marginRight: "0.28em" }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

function ArrowUpRight({ className = "h-5 w-5", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Play({ className = "h-5 w-5", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
    </svg>
  );
}

function ClockIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GlobeIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 3c2.1 2.35 3.15 5.35 3.15 9S14.1 18.65 12 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 3C9.9 5.35 8.85 8.35 8.85 12S9.9 18.65 12 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M19 3H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM8.5 8.75a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5ZM19 18H5l4.2-5.4 2.8 3.35 3.85-4.95L19 18Z"
      />
    </svg>
  );
}

function MovieIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2ZM8 6l2 3H7.75l-2-3H8Zm4.75 0 2 3H12.5l-2-3h2.25ZM20 6v3h-3l-2-3h5ZM4 6h.5l2 3H4V6Zm0 12v-7h16v7H4Z"
      />
    </svg>
  );
}

function LightbulbIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M9 21h6v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.35 1.15 4.43 2.92 5.7.55.4 1.08 1.17 1.08 1.85V18h6v-1.45c0-.68.53-1.45 1.08-1.85A6.92 6.92 0 0 0 19 9c0-3.86-3.14-7-7-7Z"
      />
    </svg>
  );
}

function CameraIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 8.5c0-1.1.9-2 2-2h2.6L10 4.5h4l1.4 2H18c1.1 0 2 .9 2 2v8.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8.5Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CarIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M6 16h12M7 18.5h.01M17 18.5h.01M5 16l1.7-5.1A2 2 0 0 1 8.6 9.5h6.8a2 2 0 0 1 1.9 1.4L19 16v3H5v-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3.5 19 6v5.2c0 4.45-2.85 8.35-7 9.3-4.15-.95-7-4.85-7-9.3V6l7-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8.7 12.1 2.2 2.2 4.7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="m15.4 15.4 4.1 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 16V5m0 0 4 4m-4-4L8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DatabaseIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6v6c0 1.65 3.13 3 7 3s7-1.35 7-3V6M5 12v6c0 1.65 3.13 3 7 3s7-1.35 7-3v-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChartIcon({ className = "h-6 w-6", ...props }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5 19V5M5 19h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 16v-4m4 4V8m4 8v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={motionInitial}
      whileInView={motionAnimate}
      viewport={{ once: false, amount: 0.16 }}
      transition={{ ...motionTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatusPill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={`liquid-glass inline-flex items-center gap-2 rounded-full px-3 py-1 font-body text-[11px] font-medium text-white/90 ${active ? "status-active" : ""}`}>
      {active ? <span className="live-dot" /> : null}
      {children}
    </span>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return <div className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.75rem] text-white">{children}</div>;
}

function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between font-body text-xs text-white/70">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-white"
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: false }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function DetectionFrame({
  boxes,
  label,
  className = "",
  dense = false,
  mediaPreview = null,
}: {
  boxes: DetectionBox[];
  label?: string;
  className?: string;
  dense?: boolean;
  mediaPreview?: UploadedTrafficMedia | null;
}) {
  return (
    <div className={`feed-surface relative overflow-hidden rounded-[1.25rem] ${className}`}>
      {mediaPreview?.kind === "video" ? (
        <video
          src={mediaPreview.previewUrl}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          title={`${mediaPreview.name} preview`}
        />
      ) : null}
      {mediaPreview?.kind === "image" ? (
        <img src={mediaPreview.previewUrl} alt={`${mediaPreview.name} preview`} className="absolute inset-0 h-full w-full object-cover opacity-85" />
      ) : null}
      <div className={`absolute inset-0 feed-grid ${mediaPreview ? "opacity-55" : ""}`} aria-hidden="true" />
      <div className="absolute inset-0 scan-line" aria-hidden="true" />
      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
        <StatusPill active>LIVE</StatusPill>
        {label ? <StatusPill>{label}</StatusPill> : null}
      </div>
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-4">
        <div>
          <p className="font-body text-[11px] uppercase text-white/60">AI scene lock</p>
          <p className="font-heading text-3xl italic leading-none text-white">{dense ? "Frame" : "Traffic stream"}</p>
        </div>
        <div className="liquid-glass rounded-full px-3 py-1 font-body text-xs text-white/90">96.8% confidence</div>
      </div>
      {boxes.map((box) => (
        <div
          key={`${box.label}-${box.left}-${box.top}`}
          className={`detection-box detection-${box.variant}`}
          style={{
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        >
          <span>
            {box.label}
            {box.confidence ? ` ${box.confidence}%` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionBackdrop() {
  return (
    <>
      <FadingVideo src="/videos/bg-video-3.mp4" className="absolute inset-0 z-0 h-full w-full object-cover opacity-70" playbackRate={0.8} />
      <div className="absolute inset-0 z-[1] bg-black/58" aria-hidden="true" />
      <div className="absolute inset-0 z-[2] section-vignette" aria-hidden="true" />
    </>
  );
}

function SectionHeader({ label, title, copy }: { label: string; title: string; copy: string }) {
  return (
    <Reveal className="max-w-4xl">
      <p className="mb-5 font-body text-sm text-white/80">// {label}</p>
      <h2 className="whitespace-pre-line font-heading text-5xl italic leading-[0.88] text-white md:text-7xl lg:text-[5.7rem]">{title}</h2>
      <p className="mt-5 max-w-2xl font-body text-sm font-light leading-tight text-white/80 md:text-base">{copy}</p>
    </Reveal>
  );
}

function Navbar() {
  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  return (
    <>
      <nav className="fixed left-0 right-0 top-4 z-50 flex items-center justify-between px-5 md:px-8 lg:px-16" aria-label="Main navigation">
        <a href="#landing" className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full text-white" aria-label="Traffic Violation Intelligence home">
          <span className="font-heading text-2xl italic leading-none">t</span>
        </a>

        <div className="liquid-glass hidden items-center rounded-full px-1.5 py-1.5 md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="px-3 py-2 font-body text-sm font-medium text-white/90 transition hover:text-white">
              {link.label}
            </a>
          ))}
          <a
            href="#analyze-traffic"
            className="ml-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-body text-sm font-semibold text-black transition hover:bg-white/85"
          >
            Analyze Traffic
            <ArrowUpRight className="h-4 w-4" />
          </a>
          {isSupabaseConfigured && (
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 px-3 py-2 font-body text-xs font-medium text-white/60 hover:text-white transition"
              title="Sign out"
            >
              Sign Out
            </button>
          )}
        </div>

        <div className="h-12 w-12" aria-hidden="true" />
      </nav>

      <div className="fixed bottom-4 left-3 right-3 z-50 md:hidden">
        <div className="liquid-glass flex gap-2 overflow-x-auto rounded-full px-2 py-2 mobile-nav-scroll">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="shrink-0 rounded-full px-3 py-2 font-body text-xs font-medium text-white/90">
              {link.label}
            </a>
          ))}
          <a href="#analyze-traffic" className="shrink-0 rounded-full bg-white px-3 py-2 font-body text-xs font-semibold text-black">
            Analyze Traffic
          </a>
        </div>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section id="landing" className="relative h-screen overflow-hidden bg-black">
      <FadingVideo
        src="/videos/bg-video-2.mp4"
        className="absolute left-1/2 top-0 z-0 -translate-x-1/2 object-cover object-top"
        playbackRate={0.85}
        style={{ width: "120%", height: "120%" }}
      />
      <div className="absolute inset-0 z-[1] bg-black/38" aria-hidden="true" />
      <div className="absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.12)_48%,rgba(0,0,0,0.56))]" aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="hero-copy flex flex-1 flex-col items-center justify-center px-4 pt-24 text-center">
          <motion.div
            initial={motionInitial}
            whileInView={motionAnimate}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ ...motionTransition, delay: 0.4 }}
            className="liquid-glass inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full px-3 py-2 font-body text-xs font-light text-white/90 sm:px-4 sm:text-sm"
          >
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black">AI</span>
            <span className="min-w-0">Computer Vision traffic command center - live violation intelligence</span>
          </motion.div>

          <div className="mt-5 max-w-4xl lg:mt-6">
            <BlurText
              text="Traffic Violation Intelligence for Safer Roads"
              className="hero-title font-heading text-[3rem] italic leading-[0.82] tracking-normal text-white sm:text-6xl md:text-7xl lg:text-[5rem] 2xl:text-[5.5rem]"
            />
          </div>

          <motion.p
            initial={motionInitial}
            whileInView={motionAnimate}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ ...motionTransition, delay: 0.8 }}
            className="hero-subtext mt-3 max-w-2xl font-body text-sm font-light leading-tight text-white md:text-base lg:mt-4"
          >
            Analyze live camera feeds, detect traffic violations, preserve evidence, and convert visual data into road-safety intelligence for faster action.
          </motion.p>

          <motion.div
            initial={motionInitial}
            whileInView={motionAnimate}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ ...motionTransition, delay: 1.1 }}
            className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:mt-5"
          >
            <a href="#analyze-traffic" className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm font-medium text-white">
              Analyze Traffic
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href="#live-monitor" className="inline-flex items-center gap-2 font-body text-sm font-medium text-white transition hover:text-white/75">
              <Play className="h-4 w-4" />
              View Live Monitor
            </a>
          </motion.div>

          <motion.div
            initial={motionInitial}
            whileInView={motionAnimate}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ ...motionTransition, delay: 1.3 }}
            className="hero-stats mt-5 flex w-full flex-row flex-wrap items-center justify-center gap-4 sm:w-auto lg:mt-6"
          >
            {heroStats.map((item, index) => {
              const StatIcon = index === 0 ? ShieldIcon : CameraIcon;

              return (
                <div
                  key={item.value}
                  className="hero-stat-card liquid-glass w-[calc((100vw-4.25rem)/2)] max-w-[220px] rounded-[1.25rem] p-5 text-left sm:w-[220px]"
                >
                  <StatIcon className="h-6 w-6 text-white/90" />
                  <div className="hero-stat-value mt-4 font-heading text-4xl italic leading-none tracking-normal text-white">{item.value}</div>
                  <p className="mt-2 max-w-[18ch] font-body text-xs font-light uppercase leading-tight text-white/80">{item.label}</p>
                </div>
              );
            })}
          </motion.div>
        </div>

        <motion.div
          initial={motionInitial}
          whileInView={motionAnimate}
          viewport={{ once: false, amount: 0.25 }}
          transition={{ ...motionTransition, delay: 1.4 }}
          className="hero-trust flex flex-col items-center gap-3 px-4 pb-5 text-center lg:gap-4 lg:pb-6"
        >
          <div className="liquid-glass max-w-[calc(100vw-2rem)] rounded-full px-5 py-2 font-body text-xs font-light text-white/90 sm:text-sm">
            Camera Feed - Computer Vision - Detection - Evidence - Analysis - Insights - Action
          </div>
          <div className="hero-trust-logos flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {pipeline.slice(1, 6).map((name) => (
              <span key={name} className="font-heading text-2xl italic tracking-normal text-white/90 md:text-3xl">
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Dashboard({ onSelectViolation }: { onSelectViolation: (record: ViolationRecord) => void }) {
  const overviewBoxes = cameraFeeds[0].boxes;

  return (
    <section id="dashboard" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-24 pt-28 md:px-8 lg:px-16">
      <SectionBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <SectionHeader
          label="Dashboard"
          title={"Road intelligence,\nright now"}
          copy="A command center view of current road conditions, active detections, violation pressure, and system confidence across the camera network."
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {dashboardMetrics.map((metric, index) => (
            <Reveal key={metric.label} delay={index * 0.05}>
              <div className="liquid-glass h-full rounded-[1.25rem] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-body text-xs uppercase text-white/60">{metric.label}</p>
                  <StatusPill>{metric.trend}</StatusPill>
                </div>
                <p className="mt-6 font-heading text-4xl italic leading-none text-white">{metric.value}</p>
                <p className="mt-2 font-body text-xs font-light leading-tight text-white/70">{metric.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.9fr]">
          <Reveal>
            <div className="liquid-glass-strong rounded-[1.25rem] p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-xs uppercase text-white/60">Live overview</p>
                  <h3 className="font-heading text-4xl italic leading-none text-white">{liveOverview.camera} - {liveOverview.location}</h3>
                </div>
                <StatusPill active>Operational</StatusPill>
              </div>
              <DetectionFrame boxes={overviewBoxes} label="Current detected violations" className="min-h-[360px]" />
            </div>
          </Reveal>

          <div className="grid gap-6">
            <Reveal delay={0.08}>
              <div className="liquid-glass rounded-[1.25rem] p-5">
                <div className="flex items-start justify-between gap-4">
                  <IconTile>
                    <CameraIcon className="h-6 w-6" />
                  </IconTile>
                  <StatusPill active>Live indicator</StatusPill>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <MetricMini label="Location" value={liveOverview.location} />
                  <MetricMini label="Vehicle count" value={String(liveOverview.vehicles)} />
                  <MetricMini label="Traffic density" value={liveOverview.density} />
                  <MetricMini label="Violations" value={String(liveOverview.violations)} />
                </div>
                <div className="mt-6">
                  <Meter value={Math.round(liveOverview.confidence)} label="AI confidence" />
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="liquid-glass rounded-[1.25rem] p-5">
                <p className="font-body text-xs uppercase text-white/60">AI Insight</p>
                <p className="mt-4 font-heading text-3xl italic leading-[0.95] text-white">Violation pressure is highest around Central Junction between 6 PM and 8 PM.</p>
                <p className="mt-4 font-body text-sm font-light leading-snug text-white/80">
                  Red-light and helmet violations account for the majority of live incidents. Repositioning enforcement near the eastbound signal could reduce repeat cases.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <Reveal>
            <DistributionPanel />
          </Reveal>
          <Reveal delay={0.1}>
            <RecentViolations onSelectViolation={onSelectViolation} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="liquid-glass rounded-[1rem] p-3">
      <p className="font-body text-[11px] uppercase text-white/55">{label}</p>
      <p className="mt-2 font-heading text-2xl italic leading-none text-white">{value}</p>
    </div>
  );
}

function DistributionPanel() {
  return (
    <div className="liquid-glass rounded-[1.25rem] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase text-white/60">Violation distribution</p>
          <h3 className="font-heading text-4xl italic leading-none text-white">Detected patterns</h3>
        </div>
        <IconTile>
          <ChartIcon className="h-6 w-6" />
        </IconTile>
      </div>
      <div className="space-y-4">
        {violationDistribution.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 font-body text-xs text-white/80">
              <span>{item.label}</span>
              <span>{item.count}</span>
            </div>
            <Meter value={item.percent} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentViolations({ onSelectViolation }: { onSelectViolation: (record: ViolationRecord) => void }) {
  return (
    <div className="liquid-glass rounded-[1.25rem] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase text-white/60">Recent violations</p>
          <h3 className="font-heading text-4xl italic leading-none text-white">Latest incidents</h3>
        </div>
        <StatusPill active>Streaming evidence</StatusPill>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-white/10 font-body text-xs uppercase text-white/50">
              <th className="py-3 pr-4 text-left font-medium">Violation</th>
              <th className="py-3 pr-4 text-left font-medium">Vehicle</th>
              <th className="py-3 pr-4 text-left font-medium">Location</th>
              <th className="py-3 pr-4 text-left font-medium">Time</th>
              <th className="py-3 pr-4 text-left font-medium">Confidence</th>
              <th className="py-3 pr-4 text-left font-medium">Status</th>
              <th className="py-3 text-right font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {recentViolations.map((record) => (
              <tr key={record.id} className="border-b border-white/10 font-body text-sm text-white/80">
                <td className="py-4 pr-4 text-white">{record.violation}</td>
                <td className="py-4 pr-4">{record.vehicle}</td>
                <td className="py-4 pr-4">{record.location}</td>
                <td className="py-4 pr-4">{record.time}</td>
                <td className="py-4 pr-4">{record.confidence}%</td>
                <td className="py-4 pr-4">{record.status}</td>
                <td className="py-4 text-right">
                  <button type="button" className="font-body text-sm font-medium text-white underline decoration-white/30 underline-offset-4" onClick={() => onSelectViolation(record)}>
                    View Evidence
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiveMonitor() {
  return (
    <section id="live-monitor" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-24 pt-28 md:px-8 lg:px-16">
      <SectionBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <SectionHeader
          label="Live Monitor"
          title={"Real-time feeds,\nAI detection"}
          copy="Camera cards show active density, vehicle volume, detection status, and animated computer-vision overlays for the current violations."
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cameraFeeds.map((camera, index) => (
            <Reveal key={camera.id} delay={index * 0.06}>
              <CameraCard camera={camera} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CameraCard({ camera }: { camera: CameraFeed }) {
  return (
    <article className="liquid-glass flex min-h-[460px] flex-col rounded-[1.25rem] p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase text-white/55">{camera.id}</p>
          <h3 className="mt-1 font-heading text-3xl italic leading-none text-white">{camera.location}</h3>
        </div>
        <StatusPill active>LIVE</StatusPill>
      </div>
      <DetectionFrame boxes={camera.boxes} label={camera.alert} className="min-h-[230px]" dense />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricMini label="Traffic density" value={camera.density} />
        <MetricMini label="Vehicles" value={String(camera.vehicles)} />
        <MetricMini label="Violations" value={String(camera.violations)} />
        <MetricMini label="AI status" value={camera.processing} />
      </div>
      <div className="mt-4">
        <Meter value={Math.round(camera.confidence)} label={`${camera.alert} confidence`} />
      </div>
    </article>
  );
}

function AIAnalysis({ onSelectViolation }: { onSelectViolation: (record: ViolationRecord) => void }) {
  return (
    <section id="ai-analysis" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-24 pt-28 md:px-8 lg:px-16">
      <SectionBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <SectionHeader
          label="AI Analysis"
          title={"Scene understanding,\nstep by step"}
          copy="A visual explanation of how the system converts camera frames into objects, violations, confidence scores, and actionable insight."
        />

        <Reveal>
          <div className="liquid-glass rounded-[1.25rem] p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-5">
              {analysisPipeline.map((step, index) => (
                <div key={step} className="liquid-glass rounded-full px-4 py-3 text-center font-body text-xs font-medium text-white/90">
                  {index + 1}. {step}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Reveal>
            <div className="liquid-glass-strong rounded-[1.25rem] p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-xs uppercase text-white/60">Input frame</p>
                  <h3 className="font-heading text-4xl italic leading-none text-white">Central Junction analysis</h3>
                </div>
                <StatusPill active>Processing</StatusPill>
              </div>
              <DetectionFrame boxes={cameraFeeds[0].boxes} label="Object detection active" className="min-h-[420px]" />
            </div>
          </Reveal>

          <div className="grid gap-6">
            <Reveal delay={0.08}>
              <div className="liquid-glass rounded-[1.25rem] p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-body text-xs uppercase text-white/60">Detected objects</p>
                    <h3 className="font-heading text-4xl italic leading-none text-white">Vision map</h3>
                  </div>
                  <IconTile>
                    <SearchIcon className="h-6 w-6" />
                  </IconTile>
                </div>
                <div className="space-y-4">
                  {objectDetections.map((object) => (
                    <div key={object.label}>
                      <div className="mb-2 flex items-center justify-between font-body text-xs text-white/80">
                        <span>{object.label} - {object.count}</span>
                        <span>{object.confidence}%</span>
                      </div>
                      <Meter value={Math.round(object.confidence)} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="liquid-glass rounded-[1.25rem] p-5">
                <p className="font-body text-xs uppercase text-white/60">AI Detection</p>
                <p className="mt-4 font-heading text-3xl italic leading-[0.95] text-white">Two-wheeler detected without helmet.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MetricMini label="Confidence" value="96.8%" />
                  <MetricMini label="Violation" value="Helmet" />
                  <MetricMini label="Vehicle" value="Motorcycle" />
                  <MetricMini label="Plate" value="KA 03 HM 4821" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal>
          <ResultRecords title="Detection results" records={analysisResults} onSelectViolation={onSelectViolation} />
        </Reveal>
      </div>
    </section>
  );
}

function ResultRecords({ title, records, onSelectViolation }: { title: string; records: ViolationRecord[]; onSelectViolation: (record: ViolationRecord) => void }) {
  return (
    <div className="liquid-glass rounded-[1.25rem] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-4xl italic leading-none text-white">{title}</h3>
        <StatusPill>{records.length} matches</StatusPill>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {records.map((record) => (
          <article key={record.id} className="liquid-glass rounded-[1rem] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[11px] uppercase text-white/55">{record.id}</p>
                <h4 className="mt-2 font-heading text-3xl italic leading-none text-white">{record.violation}</h4>
              </div>
              <StatusPill>{record.confidence}%</StatusPill>
            </div>
            <div className="mt-5 space-y-2 font-body text-sm font-light text-white/75">
              <p>{record.vehicle} - {record.plate}</p>
              <p>{record.location}</p>
              <p>{record.date} at {record.time}</p>
            </div>
            <button type="button" className="mt-5 inline-flex items-center gap-2 font-body text-sm font-medium text-white" onClick={() => onSelectViolation(record)}>
              View Evidence
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function History({ onSelectViolation }: { onSelectViolation: (record: ViolationRecord) => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [cameraFilter, setCameraFilter] = useState("All");
  const [violationFilter, setViolationFilter] = useState("All");

  const { violations: liveRecords, loading, error, isLive } = useViolations({
    query,
    status: statusFilter,
    camera: cameraFilter,
  });

  // Client-side filter by violation type (not in Supabase query for simplicity)
  const filteredRecords = violationFilter === "All"
    ? liveRecords
    : liveRecords.filter((r) => r.violation.toLowerCase().includes(violationFilter.toLowerCase()));

  return (
    <section id="history" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-24 pt-28 md:px-8 lg:px-16">
      <SectionBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <SectionHeader
          label="History"
          title={"Evidence archive,\nsearchable records"}
          copy="A historical database for violation records, evidence thumbnails, confidence, review status, and detailed incident inspection."
        />

        {isLive ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-mono text-emerald-300 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live data from Supabase
          </div>
        ) : error ? (
          <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-mono text-amber-300 w-fit">{error}</div>
        ) : null}

        <Reveal>
          <div className="liquid-glass rounded-[1.25rem] p-5">
            <div className="mb-5 flex items-center gap-3">
              <IconTile>
                <DatabaseIcon className="h-6 w-6" />
              </IconTile>
              <div>
                <p className="font-body text-xs uppercase text-white/60">Filters</p>
                <h3 className="font-heading text-3xl italic leading-none text-white">Violation database</h3>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="filter-field md:col-span-2">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plate, location, violation..." />
              </label>
              <label className="filter-field">
                <span>Date</span>
                <input type="date" defaultValue="2026-08-28" />
              </label>
              <label className="filter-field">
                <span>Time</span>
                <input type="time" defaultValue="18:00" />
              </label>
              <label className="filter-field">
                <span>Camera</span>
                <select value={cameraFilter} onChange={(e) => setCameraFilter(e.target.value)}>
                  <option>All</option>
                  <option>CAM-07</option>
                  <option>CAM-12</option>
                  <option>CAM-18</option>
                </select>
              </label>
              <label className="filter-field">
                <span>Violation type</span>
                <select value={violationFilter} onChange={(e) => setViolationFilter(e.target.value)}>
                  <option>All</option>
                  <option>No Helmet</option>
                  <option>Red Light Violation</option>
                  <option>Triple Riding</option>
                </select>
              </label>
              <label className="filter-field">
                <span>Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option>All</option>
                  <option>Pending Review</option>
                  <option>Verified</option>
                  <option>Resolved</option>
                  <option>Escalated</option>
                </select>
              </label>
            </div>
          </div>
        </Reveal>

        <Reveal>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="inline-block w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRecords.length === 0 ? (
                <p className="text-center font-body text-sm text-white/50 py-12">No violation records match your filters.</p>
              ) : (
                filteredRecords.map((record) => (
                  <HistoryRecord key={record.id} record={record} onSelectViolation={onSelectViolation} />
                ))
              )}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function HistoryRecord({ record, onSelectViolation }: { record: ViolationRecord; onSelectViolation: (record: ViolationRecord) => void }) {
  return (
    <article className="liquid-glass grid gap-4 rounded-[1.25rem] p-4 md:grid-cols-[170px_1fr_auto] md:items-center">
      <DetectionFrame boxes={cameraFeeds[0].boxes.slice(0, 2)} label={record.camera} className="min-h-[130px]" dense />
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusPill>{record.id}</StatusPill>
          <StatusPill>{record.status}</StatusPill>
          <StatusPill>{record.severity}</StatusPill>
        </div>
        <h3 className="font-heading text-3xl italic leading-none text-white">{record.violation}</h3>
        <div className="mt-4 grid gap-2 font-body text-sm font-light text-white/75 sm:grid-cols-2 lg:grid-cols-4">
          <p>{record.vehicle}</p>
          <p>{record.plate}</p>
          <p>{record.location}</p>
          <p>{record.date} - {record.time}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 md:flex-col md:items-end">
        <div className="min-w-[120px]">
          <Meter value={Math.round(record.confidence)} label="Confidence" />
        </div>
        <button type="button" className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm font-medium text-white" onClick={() => onSelectViolation(record)}>
          View Evidence
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Reports() {
  return (
    <section id="reports" className="traffic-section relative min-h-screen overflow-hidden bg-black px-5 pb-24 pt-28 md:px-8 lg:px-16">
      <SectionBackdrop />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <SectionHeader
          label="Reports"
          title={"Violation trends,\noperational insight"}
          copy="Reporting views summarize citywide trends, risky locations, hourly pressure, vehicle-type distribution, and camera performance."
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {reportMetrics.map((metric, index) => (
            <Reveal key={metric.label} delay={index * 0.05}>
              <div className="liquid-glass h-full rounded-[1.25rem] p-4">
                <p className="font-body text-xs uppercase text-white/60">{metric.label}</p>
                <p className="mt-6 font-heading text-3xl italic leading-none text-white">{metric.value}</p>
                <p className="mt-2 font-body text-xs font-light leading-tight text-white/70">{metric.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Reveal>
            <ChartCard title="Violations over time" data={weeklyTrend} />
          </Reveal>
          <Reveal delay={0.08}>
            <HorizontalChart title="Violations by location" data={locationRisk} />
          </Reveal>
          <Reveal delay={0.16}>
            <ChartCard title="Violations by hour" data={hourlyViolations} />
          </Reveal>
          <Reveal>
            <HorizontalChart title="Vehicle-type distribution" data={vehicleDistribution} />
          </Reveal>
          <Reveal delay={0.08}>
            <HorizontalChart title="Camera performance" data={cameraPerformance} />
          </Reveal>
          <Reveal delay={0.16}>
            <div className="liquid-glass rounded-[1.25rem] p-5">
              <p className="font-body text-xs uppercase text-white/60">Traffic Intelligence Summary</p>
              <p className="mt-5 font-heading text-3xl italic leading-[0.95] text-white">Violation activity increased by 18% this week.</p>
              <p className="mt-4 font-body text-sm font-light leading-snug text-white/80">
                Red-light violations remain the dominant category, while Central Junction recorded the highest incident density. Peak enforcement windows are 6 PM to 8 PM.
              </p>
              <a href="#analyze-traffic" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-body text-sm font-semibold text-black">
                Generate Report
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ChartCard({ title, data }: { title: string; data: ChartDatum[] }) {
  return (
    <div className="liquid-glass flex min-h-[300px] flex-col rounded-[1.25rem] p-5">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h3 className="font-heading text-3xl italic leading-none text-white">{title}</h3>
        <IconTile>
          <ChartIcon className="h-5 w-5" />
        </IconTile>
      </div>
      <div className="mt-auto flex h-44 items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="relative flex flex-1 items-end overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="w-full rounded-full bg-white/80"
                initial={{ height: 0 }}
                whileInView={{ height: `${item.value}%` }}
                viewport={{ once: false }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-center font-body text-[11px] text-white/60">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalChart({ title, data }: { title: string; data: ChartDatum[] }) {
  return (
    <div className="liquid-glass min-h-[300px] rounded-[1.25rem] p-5">
      <h3 className="mb-6 font-heading text-3xl italic leading-none text-white">{title}</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4 font-body text-xs text-white/75">
              <span>{item.label}</span>
              <span>{item.value}%</span>
            </div>
            <Meter value={item.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { AIAnalysisSection } from "./components/AIAnalysisSection";

function AnalyzeTraffic({ onSelectViolation }: { onSelectViolation: (record: ViolationRecord) => void }) {
  return <AIAnalysisSection onSelectViolation={onSelectViolation} />;
}

function ViolationDetailModal({ record, onClose }: { record: ViolationRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="violation-detail-title">
      <motion.div
        initial={{ filter: "blur(10px)", opacity: 0, y: 20, scale: 0.98 }}
        animate={{ filter: "blur(0px)", opacity: 1, y: 0, scale: 1 }}
        transition={motionTransition}
        className="liquid-glass-strong max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[1.25rem] p-4 md:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase text-white/60">Violation detail</p>
            <h2 id="violation-detail-title" className="mt-2 font-heading text-5xl italic leading-none text-white">
              {record.violation}
            </h2>
          </div>
          <button type="button" className="liquid-glass rounded-full px-4 py-2 font-body text-sm text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr]">
          <DetectionFrame boxes={cameraFeeds[0].boxes} label={`${record.camera} evidence`} className="min-h-[460px]" />

          <div className="grid gap-4">
            <div className="liquid-glass rounded-[1.25rem] p-5">
              <p className="font-body text-xs uppercase text-white/60">Incident information</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricMini label="Confidence" value={`${record.confidence}%`} />
                <MetricMini label="Vehicle" value={record.vehicle} />
                <MetricMini label="Number plate" value={record.plate} />
                <MetricMini label="Camera" value={record.camera} />
                <MetricMini label="Location" value={record.location} />
                <MetricMini label="Date" value={record.date} />
                <MetricMini label="Time" value={record.time} />
                <MetricMini label="Status" value={record.status} />
              </div>
            </div>

            <div className="liquid-glass rounded-[1.25rem] p-5">
              <p className="font-body text-xs uppercase text-white/60">AI analysis</p>
              <p className="mt-4 font-body text-sm font-light leading-snug text-white/85">
                The model detected a {record.vehicle.toLowerCase()} inside the violation zone, matched the number plate region, and classified the incident as
                {" "}{record.violation.toLowerCase()} with {record.confidence}% confidence. The evidence frame contains vehicle, rider, plate, and violation labels.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {["Verify Violation", "Flag for Review", "Mark Resolved", "Export Evidence"].map((action) => (
                <button key={action} type="button" className="liquid-glass rounded-full px-4 py-3 font-body text-sm font-medium text-white">
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [selectedViolation, setSelectedViolation] = useState<ViolationRecord | null>(null);

  return (
    <main className="bg-black font-body text-white">
      <Navbar />
      <Hero />
      <Dashboard onSelectViolation={setSelectedViolation} />
      <LiveMonitor />
      <AIAnalysis onSelectViolation={setSelectedViolation} />
      <History onSelectViolation={setSelectedViolation} />
      <Reports />
      <AnalyzeTraffic onSelectViolation={setSelectedViolation} />
      {selectedViolation ? <ViolationDetailModal record={selectedViolation} onClose={() => setSelectedViolation(null)} /> : null}
    </main>
  );
}
