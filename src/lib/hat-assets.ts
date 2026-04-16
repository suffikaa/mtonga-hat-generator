/**
 * Hat asset management.
 *
 * hat.png = original, visor pointing LEFT.
 * Right-facing version is built by mirroring the shape and re-rendering
 * "$MTONGA" text so it always reads correctly.
 *
 * "Plain" variants have the text area painted over — used as input for
 * generative AI (text is overlaid separately after generation).
 */

export interface HatAssets {
  left: HTMLImageElement;
  right: HTMLImageElement;
  leftPlain: HTMLImageElement;
  rightPlain: HTMLImageElement;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function canvasToImage(c: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = c.toDataURL("image/png");
  });
}

/** Simple horizontal flip — no text handling. */
function simpleMirror(source: HTMLImageElement): Promise<HTMLImageElement> {
  const c = document.createElement("canvas");
  c.width = source.naturalWidth;
  c.height = source.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvasToImage(c);
}

/** Remove text band and repaint with sampled cap colour. */
function buildPlainHat(source: HTMLImageElement): Promise<HTMLImageElement> {
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  const sample = ctx.getImageData(
    Math.round(w * 0.5),
    Math.round(h * 0.38),
    1,
    1,
  ).data;
  const capColour = `rgb(${sample[0]},${sample[1]},${sample[2]})`;

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = capColour;
  ctx.fillRect(w * 0.15, h * 0.25, w * 0.7, h * 0.32);
  ctx.restore();

  return canvasToImage(c);
}

/** Mirror shape + re-draw "$MTONGA" in correct reading direction. */
function buildMirroredHat(source: HTMLImageElement): Promise<HTMLImageElement> {
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // Flip
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  ctx.restore();

  // Paint over mirrored text
  const sample = ctx.getImageData(
    Math.round(w * 0.5),
    Math.round(h * 0.38),
    1,
    1,
  ).data;
  const capColour = `rgb(${sample[0]},${sample[1]},${sample[2]})`;

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = capColour;
  ctx.fillRect(w * 0.15, h * 0.25, w * 0.7, h * 0.32);
  ctx.restore();

  // Re-render readable text
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const fontSize = Math.round(h * 0.13);
  ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("$MTONGA", w * 0.5, h * 0.42);
  ctx.restore();

  return canvasToImage(c);
}

export async function loadHatAssets(): Promise<HatAssets> {
  const left = await loadImage("/hat.png");
  const leftPlain = await buildPlainHat(left);

  let right: HTMLImageElement;
  try {
    right = await loadImage("/hat-right.png");
  } catch {
    right = await buildMirroredHat(left);
  }

  const rightPlain = await simpleMirror(leftPlain);

  return { left, right, leftPlain, rightPlain };
}

export function getHat(
  assets: HatAssets,
  direction: "left" | "right",
): HTMLImageElement {
  return direction === "left" ? assets.left : assets.right;
}

export function getPlainHat(
  assets: HatAssets,
  direction: "left" | "right",
): HTMLImageElement {
  return direction === "left" ? assets.leftPlain : assets.rightPlain;
}
