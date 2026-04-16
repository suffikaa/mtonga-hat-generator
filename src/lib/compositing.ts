import type { HatTransform, PhotoTransform, FaceAnalysis } from "./types";

export function coverFitCrop(iw: number, ih: number) {
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

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  size: number,
  img: HTMLImageElement,
  photo: PhotoTransform,
) {
  const { sx, sy, sw, sh } = coverFitCrop(img.naturalWidth, img.naturalHeight);
  const d = size * photo.scale;
  const dx = (size - d) / 2 + (photo.x / 100) * size;
  const dy = (size - d) / 2 + (photo.y / 100) * size;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, d, d);
}

function hatGeometry(size: number, hatImg: HTMLImageElement, hat: HatTransform) {
  const w = size * hat.scale;
  const h = w * (hatImg.naturalHeight / hatImg.naturalWidth);
  const cx = size / 2 + (hat.x / 100) * size;
  const cy = size * 0.22 + (hat.y / 100) * size;
  return { w, h, cx, cy };
}

// ── Classic mode: flat overlay (current stable behaviour) ────────────────────

export function renderClassic(
  ctx: CanvasRenderingContext2D,
  size: number,
  userImg: HTMLImageElement,
  hatImg: HTMLImageElement,
  hat: HatTransform,
  photo: PhotoTransform,
) {
  ctx.clearRect(0, 0, size, size);
  drawPhoto(ctx, size, userImg, photo);

  const { w, h, cx, cy } = hatGeometry(size, hatImg, hat);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((hat.rotation * Math.PI) / 180);
  ctx.drawImage(hatImg, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ── Smart Fit mode: shadow + perspective (human faces only) ──────────────────

export function renderSmart(
  ctx: CanvasRenderingContext2D,
  size: number,
  userImg: HTMLImageElement,
  hatImg: HTMLImageElement,
  hat: HatTransform,
  photo: PhotoTransform,
  face: FaceAnalysis | null,
) {
  ctx.clearRect(0, 0, size, size);
  drawPhoto(ctx, size, userImg, photo);

  const { w, h, cx, cy } = hatGeometry(size, hatImg, hat);
  const rollRad = (hat.rotation * Math.PI) / 180;

  if (face) {
    const yawRad = (face.yaw * Math.PI) / 180;
    const compression = 1 - Math.abs(Math.sin(yawRad)) * 0.15;
    const skew = Math.sin(yawRad) * 0.1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rollRad);
    ctx.transform(compression, skew, 0, 1, 0, 0);
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(hatImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rollRad);
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(hatImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// ── Lightweight auto-position (browser FaceDetector API) ─────────────────────

export async function autoPositionHat(
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const face = faces.reduce((a: any, b: any) =>
      a.boundingBox.width * a.boundingBox.height >
      b.boundingBox.width * b.boundingBox.height
        ? a
        : b,
    );
    const bb = face.boundingBox;
    const { sx, sy, sw, sh } = coverFitCrop(
      img.naturalWidth,
      img.naturalHeight,
    );

    const fX = ((bb.x - sx) / sw) * canvasSize;
    const fY = ((bb.y - sy) / sh) * canvasSize;
    const fW = (bb.width / sw) * canvasSize;
    const fH = (bb.height / sh) * canvasSize;

    const hatCenterX = fX + fW / 2;
    const hatCenterY = fY - fH * 0.15;
    const hatScale = Math.max(0.15, Math.min(1.2, (fW * 1.4) / canvasSize));

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

// ── AI Edit helpers ──────────────────────────────────────────────────────────

export function createAIInputComposite(
  size: number,
  userImg: HTMLImageElement,
  plainHat: HTMLImageElement,
  hat: HatTransform,
  photo: PhotoTransform,
): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  renderClassic(ctx, size, userImg, plainHat, hat, photo);
  return c.toDataURL("image/jpeg", 0.88);
}

export function overlayHatText(
  ctx: CanvasRenderingContext2D,
  size: number,
  hat: HatTransform,
) {
  const w = size * hat.scale;
  const cx = size / 2 + (hat.x / 100) * size;
  const cy = size * 0.22 + (hat.y / 100) * size;
  const rollRad = (hat.rotation * Math.PI) / 180;
  const fontSize = Math.round(w * 0.13);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad);
  ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText("$MTONGA", 0, -w * 0.02);
  ctx.restore();
}
