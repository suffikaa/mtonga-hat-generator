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

export type HatDirection = "left" | "right";
export type ComposerMode = "classic" | "smart" | "ai-edit";

// ── Detection types ──────────────────────────────────────────────────────────

export interface FaceAnalysis {
  roll: number;
  yaw: number;
  pitch: number;
  foreheadX: number;
  foreheadY: number;
  faceWidth: number;
  faceHeight: number;
}

export interface AnimalDetection {
  className: string;
  score: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
}

export type DetectionResult =
  | { kind: "human"; face: FaceAnalysis }
  | { kind: "animal"; animal: AnimalDetection }
  | { kind: "none" };

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_HAT: HatTransform = {
  x: 0,
  y: 0,
  scale: 0.55,
  rotation: 0,
};

export const DEFAULT_PHOTO: PhotoTransform = { scale: 1, x: 0, y: 0 };

export const CANVAS_SIZE = 1024;
