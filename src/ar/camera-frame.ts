export const TRACKING_SIZE = 640;

/** Fit the entire video into a stable square tracker frame, without stretching. */
export function getCameraFrame(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  const scale = TRACKING_SIZE / Math.max(width, height);
  const frameWidth = width * scale;
  const frameHeight = height * scale;
  return {
    width: frameWidth,
    height: frameHeight,
    x: (TRACKING_SIZE - frameWidth) / 2,
    y: (TRACKING_SIZE - frameHeight) / 2,
    projectionX: TRACKING_SIZE / frameWidth,
    projectionY: TRACKING_SIZE / frameHeight,
  };
}
