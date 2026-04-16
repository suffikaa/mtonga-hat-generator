"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Download,
  RotateCcw,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Hand,
} from "lucide-react";

import type {
  HatTransform,
  PhotoTransform,
  HatDirection,
  ComposerMode,
} from "@/lib/types";
import { DEFAULT_HAT, DEFAULT_PHOTO, CANVAS_SIZE } from "@/lib/types";
import { loadHatAssets, getHat, type HatAssets } from "@/lib/hat-assets";
import {
  renderClassic,
  autoPositionHat,
  createPhotoOnlyDataUrl,
  createHatOnlyDataUrl,
} from "@/lib/compositing";
import { smartDetect } from "@/lib/face-ai";

const AI_EDIT_ENABLED = process.env.NEXT_PUBLIC_AI_EDIT_ENABLED === "true";

// ── Slider config ────────────────────────────────────────────────────────────

interface SliderCfg {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const PHOTO_SLIDERS: SliderCfg[] = [
  { key: "scale", label: "Zoom", min: 0.5, max: 3, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "x", label: "X Offset", min: -50, max: 50, step: 1, fmt: (v) => `${v > 0 ? "+" : ""}${v}` },
  { key: "y", label: "Y Offset", min: -50, max: 50, step: 1, fmt: (v) => `${v > 0 ? "+" : ""}${v}` },
];

const HAT_SLIDERS: SliderCfg[] = [
  { key: "scale", label: "Size", min: 0.1, max: 1.5, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1, fmt: (v) => `${v}°` },
  { key: "x", label: "X Offset", min: -50, max: 50, step: 1, fmt: (v) => `${v > 0 ? "+" : ""}${v}` },
  { key: "y", label: "Y Offset", min: -40, max: 60, step: 1, fmt: (v) => `${v > 0 ? "+" : ""}${v}` },
];

function SliderRow({ cfg, value, disabled, onChange }: {
  cfg: SliderCfg; value: number; disabled: boolean; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{cfg.label}</span>
        <span className="tabular-nums">{cfg.fmt(value)}</span>
      </div>
      <input type="range" className="hat-slider" disabled={disabled}
        min={cfg.min} max={cfg.max} step={cfg.step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadTool() {
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [hatAssets, setHatAssets] = useState<HatAssets | null>(null);
  const [hat, setHat] = useState<HatTransform>(DEFAULT_HAT);
  const [photo, setPhoto] = useState<PhotoTransform>(DEFAULT_PHOTO);
  const [direction, setDirection] = useState<HatDirection>("left");
  const [mode, setMode] = useState<ComposerMode>("classic");

  const [aiEditStatus, setAiEditStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [aiEditResult, setAiEditResult] = useState<HTMLImageElement | null>(null);
  const [aiEditError, setAiEditError] = useState<string | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = !!(userImage && hatAssets);

  useEffect(() => { loadHatAssets().then(setHatAssets); }, []);

  // ── Canvas rendering ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "ai-edit" && aiEditResult && aiEditStatus === "done") {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(aiEditResult, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      return;
    }

    if (!userImage || !hatAssets) return;
    const hatImg = getHat(hatAssets, direction);
    renderClassic(ctx, CANVAS_SIZE, userImage, hatImg, hat, photo);
  }, [userImage, hatAssets, direction, hat, photo, mode, aiEditResult, aiEditStatus]);

  // ── File handling ──────────────────────────────────────────────────────────

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      setUserImage((prev) => {
        if (prev?.src?.startsWith("blob:")) URL.revokeObjectURL(prev.src);
        return img;
      });
      setPhoto(DEFAULT_PHOTO);
      setAiEditResult(null);
      setAiEditStatus("idle");
      setAiEditError(null);
      const autoHat = await autoPositionHat(img, CANVAS_SIZE);
      setHat(autoHat ?? DEFAULT_HAT);
    };
    img.src = url;
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);

  // ── AI Edit ────────────────────────────────────────────────────────────────

  const handleAIEdit = async () => {
    if (!userImage || !hatAssets) return;
    setAiEditStatus("loading");
    setAiEditError(null);
    setAiEditResult(null);

    try {
      // Use detection only to resolve a subject label for the prompt
      const det = await smartDetect(userImage);
      let subject = "subject";
      if (det.kind === "human") subject = "person";
      else if (det.kind === "animal") subject = det.animal.className;

      const hatImg = getHat(hatAssets, direction);
      const photoUrl = createPhotoOnlyDataUrl(CANVAS_SIZE, userImage, photo);
      const hatUrl = createHatOnlyDataUrl(hatImg);

      const createRes = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: photoUrl, hat: hatUrl, subject }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error ?? `Server error ${createRes.status}`);
      }

      const firstResp = await createRes.json();

      if (firstResp.status === "succeeded" && firstResp.output) {
        const resultImg = await loadImageFromUrl(firstResp.output);
        setAiEditResult(resultImg);
        setAiEditStatus("done");
        return;
      }

      // Fallback polling for async providers
      const { id } = firstResp;
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const statusRes = await fetch(`/api/ai-edit?id=${id}`);
        const pred = await statusRes.json();

        if (pred.status === "succeeded" && pred.output) {
          const resultImg = await loadImageFromUrl(pred.output);
          setAiEditResult(resultImg);
          setAiEditStatus("done");
          return;
        }
        if (pred.status === "failed" || pred.status === "canceled") {
          throw new Error(pred.error ?? "Generation failed");
        }
      }
      throw new Error("Generation timed out");
    } catch (err) {
      setAiEditError(err instanceof Error ? err.message : "Unknown error");
      setAiEditStatus("error");
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mtonga-pfp.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const handleReset = () => {
    if (userImage?.src?.startsWith("blob:")) URL.revokeObjectURL(userImage.src);
    setUserImage(null);
    setHat(DEFAULT_HAT);
    setPhoto(DEFAULT_PHOTO);
    setAiEditResult(null);
    setAiEditStatus("idle");
    setAiEditError(null);
  };

  const updateHat = (k: string, v: number) => setHat((p) => ({ ...p, [k]: v }));
  const updatePhoto = (k: string, v: number) => setPhoto((p) => ({ ...p, [k]: v }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section id="generator" className="py-24 w-full max-w-5xl mx-auto">
      <input ref={fileInputRef} type="file" accept="image/*"
        onChange={onFileInput} className="hidden" />

      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Generate Your MTONGA Identity
        </h2>
        <p className="text-slate-400">Upload your PFP. We&apos;ll handle the rest.</p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-10 glow-box">
        <div className="flex flex-col md:flex-row gap-10">

          {/* ── Preview ─────────────────────────────────────────── */}
          <div
            className={`flex-1 aspect-square bg-slate-950 rounded-2xl border flex items-center justify-center relative overflow-hidden transition-colors cursor-pointer ${
              isDragOver ? "border-blue-500 bg-blue-950/20" : "border-slate-800"
            }`}
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            onClick={() => !userImage && fileInputRef.current?.click()}
          >
            {!userImage && (
              <div className="text-center p-6 text-slate-500 pointer-events-none">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">
                  {isDragOver ? "Drop your image" : "Drag and drop your image here"}
                </p>
                <p className="text-sm mt-2">or click to browse</p>
              </div>
            )}
            <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE}
              className={`absolute inset-0 w-full h-full ${userImage ? "block" : "hidden"}`} />
            {userImage && (
              <div className="absolute inset-0 ring-4 ring-inset ring-blue-500/20 rounded-2xl pointer-events-none" />
            )}
          </div>

          {/* ── Controls ────────────────────────────────────────── */}
          <div className="w-full md:w-80 flex flex-col justify-start space-y-6">

            {/* Mode selector — segmented control */}
            <div className="relative flex bg-slate-800/40 rounded-xl p-1 border border-slate-800">
              {/* Sliding indicator */}
              <div
                className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out ${
                  mode === "classic"
                    ? "bg-slate-700 shadow-lg shadow-slate-900/30"
                    : "bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-violet-900/40"
                }`}
                style={{
                  width: AI_EDIT_ENABLED ? "calc(50% - 4px)" : "calc(100% - 8px)",
                  left: mode === "classic" ? "4px" : "calc(50% + 0px)",
                }}
              />
              <button
                onClick={() => setMode("classic")}
                className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  mode === "classic" ? "text-white" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                <Hand className="w-4 h-4" />
                Classic
              </button>
              {AI_EDIT_ENABLED && (
                <button
                  onClick={() => setMode("ai-edit")}
                  className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    mode === "ai-edit" ? "text-white" : "text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Edit
                </button>
              )}
            </div>

            {/* Step 1 — Upload */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 1 · Photo</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all font-medium"
              >
                <Upload className="w-4 h-4" />
                {userImage ? "Replace Image" : "Upload Image"}
              </button>
            </div>

            {/* Hat Direction */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hat Direction</span>
              <div className="flex gap-2">
                {(["left", "right"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      direction === d
                        ? "bg-slate-700 text-white border border-slate-600"
                        : "bg-slate-800/40 text-slate-500 hover:text-slate-300 border border-transparent"
                    }`}
                  >
                    {d === "left" ? "\u2190 Left" : "Right \u2192"}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — Mode-specific */}
            <div className="space-y-4 pt-5 border-t border-slate-800">
              {mode === "ai-edit" ? (
                <>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 2 · Generate</span>
                  <button
                    disabled={!isReady || aiEditStatus === "loading"}
                    onClick={handleAIEdit}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {aiEditStatus === "loading" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Generating&hellip;</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />{aiEditStatus === "done" ? "Regenerate" : "Generate AI Edit"}</>
                    )}
                  </button>

                  {aiEditStatus === "loading" && (
                    <p className="text-xs text-slate-500 text-center">
                      This may take 10–20 seconds&hellip;
                    </p>
                  )}
                  {aiEditStatus === "done" && (
                    <p className="text-xs text-emerald-400/70 text-center">
                      AI edit applied. Download below or regenerate.
                    </p>
                  )}
                  {aiEditStatus === "error" && (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-400/80 text-center">
                        {aiEditError ?? "Generation failed."}
                      </p>
                      <button
                        onClick={() => setMode("classic")}
                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Switch to Classic instead
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 2 · Adjust</span>

                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Photo</p>
                    {PHOTO_SLIDERS.map((s) => (
                      <SliderRow key={`p-${s.key}`} cfg={s}
                        value={photo[s.key as keyof PhotoTransform]}
                        disabled={!isReady} onChange={(v) => updatePhoto(s.key, v)} />
                    ))}
                  </div>

                  <div className="space-y-4 pt-2">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Hat</p>
                    {HAT_SLIDERS.map((s) => (
                      <SliderRow key={`h-${s.key}`} cfg={s}
                        value={hat[s.key as keyof HatTransform]}
                        disabled={!isReady} onChange={(v) => updateHat(s.key, v)} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Step 3 — Download */}
            <div className="space-y-3 pt-5 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 3 · Export</span>
              <button
                disabled={!isReady}
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-[0_0_20px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />Download PNG
              </button>
            </div>

            {userImage && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />Reset / Try Another Photo
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
