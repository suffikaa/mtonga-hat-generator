"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Download,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HatTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface PhotoTransform {
  scale: number;
  x: number;
  y: number;
}

const DEFAULT_HAT: HatTransform = { x: 0, y: 0, scale: 0.55, rotation: 0 };
const DEFAULT_PHOTO: PhotoTransform = { scale: 1, x: 0, y: 0 };

const HAT_SRC = "/hat.png";
const CANVAS_SIZE = 1024;

// ── Helpers ──────────────────────────────────────────────────────────────────

function coverFitCrop(iw: number, ih: number) {
  let sx = 0,
    sy = 0,
    sw = iw,
    sh = ih;
  if (iw > ih) {
    sx = (iw - ih) / 2;
    sw = ih;
  } else {
    sy = (ih - iw) / 2;
    sh = iw;
  }
  return { sx, sy, sw, sh };
}

// ── Rendering ────────────────────────────────────────────────────────────────
// Single source of truth for both preview and PNG export.

export function renderComposite(
  ctx: CanvasRenderingContext2D,
  size: number,
  userImg: HTMLImageElement,
  hatImg: HTMLImageElement,
  hat: HatTransform,
  photo: PhotoTransform,
) {
  ctx.clearRect(0, 0, size, size);

  // 1. Photo layer — cover-fit + user transform
  const { sx, sy, sw, sh } = coverFitCrop(
    userImg.naturalWidth,
    userImg.naturalHeight,
  );
  const drawSize = size * photo.scale;
  const drawX = (size - drawSize) / 2 + (photo.x / 100) * size;
  const drawY = (size - drawSize) / 2 + (photo.y / 100) * size;
  ctx.drawImage(userImg, sx, sy, sw, sh, drawX, drawY, drawSize, drawSize);

  // 2. Hat layer — preserves original PNG proportions and transparency
  const hatW = size * hat.scale;
  const hatH = hatW * (hatImg.naturalHeight / hatImg.naturalWidth);
  const cx = size / 2 + (hat.x / 100) * size;
  const cy = size * 0.22 + (hat.y / 100) * size;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((hat.rotation * Math.PI) / 180);
  ctx.drawImage(hatImg, -hatW / 2, -hatH / 2, hatW, hatH);
  ctx.restore();
}

// ── Face detection ───────────────────────────────────────────────────────────
// Uses the browser-native Shape Detection API (Chromium).
// Falls back to defaults silently on unsupported browsers.

async function autoPositionHat(
  img: HTMLImageElement,
  canvasSize: number,
): Promise<HatTransform | null> {
  if (typeof window === "undefined" || !("FaceDetector" in window))
    return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector();
    const faces = await detector.detect(img);
    if (!faces.length) return null;

    // Pick the largest face
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const face = faces.reduce((a: any, b: any) =>
      a.boundingBox.width * a.boundingBox.height >
      b.boundingBox.width * b.boundingBox.height
        ? a
        : b,
    );
    const bb = face.boundingBox;

    // Map face bbox from original-image pixels → canvas pixels
    const { sx, sy, sw, sh } = coverFitCrop(
      img.naturalWidth,
      img.naturalHeight,
    );
    const fX = ((bb.x - sx) / sw) * canvasSize;
    const fY = ((bb.y - sy) / sh) * canvasSize;
    const fW = (bb.width / sw) * canvasSize;
    const fH = (bb.height / sh) * canvasSize;

    // Hat should sit on top of the head, not on the face center
    const hatCenterX = fX + fW / 2;
    const hatCenterY = fY - fH * 0.15;
    const hatScale = Math.max(0.15, Math.min(1.2, (fW * 1.4) / canvasSize));

    // Reverse-engineer HatTransform from absolute canvas position
    return {
      x: ((hatCenterX - canvasSize / 2) / canvasSize) * 100,
      y: ((hatCenterY - canvasSize * 0.22) / canvasSize) * 100,
      scale: hatScale,
      rotation: 0,
    };
  } catch {
    return null;
  }
}

// ── Slider config ────────────────────────────────────────────────────────────

interface SliderCfg {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const PHOTO_SLIDERS: SliderCfg[] = [
  {
    key: "scale",
    label: "Zoom",
    min: 0.5,
    max: 3,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "x",
    label: "X Offset",
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? "+" : ""}${v}`,
  },
  {
    key: "y",
    label: "Y Offset",
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? "+" : ""}${v}`,
  },
];

const HAT_SLIDERS: SliderCfg[] = [
  {
    key: "scale",
    label: "Size",
    min: 0.1,
    max: 1.5,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "rotation",
    label: "Rotation",
    min: -180,
    max: 180,
    step: 1,
    format: (v) => `${v}°`,
  },
  {
    key: "x",
    label: "X Offset",
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? "+" : ""}${v}`,
  },
  {
    key: "y",
    label: "Y Offset",
    min: -40,
    max: 60,
    step: 1,
    format: (v) => `${v > 0 ? "+" : ""}${v}`,
  },
];

// ── Reusable slider row ──────────────────────────────────────────────────────

function SliderRow({
  cfg,
  value,
  disabled,
  onChange,
}: {
  cfg: SliderCfg;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{cfg.label}</span>
        <span className="tabular-nums">{cfg.format(value)}</span>
      </div>
      <input
        type="range"
        className="hat-slider"
        disabled={disabled}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadTool() {
  const [userImage, setUserImage] = useState<HTMLImageElement | null>(null);
  const [hatImage, setHatImage] = useState<HTMLImageElement | null>(null);
  const [hat, setHat] = useState<HatTransform>(DEFAULT_HAT);
  const [photo, setPhoto] = useState<PhotoTransform>(DEFAULT_PHOTO);
  const [isDragOver, setIsDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReady = !!(userImage && hatImage);

  // Load hat asset once
  useEffect(() => {
    const img = new Image();
    img.src = HAT_SRC;
    img.onload = () => setHatImage(img);
  }, []);

  // Re-render canvas on any change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !userImage || !hatImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderComposite(ctx, CANVAS_SIZE, userImage, hatImage, hat, photo);
  }, [userImage, hatImage, hat, photo]);

  // ── File handling ──────────────────────────────────────────────────────────

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      setUserImage((prev) => {
        if (prev?.src?.startsWith("blob:")) URL.revokeObjectURL(prev.src);
        return img;
      });
      setPhoto(DEFAULT_PHOTO);

      const autoHat = await autoPositionHat(img, CANVAS_SIZE);
      setHat(autoHat ?? DEFAULT_HAT);
    };
    img.src = url;
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => setIsDragOver(false);

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
  };

  const updateHat = (key: string, v: number) =>
    setHat((prev) => ({ ...prev, [key]: v }));

  const updatePhoto = (key: string, v: number) =>
    setPhoto((prev) => ({ ...prev, [key]: v }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section id="generator" className="py-24 w-full max-w-5xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileInput}
        className="hidden"
      />

      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Generate Your MTONGA Identity
        </h2>
        <p className="text-slate-400">
          Upload your PFP. We&apos;ll handle the rest.
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 md:p-10 glow-box">
        <div className="flex flex-col md:flex-row gap-10">
          {/* ── Preview ───────────────────────────────────────────── */}
          <div
            className={`flex-1 aspect-square bg-slate-950 rounded-2xl border flex items-center justify-center relative overflow-hidden transition-colors cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-950/20"
                : "border-slate-800"
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !userImage && fileInputRef.current?.click()}
          >
            {!userImage && (
              <div className="text-center p-6 text-slate-500 pointer-events-none">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">
                  {isDragOver
                    ? "Drop your image"
                    : "Drag and drop your image here"}
                </p>
                <p className="text-sm mt-2">or click to browse</p>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`absolute inset-0 w-full h-full ${
                userImage ? "block" : "hidden"
              }`}
            />

            {userImage && (
              <div className="absolute inset-0 ring-4 ring-inset ring-blue-500/20 rounded-2xl pointer-events-none" />
            )}
          </div>

          {/* ── Controls ──────────────────────────────────────────── */}
          <div className="w-full md:w-80 flex flex-col justify-start space-y-5">
            {/* Step 1 — Upload */}
            <div className="space-y-3">
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Step 1
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all font-medium"
              >
                <Upload className="w-5 h-5" />
                {userImage ? "Replace Image" : "Upload Image"}
              </button>
            </div>

            {/* Step 2 — Adjust */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Step 2 &mdash; Adjust
              </span>

              {/* Photo controls */}
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
                Photo
              </p>
              {PHOTO_SLIDERS.map((s) => (
                <SliderRow
                  key={`photo-${s.key}`}
                  cfg={s}
                  value={photo[s.key as keyof PhotoTransform]}
                  disabled={!isReady}
                  onChange={(v) => updatePhoto(s.key, v)}
                />
              ))}

              {/* Hat controls */}
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest pt-2">
                Hat
              </p>
              {HAT_SLIDERS.map((s) => (
                <SliderRow
                  key={`hat-${s.key}`}
                  cfg={s}
                  value={hat[s.key as keyof HatTransform]}
                  disabled={!isReady}
                  onChange={(v) => updateHat(s.key, v)}
                />
              ))}
            </div>

            {/* Step 3 — Download */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Step 3
              </span>
              <button
                disabled={!isReady}
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                Download PNG
              </button>
            </div>

            {/* Reset */}
            {userImage && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset / Try Another Photo
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
