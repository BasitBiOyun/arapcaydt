/**
 * Easing curves and animation helpers for educational video rendering.
 * All animations are restrained, smooth, and deterministic.
 */

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

export function easeInOutQuad(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

export function easeOutQuad(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

/**
 * Draws an animated "X" (Rejection mark) across or beside a bounding box.
 * The X draws smoothly across two lines over progress (0 to 1).
 */
export function drawAnimatedCross(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  progress: number,
  color = '#8B1E2D',
  lineWidth = 4.5
) {
  if (progress <= 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // White halo / drop shadow for contrast against question text
  ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowBlur = 4;

  const halfSize = radius * 0.9;
  const p1 = Math.min(1, progress * 2); // first slash (top-left to bottom-right)
  const p2 = Math.max(0, (progress - 0.5) * 2); // second slash (top-right to bottom-left)

  // First stroke: \
  if (p1 > 0) {
    const x1 = centerX - halfSize;
    const y1 = centerY - halfSize;
    const x2 = x1 + (halfSize * 2) * p1;
    const y2 = y1 + (halfSize * 2) * p1;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Second stroke: /
  if (p2 > 0) {
    const x1 = centerX + halfSize;
    const y1 = centerY - halfSize;
    const x2 = x1 - (halfSize * 2) * p2;
    const y2 = y1 + (halfSize * 2) * p2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws an animated "✓" (Correct answer checkmark) with restrained academic green.
 * The check draws the short down-stroke first (0 to 0.35) and then the long up-stroke (0.35 to 1).
 */
export function drawAnimatedCheck(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  progress: number,
  color = '#15803D',
  lineWidth = 5
) {
  if (progress <= 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = 5;

  const startX = centerX - radius * 0.75;
  const startY = centerY - radius * 0.05;

  const midX = centerX - radius * 0.2;
  const midY = centerY + radius * 0.55;

  const endX = centerX + radius * 0.85;
  const endY = centerY - radius * 0.65;

  const p1 = Math.min(1, progress / 0.35);
  const p2 = Math.max(0, (progress - 0.35) / 0.65);

  ctx.beginPath();
  ctx.moveTo(startX, startY);

  if (p1 > 0) {
    const curMidX = startX + (midX - startX) * p1;
    const curMidY = startY + (midY - startY) * p1;
    ctx.lineTo(curMidX, curMidY);
  }

  if (p2 > 0) {
    const curEndX = midX + (endX - midX) * p2;
    const curEndY = midY + (endY - midY) * p2;
    ctx.lineTo(curEndX, curEndY);
  }

  ctx.stroke();
  ctx.restore();
}
