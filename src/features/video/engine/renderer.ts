import { AnnotationRegion, VideoAction } from '../../../types';
import { RenderOptions, FitRect } from './types';
import { computeTimelineVisualState } from './timeline';
import { drawAnimatedCross, drawAnimatedCheck } from './animations';

export function calculateFitRect(imgWidth: number, imgHeight: number, canvasWidth: number, canvasHeight: number, margin = 0): FitRect {
  const availableW = Math.max(1, canvasWidth - margin * 2);
  const availableH = Math.max(1, canvasHeight - margin * 2);
  const scale = Math.min(availableW / Math.max(1, imgWidth), availableH / Math.max(1, imgHeight));
  const width = imgWidth > 0 ? imgWidth * scale : availableW;
  const height = imgHeight > 0 ? imgHeight * scale : availableH;
  return { x: (canvasWidth - width) / 2, y: (canvasHeight - height) / 2, width, height };
}

export function regionCanvasRect(region: AnnotationRegion, fit: FitRect): FitRect {
  return { x: fit.x + region.x * fit.width, y: fit.y + region.y * fit.height,
    width: region.width * fit.width, height: region.height * fit.height };
}

// Marks belong outside the text. At image edges try the other side, then above.
export function markerGeometry(rect: FitRect, canvasWidth: number, scale = 1, correct = false, anchor?: AnnotationRegion['markerAnchor']) {
  const radius = 16 * scale;
  const gap = 12 * scale;
  const left = rect.x - gap - radius;
  const right = rect.x + rect.width + gap + radius;
  const canLeft = left - radius >= 2 * scale;
  const canRight = right + radius <= canvasWidth - 2 * scale;
  const x = correct ? (canRight ? right : canLeft ? left : rect.x + radius)
    : (canLeft ? left : canRight ? right : rect.x + radius);
  return { x, y: canLeft || canRight ? rect.y + rect.height * (anchor?.y ?? .5) : Math.max(radius, rect.y - gap - radius), radius };
}

function isolateArabic(text: string) {
  return text.replace(/([\u0600-\u06ff][\u0600-\u06ff\s«»\-]*[\u0600-\u06ff])/g, '\u2067$1\u2069');
}

export function captionLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? line + ' ' + word : word;
    if (line && ctx.measureText(isolateArabic(candidate)).width > maxWidth) {
      lines.push(line); line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, options: RenderOptions) {
  if (options.showCaptions === false) return;
  const cue = options.captions?.find(c => time >= c.start && time < c.end);
  if (!cue) return;
  const scale = Math.min(width / 1920, height / 1080);
  const maxWidth = width - 180 * scale;
  let size = 36 * scale;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.direction = /^[\u0600-\u06ff\s«».,\-]+$/.test(cue.text) ? 'rtl' : 'ltr';
  let lines: string[];
  do {
    ctx.font = '500 ' + size + 'px "Manrope", "Amiri", sans-serif';
    lines = captionLines(ctx, cue.text, maxWidth - 56 * scale);
    if (lines.length <= 2 || size <= 23 * scale) break;
    size -= scale;
  } while (true);
  const lineHeight = size * 1.65;
  const boxHeight = lines.length * lineHeight + 20 * scale;
  const boxWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(isolateArabic(l)).width)) + 56 * scale);
  const centerY = Math.max(boxHeight / 2, Math.min(height - boxHeight / 2, height * (options.captionY ?? .85)));
  ctx.fillStyle = '#3F1518'; ctx.beginPath();
  ctx.roundRect((width - boxWidth) / 2, centerY - boxHeight / 2, boxWidth, boxHeight, 9 * scale);
  ctx.fill(); ctx.fillStyle = '#FFFFFF';
  lines.forEach((line, i) => ctx.fillText(isolateArabic(line), width / 2,
    centerY + (i - (lines.length - 1) / 2) * lineHeight));
  ctx.restore();
}

/** One deterministic painter for editing, playback, and every encoded frame. */
export function renderQuestionVideoFrame(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  imageElement: HTMLImageElement | null, regions: AnnotationRegion[] = [],
  actions: VideoAction[] = [], currentTime: number, options: RenderOptions
): FitRect {
  const scale = Math.min(width / 1920, height / 1080);
  ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
  const fit = calculateFitRect(imageElement?.naturalWidth || width, imageElement?.naturalHeight || height, width, height);
  if (imageElement?.complete && imageElement.naturalWidth > 0)
    ctx.drawImage(imageElement, fit.x, fit.y, fit.width, fit.height);
  const state = computeTimelineVisualState(currentTime, actions, regions, options.selectedRegionId);
  const byId = new Map(regions.map(r => [r.id, r]));
  const rectFor = (id: string) => { const r = byId.get(id); return r ? regionCanvasRect(r, fit) : null; };
  const frame = (r: FitRect, color: string, fill: string, opacity: number) => {
    ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = fill; ctx.beginPath();
    ctx.roundRect(r.x - 5 * scale, r.y - 4 * scale, r.width + 10 * scale, r.height + 8 * scale, 11 * scale);
    ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 3 * scale; ctx.stroke(); ctx.restore();
  };
  if (state.activeDimOthers.active) {
    const r = rectFor(state.activeDimOthers.targetRegionId!);
    if (r) {
      ctx.fillStyle = 'rgba(18,18,18,.15)';
      ctx.beginPath(); ctx.rect(fit.x, fit.y, fit.width, fit.height); ctx.rect(r.x, r.y, r.width, r.height); ctx.fill('evenodd');
    }
  }
  for (const h of state.activeHighlights) {
    const r = rectFor(h.regionId); if (!r) continue;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = h.opacity;
    ctx.fillStyle = '#FFD860'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, 5 * scale); ctx.fill(); ctx.restore();
  }
  for (const u of state.activeUnderlines) {
    const r = rectFor(u.regionId); if (!r || u.progress <= 0) continue;
    ctx.strokeStyle = '#B38119'; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round'; ctx.beginPath();
    const start = u.isRtl ? r.x + r.width : r.x;
    ctx.moveTo(start, r.y + r.height + 3 * scale);
    ctx.lineTo(start + (u.isRtl ? -1 : 1) * r.width * u.progress, r.y + r.height + 3 * scale); ctx.stroke();
  }
  for (const f of state.activeFocus) {
    const r = rectFor(f.regionId);
    if (r && !state.correctRegions[f.regionId] && !state.rejectedRegions[f.regionId])
      frame(r, '#B38119', 'rgba(255,216,96,.15)', f.intensity);
  }
  for (const [id, mark] of Object.entries(state.rejectedRegions)) {
    const r = rectFor(id); if (!r || state.correctRegions[id]) continue;
    const m = markerGeometry(r, width, scale, false, byId.get(id)?.markerAnchor);
    drawAnimatedCross(ctx, m.x, m.y, m.radius, mark.drawProgress, '#AE3038', 4 * scale);
  }
  for (const [id, mark] of Object.entries(state.correctRegions)) {
    const r = rectFor(id); if (!r) continue;
    frame(r, '#238657', 'rgba(71,177,123,.15)', mark.drawProgress);
    const m = markerGeometry(r, width, scale, true, byId.get(id)?.markerAnchor);
    drawAnimatedCheck(ctx, m.x, m.y, m.radius * 1.25, mark.drawProgress, '#238657', 5 * scale);
    if (mark.drawProgress > .8) {
      ctx.font = '700 ' + 27 * scale + 'px "Manrope", sans-serif';
      ctx.fillStyle = '#238657'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const labelWidth = ctx.measureText('Doğru cevap').width;
      const labelX = m.x + m.radius + 10 * scale;
      const blocked = regions.some(other => {
        if (other.id === id || !other.type.startsWith('option')) return false;
        const b = regionCanvasRect(other, fit);
        return b.x < labelX + labelWidth && b.x + b.width > labelX
          && b.y < m.y + 18 * scale && b.y + b.height > m.y - 18 * scale;
      });
      if (m.x > r.x + r.width && labelX + labelWidth < width - 16 * scale && !blocked)
        ctx.fillText('Doğru cevap', labelX, m.y);
    }
  }
  drawCaption(ctx, width, height, currentTime, options);
  if (options.interactiveMode) for (const r of regions) {
    const b = regionCanvasRect(r, fit);
    ctx.save(); ctx.strokeStyle = r.id === options.selectedRegionId ? '#8B1E2D' : '#64748B';
    ctx.lineWidth = 2 * scale; ctx.setLineDash([5 * scale, 4 * scale]);
    ctx.strokeRect(b.x, b.y, b.width, b.height); ctx.restore();
  }
  ctx.restore(); return fit;
}
