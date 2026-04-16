/**
 * Smart detection pipeline:
 *  1. MediaPipe FaceLandmarker — human face (478 landmarks, head tilt)
 *  2. TF.js COCO-SSD — animals (dog, cat, bird, horse, etc.)
 *  3. Fallback — null (caller shows manual-mode message)
 */

import type { HatTransform, FaceAnalysis, AnimalDetection, DetectionResult } from "./types";
import { coverFitCrop } from "./compositing";

// ── Singletons ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let landmarkerInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cocoModelInstance: any = null;

async function getLandmarker() {
  if (landmarkerInstance) return landmarkerInstance;
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );
  landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  return landmarkerInstance;
}

async function getCocoModel() {
  if (cocoModelInstance) return cocoModelInstance;
  await import("@tensorflow/tfjs");
  const cocoSsd = await import("@tensorflow-models/coco-ssd");
  cocoModelInstance = await cocoSsd.load();
  return cocoModelInstance;
}

const ANIMAL_CLASSES = new Set([
  "dog", "cat", "bird", "horse", "sheep", "cow", "elephant",
  "bear", "zebra", "giraffe",
]);

// ── Human face analysis ──────────────────────────────────────────────────────

async function detectHumanFace(
  img: HTMLImageElement,
): Promise<FaceAnalysis | null> {
  try {
    const landmarker = await getLandmarker();
    const result = landmarker.detect(img);
    if (!result.faceLandmarks?.length) return null;

    const lm = result.faceLandmarks[0];

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of lm) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const forehead = lm[10];
    const leftEye = lm[33];
    const rightEye = lm[263];
    const roll =
      Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) *
      (180 / Math.PI);

    const faceCenterX = (minX + maxX) / 2;
    const noseTip = lm[1];
    const yaw = ((noseTip.x - faceCenterX) / (maxX - minX)) * 60;

    const noseBridge = lm[4];
    const chin = lm[152];
    const vertMid = (forehead.y + chin.y) / 2;
    const pitch =
      ((noseBridge.y - vertMid) / (maxY - minY)) * 40;

    return {
      roll, yaw, pitch,
      foreheadX: forehead.x,
      foreheadY: forehead.y,
      faceWidth: maxX - minX,
      faceHeight: maxY - minY,
    };
  } catch (err) {
    console.warn("MediaPipe face detection failed:", err);
    return null;
  }
}

// ── Animal detection ─────────────────────────────────────────────────────────

async function detectAnimal(
  img: HTMLImageElement,
): Promise<AnimalDetection | null> {
  try {
    const model = await getCocoModel();
    const predictions = await model.detect(img);

    const animal = predictions
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ANIMAL_CLASSES.has(p.class) && p.score > 0.4,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => b.score - a.score)[0];

    if (!animal) return null;

    const [bx, by, bw, bh] = animal.bbox;
    return {
      className: animal.class,
      score: animal.score,
      bboxX: bx / img.naturalWidth,
      bboxY: by / img.naturalHeight,
      bboxW: bw / img.naturalWidth,
      bboxH: bh / img.naturalHeight,
    };
  } catch (err) {
    console.warn("COCO-SSD detection failed:", err);
    return null;
  }
}

// ── Unified detection entry point ────────────────────────────────────────────

export async function smartDetect(
  img: HTMLImageElement,
): Promise<DetectionResult> {
  const face = await detectHumanFace(img);
  if (face) return { kind: "human", face };

  const animal = await detectAnimal(img);
  if (animal) return { kind: "animal", animal };

  return { kind: "none" };
}

// ── Hat transform computation ────────────────────────────────────────────────

function clampTransform(t: HatTransform): HatTransform {
  return {
    x: Math.max(-45, Math.min(45, t.x)),
    y: Math.max(-20, Math.min(55, t.y)),
    scale: Math.max(0.15, Math.min(0.7, t.scale)),
    rotation: t.rotation,
  };
}

export function computeHumanHatTransform(
  face: FaceAnalysis,
  imgW: number,
  imgH: number,
  canvasSize: number,
): HatTransform {
  const { sx, sy, sw, sh } = coverFitCrop(imgW, imgH);

  const rawX = face.foreheadX * imgW;
  const rawY = face.foreheadY * imgH;
  const cX = ((rawX - sx) / sw) * canvasSize;
  const cY = ((rawY - sy) / sh) * canvasSize;

  const faceW = (face.faceWidth * imgW) / sw;
  const faceH = (face.faceHeight * imgH) / sh;

  const hatCenterX = cX;
  const hatCenterY = cY - faceH * canvasSize * 0.15;
  const hatScale = faceW * 1.3;

  return clampTransform({
    x: ((hatCenterX - canvasSize / 2) / canvasSize) * 100,
    y: ((hatCenterY - canvasSize * 0.22) / canvasSize) * 100,
    scale: hatScale,
    rotation: face.roll,
  });
}

export function computeAnimalHatTransform(
  animal: AnimalDetection,
  imgW: number,
  imgH: number,
  canvasSize: number,
): HatTransform {
  const { sx, sy, sw, sh } = coverFitCrop(imgW, imgH);

  const rawCenterX = (animal.bboxX + animal.bboxW / 2) * imgW;
  const rawTopY = animal.bboxY * imgH;
  const bboxW = animal.bboxW * imgW;

  const cX = ((rawCenterX - sx) / sw) * canvasSize;
  const cY = ((rawTopY - sy) / sh) * canvasSize;

  const headW = (bboxW / sw) * 0.4;

  return clampTransform({
    x: ((cX - canvasSize / 2) / canvasSize) * 100,
    y: ((cY - canvasSize * 0.22) / canvasSize) * 100,
    scale: headW,
    rotation: 0,
  });
}
