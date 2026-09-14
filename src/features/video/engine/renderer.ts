import { AnnotationRegion, VideoAction } from '../../../types';
import { RenderOptions, FitRect } from './types';
import { computeTimelineVisualState } from './timeline';
import { drawAnimatedCross, drawAnimatedCheck } from './animations';

/**
 * Calculates the bounding box of the image centered inside the canvas while preserving aspect ratio.
 */
export function calculateFitRect(
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  margin = 32
): FitRect {
  const availWidth = canvasWidth - margin * 2;
  const availHeight = canvasHeight - margin * 2;

  if (imgWidth <= 0 || imgHeight <= 0) {
    return {
      x: margin,
      y: margin,
      width: availWidth,
      height: availHeight,
    };
  }

  const imgAspect = imgWidth / imgHeight;
  const availAspect = availWidth / availHeight;

  let fitWidth: number;
  let fitHeight: number;

  if (imgAspect > availAspect) {
    // Width constrained
    fitWidth = availWidth;
    fitHeight = availWidth / imgAspect;
  } else {
    // Height constrained
    fitHeight = availHeight;
    fitWidth = availHeight * imgAspect;
  }

  const x = margin + (availWidth - fitWidth) / 2;
  const y = margin + (availHeight - fitHeight) / 2;

  return { x, y, width: fitWidth, height: fitHeight };
}

/**
 * Core rendering function for the video composition.
 * Can be used by both the live React Canvas preview and the browser-side MP4/WebM exporter.
 */
export function renderQuestionVideoFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  imageElement: HTMLImageElement | null,
  regions: AnnotationRegion[] = [],
  actions: VideoAction[] = [],
  currentTime: number,
  options: RenderOptions
): FitRect {
  const {
    showWatermark = true,
    teacherTag = 'Arapça YDT • Soru Çözümü',
    selectedRegionId = null,
    interactiveMode = false,
  } = options;

  // 1. Clear Canvas Background (Restrained academic canvas)
  ctx.save();
  ctx.fillStyle = '#F4F3EE';
  ctx.fillRect(0, 0, width, height);

  // Subtle header strip background
  ctx.fillStyle = '#EAE8DF';
  ctx.fillRect(0, 0, width, 48);

  // Top header text
  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 18px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ÖSYM Arapça YDT Soru Çözüm Analizi', 32, 24);

  if (showWatermark && teacherTag) {
    ctx.font = '500 14px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8B1E2D';
    ctx.fillText(teacherTag, width - 32, 24);
  }
  ctx.restore();

  // 2. Center and Draw Question Image
  let fitRect: FitRect;
  const contentTopMargin = 60;
  const availH = height - contentTopMargin - 20;

  if (imageElement && imageElement.complete && imageElement.naturalWidth > 0) {
    fitRect = calculateFitRect(
      imageElement.naturalWidth,
      imageElement.naturalHeight,
      width,
      availH,
      32
    );
    fitRect.y += contentTopMargin;

    // Draw white shadow card under image
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(fitRect.x, fitRect.y, fitRect.width, fitRect.height);
    ctx.restore();

    // Draw question image
    ctx.drawImage(imageElement, fitRect.x, fitRect.y, fitRect.width, fitRect.height);

    // Subtle 1px border around image
    ctx.strokeStyle = '#D5D4CC';
    ctx.lineWidth = 1;
    ctx.strokeRect(fitRect.x, fitRect.y, fitRect.width, fitRect.height);
  } else {
    // Fallback if no image uploaded yet
    fitRect = {
      x: 64,
      y: contentTopMargin + 20,
      width: width - 128,
      height: availH - 40,
    };

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(fitRect.x, fitRect.y, fitRect.width, fitRect.height);
    ctx.strokeStyle = '#D5D4CC';
    ctx.lineWidth = 1;
    ctx.strokeRect(fitRect.x, fitRect.y, fitRect.width, fitRect.height);

    ctx.fillStyle = '#787670';
    ctx.font = '16px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Soru görseli bekleniyor...', width / 2, height / 2);
  }

  // 3. Compute Timeline Visual State for current timestamp
  const state = computeTimelineVisualState(currentTime, actions, regions, selectedRegionId);

  // Helper: map normalized region [0..1] to canvas coordinates
  const getRegionCanvasRect = (r: AnnotationRegion) => {
    const rx = fitRect.x + r.x * fitRect.width;
    const ry = fitRect.y + r.y * fitRect.height;
    const rw = r.width * fitRect.width;
    const rh = r.height * fitRect.height;
    return { rx, ry, rw, rh };
  };

  // Region lookup map
  const regionMap = new Map<string, AnnotationRegion>();
  regions.forEach((r) => regionMap.set(r.id, r));

  // 4. Dim-Others Layer (if active)
  if (state.activeDimOthers.active && state.activeDimOthers.targetRegionId) {
    const targetRegion = regionMap.get(state.activeDimOthers.targetRegionId);
    if (targetRegion) {
      const { rx, ry, rw, rh } = getRegionCanvasRect(targetRegion);
      ctx.save();
      ctx.fillStyle = `rgba(18, 18, 18, ${state.activeDimOthers.opacity})`;

      // Cut out target region using path winding rule
      ctx.beginPath();
      ctx.rect(fitRect.x, fitRect.y, fitRect.width, fitRect.height);
      ctx.rect(rx, ry, rw, rh);
      ctx.fill('evenodd');
      ctx.restore();
    }
  }

  // 5. Highlights
  for (const hl of state.activeHighlights) {
    const region = regionMap.get(hl.regionId);
    if (!region) continue;
    const { rx, ry, rw, rh } = getRegionCanvasRect(region);

    ctx.save();
    // Warm academic amber/red translucent highlight
    ctx.fillStyle = `rgba(217, 119, 6, ${hl.opacity})`;
    ctx.beginPath();
    ctx.roundRect(rx - 2, ry - 2, rw + 4, rh + 4, 4);
    ctx.fill();
    ctx.restore();
  }

  // 6. Underlines (Arabic RTL by default)
  for (const ul of state.activeUnderlines) {
    const region = regionMap.get(ul.regionId);
    if (!region) continue;
    const { rx, ry, rw, rh } = getRegionCanvasRect(region);

    if (ul.progress > 0) {
      ctx.save();
      ctx.strokeStyle = '#8B1E2D';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      const lineY = ry + rh + 2;
      ctx.beginPath();

      if (ul.isRtl) {
        // Draw from right edge towards left
        const startX = rx + rw;
        const endX = startX - rw * ul.progress;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(endX, lineY);
      } else {
        // LTR
        const startX = rx;
        const endX = startX + rw * ul.progress;
        ctx.moveTo(startX, lineY);
        ctx.lineTo(endX, lineY);
      }

      ctx.stroke();
      ctx.restore();
    }
  }

  // 7. Focus Emphases
  for (const fc of state.activeFocus) {
    const region = regionMap.get(fc.regionId);
    if (!region) continue;
    const { rx, ry, rw, rh } = getRegionCanvasRect(region);

    ctx.save();
    ctx.strokeStyle = '#8B1E2D';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(139, 30, 45, 0.08)';
    ctx.beginPath();
    ctx.roundRect(rx - 4, ry - 4, rw + 8, rh + 8, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 8. Rejection Marks ('X')
  for (const [regionId, marker] of Object.entries(state.rejectedRegions)) {
    const region = regionMap.get(regionId);
    if (!region) continue;
    const { rx, ry, rw, rh } = getRegionCanvasRect(region);

    // Center of X: either over left option badge or inside the option box
    const radius = Math.max(14, Math.min(24, Math.min(rw, rh) * 0.45));
    const centerX = rx + radius + 4;
    const centerY = ry + rh / 2;

    drawAnimatedCross(ctx, centerX, centerY, radius, marker.drawProgress, '#8B1E2D', 4.5);

    // Also draw subtle red strike-through line across text
    if (marker.drawProgress >= 0.8) {
      ctx.save();
      ctx.strokeStyle = 'rgba(139, 30, 45, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + radius * 2 + 10, centerY);
      ctx.lineTo(rx + rw - 4, centerY);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 9. Correct Answer Marks ('✓')
  for (const [regionId, marker] of Object.entries(state.correctRegions)) {
    const region = regionMap.get(regionId);
    if (!region) continue;
    const { rx, ry, rw, rh } = getRegionCanvasRect(region);

    // Draw positive green border around the option box
    ctx.save();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 3.5;
    ctx.fillStyle = 'rgba(22, 163, 74, 0.08)';
    ctx.beginPath();
    ctx.roundRect(rx - 3, ry - 3, rw + 6, rh + 6, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw animated green check mark
    const radius = Math.max(15, Math.min(26, Math.min(rw, rh) * 0.48));
    const centerX = rx + radius + 4;
    const centerY = ry + rh / 2;

    drawAnimatedCheck(ctx, centerX, centerY, radius, marker.drawProgress, '#15803D', 5);
  }

  // 10. Interactive Region Editor Outlines (only in interactive editing mode)
  if (interactiveMode) {
    for (const r of regions) {
      const { rx, ry, rw, rh } = getRegionCanvasRect(r);
      const isSelected = r.id === selectedRegionId;

      ctx.save();
      ctx.strokeStyle = isSelected ? '#8B1E2D' : '#6B7280';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash(isSelected ? [] : [4, 4]);

      ctx.strokeRect(rx, ry, rw, rh);

      // Label badge above region
      ctx.fillStyle = isSelected ? '#8B1E2D' : '#374151';
      ctx.font = 'bold 11px "IBM Plex Sans", sans-serif';
      const textWidth = ctx.measureText(r.label).width;
      ctx.fillRect(rx, Math.max(fitRect.y, ry - 18), textWidth + 8, 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, rx + 4, Math.max(fitRect.y + 8, ry - 10));

      // Resize handle on bottom-right corner if selected
      if (isSelected) {
        ctx.fillStyle = '#8B1E2D';
        ctx.fillRect(rx + rw - 7, ry + rh - 7, 7, 7);
      }
      ctx.restore();
    }
  }

  return fitRect;
}
