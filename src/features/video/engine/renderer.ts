import { AnnotationRegion, VideoAction } from '../../../types';
import { RenderOptions, FitRect } from './types';
import { computeTimelineVisualState } from './timeline';
import { drawAnimatedCross, drawAnimatedCheck, easeOutBack, easeOutCubic, easeOutQuad } from './animations';

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

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-zÇĞİÖŞÜçğıöşü0-9]/;

interface CaptionToken { text: string; from: number; to: number; rtl: boolean; width: number; start?: number; glued?: boolean }

/** Lays out words in visual order: Arabic runs read right-to-left inside a Turkish (LTR) line. */
function layoutCaptionLine(tokens: CaptionToken[], rtlBase: boolean, space: number) {
  const placed: Array<CaptionToken & { x: number }> = [];
  let x = 0;
  const gap = (token: CaptionToken, index: number) => index && !token.glued ? space : 0;
  const place = (run: CaptionToken[], rtl: boolean) => {
    if (placed.length && !run[0].glued) x += space;
    const runWidth = run.reduce((sum, token, index) => sum + token.width + gap(token, index), 0);
    let cursor = rtl ? x + runWidth : x;
    run.forEach((token, index) => {
      if (rtl) { cursor -= gap(token, index) + token.width; placed.push({ ...token, x: cursor }); }
      else { cursor += gap(token, index); placed.push({ ...token, x: cursor }); cursor += token.width; }
    });
    x += runWidth;
  };
  if (rtlBase) place(tokens, true);
  else for (let i = 0; i < tokens.length;) {
    let j = i + 1;
    while (j < tokens.length && tokens[j].rtl === tokens[i].rtl) j++;
    place(tokens.slice(i, j), tokens[i].rtl);
    i = j;
  }
  return { placed, width: x };
}

function drawCaption(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, options: RenderOptions) {
  if (options.showCaptions === false) return;
  const cue = options.captions?.find(c => time >= c.start && time < c.end);
  if (!cue) return;
  const scale = Math.min(width / 1920, height / 1080);
  const maxWidth = width - 180 * scale;
  const padX = 34 * scale;
  const rtlBase = !LATIN.test(cue.text);
  const fade = Math.min(1, (time - cue.start) / .12, (cue.end - time) / .12);
  // In a Turkish line, punctuation next to Arabic belongs to the Turkish flow ("فِي," keeps its comma on the right).
  const pieces = Array.from(cue.text.matchAll(/\S+/g)).flatMap(m => {
    const split = !rtlBase && ARABIC.test(m[0]) && !LATIN.test(m[0]) ? m[0].match(/^([^\u0600-\u06ff]*)(.*?)([^\u0600-\u06ff]*)$/su) : null;
    if (!split) return [{ text: m[0], from: m.index!, glued: false }];
    let from = m.index!;
    return [split[1], split[2], split[3]].flatMap((text, index) => {
      const piece = { text, from, glued: index > 0 };
      from += text.length;
      return text ? [piece] : [];
    }).map((piece, index) => ({ ...piece, glued: index > 0 }));
  });
  const tokens: CaptionToken[] = pieces.map(piece => ({
    ...piece, to: piece.from + piece.text.length, width: 0,
    rtl: rtlBase || (ARABIC.test(piece.text) && !LATIN.test(piece.text)),
    start: cue.words?.find(w => w.to > piece.from && w.from < piece.from + piece.text.length)?.start,
  }));
  let size = 36 * scale;
  let lines: CaptionToken[][] = [];
  let space = 0;
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  do {
    ctx.font = '700 ' + size + 'px "Manrope", "Amiri", sans-serif';
    space = ctx.measureText(' ').width;
    for (const token of tokens) { ctx.direction = token.rtl ? 'rtl' : 'ltr'; token.width = ctx.measureText(token.text).width; }
    lines = [];
    let line: CaptionToken[] = []; let lineWidth = 0;
    for (const token of tokens) {
      const next = line.length ? lineWidth + (token.glued ? 0 : space) + token.width : token.width;
      if (line.length && !token.glued && next > maxWidth - padX * 2) { lines.push(line); line = [{ ...token, glued: false }]; lineWidth = token.width; }
      else { line.push(token); lineWidth = next; }
    }
    if (line.length) lines.push(line);
    if (lines.length <= 2 || size <= 23 * scale) break;
    size -= scale;
  } while (true);
  const layouts = lines.map(line => layoutCaptionLine(line, rtlBase, space));
  const lineHeight = size * 1.6;
  const boxHeight = lines.length * lineHeight + 24 * scale;
  const boxWidth = Math.min(maxWidth, Math.max(...layouts.map(l => l.width)) + padX * 2);
  const centerY = Math.max(boxHeight / 2, Math.min(height - boxHeight / 2, height * (options.captionY ?? .85)));
  ctx.globalAlpha = Math.max(0, fade);
  ctx.shadowColor = 'rgba(15,23,42,.35)'; ctx.shadowBlur = 24 * scale; ctx.shadowOffsetY = 6 * scale;
  ctx.fillStyle = 'rgba(24,16,20,.86)'; ctx.beginPath();
  ctx.roundRect((width - boxWidth) / 2, centerY - boxHeight / 2, boxWidth, boxHeight, 18 * scale);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // Karaoke: the word being spoken glows amber, spoken words stay white, upcoming words wait dimmed.
  // Punctuation and untimed pieces inherit the time of the word before them.
  let carry = -Infinity;
  const effective = tokens.map(token => (carry = token.start ?? carry));
  const timed = tokens.some(token => token.start !== undefined);
  const activeStart = Math.max(-Infinity, ...effective.filter(start => start <= time));
  layouts.forEach((layout, row) => {
    const left = (width - layout.width) / 2;
    const y = centerY + (row - (lines.length - 1) / 2) * lineHeight;
    for (const token of layout.placed) {
      const index = tokens.findIndex(t => t.from === token.from);
      ctx.direction = token.rtl ? 'rtl' : 'ltr';
      const current = timed && effective[index] === activeStart && activeStart > -Infinity;
      const spoken = !timed || effective[index] < activeStart;
      ctx.fillStyle = current ? '#FCD34D' : spoken ? '#FFFFFF' : 'rgba(255,255,255,.58)';
      ctx.fillText(token.text, left + token.x, y);
    }
  });
  ctx.restore();
}

/** Frame whose outline is traced around the box as `progress` goes 0 → 1. */
function tracedFrame(ctx: CanvasRenderingContext2D, r: FitRect, scale: number, stroke: string, fill: string,
  progress: number, opacity: number, glow: string) {
  if (opacity <= 0) return;
  const x = r.x - 7 * scale, y = r.y - 6 * scale, w = r.width + 14 * scale, h = r.height + 12 * scale;
  const perimeter = 2 * (w + h);
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 12 * scale);
  // Multiply tints the paper but leaves the printed letters at full contrast.
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = fill; ctx.globalAlpha = opacity * Math.min(1, progress * 1.6); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = opacity;
  ctx.shadowColor = glow; ctx.shadowBlur = 18 * scale;
  ctx.strokeStyle = stroke; ctx.lineWidth = 3.5 * scale; ctx.lineJoin = 'round';
  ctx.setLineDash([perimeter * progress, perimeter]);
  ctx.stroke(); ctx.restore();
}

/** Colored disc + white glyph; pops in with a slight overshoot. */
function markBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, age: number, kind: 'reject' | 'correct', scale: number) {
  const pop = easeOutBack(Math.min(1, age / .32));
  if (pop <= 0) return;
  const color = kind === 'reject' ? '#DC2626' : '#16A34A';
  ctx.save();
  if (kind === 'correct' && age < .9) {
    // One expanding ring on arrival.
    const t = age / .9;
    ctx.globalAlpha = (1 - t) * .55; ctx.strokeStyle = color; ctx.lineWidth = 4 * scale * (1 - t) + scale;
    ctx.beginPath(); ctx.arc(cx, cy, radius * (1 + t * 1.3), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.translate(cx, cy); ctx.scale(pop, pop);
  ctx.shadowColor = 'rgba(15,23,42,.28)'; ctx.shadowBlur = 10 * scale; ctx.shadowOffsetY = 3 * scale;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5 * scale; ctx.stroke();
  const stroke = Math.min(1, Math.max(0, (age - .08) / .3));
  if (kind === 'reject') drawAnimatedCross(ctx, 0, 0, radius * .5, stroke, '#FFFFFF', 4.5 * scale);
  else drawAnimatedCheck(ctx, 0, 0, radius * .62, stroke, '#FFFFFF', 5 * scale);
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
  const age = (mark: { timestamp: number }) => Math.max(0, currentTime - mark.timestamp);
  const pad = (r: FitRect, p: number) => ({ x: r.x - p, y: r.y - p, width: r.width + p * 2, height: r.height + p * 2 });

  const focused = state.activeFocus.filter(f => !state.correctRegions[f.regionId] && !state.rejectedRegions[f.regionId]);
  // Naming the already-marked answer again ("Doğru cevap B") re-lights it instead of redrawing the check.
  const emphasis = state.activeFocus.filter(f => state.correctRegions[f.regionId]);
  for (const h of state.activeHighlights) {
    const r = rectFor(h.regionId); if (!r) continue;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = h.opacity;
    ctx.fillStyle = '#FFD860'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, 5 * scale); ctx.fill(); ctx.restore();
  }
  // Highlighter pen sweeps with the voice (right-to-left for Arabic), with a crisp underline beneath.
  for (const u of state.activeUnderlines) {
    const r = rectFor(u.regionId); if (!r || u.progress <= 0) continue;
    const p = easeOutQuad(u.progress);
    const swept = r.width * p;
    const x0 = u.isRtl ? r.x + r.width - swept : r.x;
    ctx.save(); ctx.globalAlpha = u.opacity ?? 1;
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(253,224,71,.55)';
    ctx.beginPath(); ctx.roundRect(x0 - 2 * scale, r.y + r.height * .12, swept + 4 * scale, r.height * .82, 6 * scale); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#D97706'; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(u.isRtl ? r.x + r.width : r.x, r.y + r.height + 4 * scale);
    ctx.lineTo(u.isRtl ? r.x + r.width - swept : r.x + swept, r.y + r.height + 4 * scale); ctx.stroke();
    ctx.restore();
  }
  // Eliminated choices fade back so the remaining ones stand out.
  for (const [id, mark] of Object.entries(state.rejectedRegions)) {
    const r = rectFor(id); if (!r || state.correctRegions[id]) continue;
    ctx.save(); ctx.globalAlpha = .5 * Math.min(1, age(mark) / .45); ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.roundRect(r.x - 4 * scale, r.y - 3 * scale, r.width + 8 * scale, r.height + 6 * scale, 8 * scale); ctx.fill(); ctx.restore();
  }
  // Spotlight: while an option is examined the rest of the slide recedes; judged options stay visible.
  const lastCorrect = Object.values(state.correctRegions).sort((a, b) => b.timestamp - a.timestamp)[0];
  const lit = [...focused, ...emphasis];
  const spot = lit.length
    ? { rects: [...lit.map(f => f.regionId), ...Object.keys(state.correctRegions)].map(rectFor).filter(Boolean) as FitRect[],
        strength: Math.max(...lit.map(f => f.intensity)) }
    : lastCorrect && age(lastCorrect) < 2.4
      ? { rects: [rectFor(lastCorrect.regionId)].filter(Boolean) as FitRect[], strength: Math.min(1, age(lastCorrect) / .3, (2.4 - age(lastCorrect)) / .5) }
      : state.activeDimOthers.active
        ? { rects: [rectFor(state.activeDimOthers.targetRegionId!)].filter(Boolean) as FitRect[], strength: .6 }
        : null;
  if (spot?.rects.length && spot.strength > 0) {
    ctx.save(); ctx.fillStyle = `rgba(15,23,42,${.16 * spot.strength})`; ctx.beginPath();
    ctx.rect(fit.x, fit.y, fit.width, fit.height);
    for (const r of spot.rects) { const p = pad(r, 9 * scale); ctx.roundRect(p.x, p.y, p.width, p.height, 13 * scale); }
    ctx.fill('evenodd'); ctx.restore();
  }

  for (const f of focused) {
    const r = rectFor(f.regionId); if (!r) continue;
    tracedFrame(ctx, r, scale, '#F59E0B', 'rgba(254,243,199,.38)', easeOutCubic(f.intensity), f.intensity, 'rgba(245,158,11,.45)');
  }
  for (const [id, mark] of Object.entries(state.rejectedRegions)) {
    const r = rectFor(id); if (!r || state.correctRegions[id]) continue;
    const t = age(mark);
    if (t < .45) tracedFrame(ctx, r, scale, '#DC2626', 'rgba(254,226,226,.35)', 1, 1 - t / .45, 'rgba(220,38,38,.35)');
    const m = markerGeometry(r, width, scale, false, byId.get(id)?.markerAnchor);
    markBadge(ctx, m.x, m.y, m.radius * 1.15, t, 'reject', scale);
  }
  for (const [id, mark] of Object.entries(state.correctRegions)) {
    const r = rectFor(id); if (!r) continue;
    const t = age(mark);
    const lift = emphasis.find(f => f.regionId === id)?.intensity ?? 0;
    tracedFrame(ctx, r, scale, '#16A34A', `rgba(220,252,231,${.45 + .25 * lift})`, easeOutCubic(Math.min(1, t / .45)), 1, 'rgba(22,163,74,.5)');
    if (lift > 0) tracedFrame(ctx, pad(r, 7 * scale), scale, 'rgba(22,163,74,.55)', 'transparent', 1, lift * (.55 + .45 * Math.sin(currentTime * 5) ** 2), 'rgba(22,163,74,.6)');
    const m = markerGeometry(r, width, scale, true, byId.get(id)?.markerAnchor);
    markBadge(ctx, m.x, m.y, m.radius * 1.3, t, 'correct', scale);
    const reveal = Math.min(1, Math.max(0, (t - .3) / .3));
    if (reveal > 0) {
      ctx.save(); ctx.font = '700 ' + 25 * scale + 'px "Manrope", sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const label = 'Doğru cevap';
      const labelWidth = ctx.measureText(label).width + 28 * scale;
      const labelX = m.x + m.radius * 1.3 + 10 * scale;
      const blocked = regions.some(other => {
        if (other.id === id || !other.type.startsWith('option')) return false;
        const b = regionCanvasRect(other, fit);
        return b.x < labelX + labelWidth && b.x + b.width > labelX
          && b.y < m.y + 20 * scale && b.y + b.height > m.y - 20 * scale;
      });
      if (m.x > r.x + r.width && labelX + labelWidth < width - 16 * scale && !blocked) {
        ctx.globalAlpha = reveal; ctx.translate((1 - reveal) * -12 * scale, 0);
        ctx.fillStyle = '#16A34A'; ctx.beginPath(); ctx.roundRect(labelX, m.y - 20 * scale, labelWidth, 40 * scale, 20 * scale); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(label, labelX + 14 * scale, m.y + scale);
      }
      ctx.restore();
    }
  }
  drawCaption(ctx, width, height, currentTime, options);
  if (!options.interactiveMode && options.duration && options.duration > 0) {
    const p = Math.max(0, Math.min(1, currentTime / options.duration));
    ctx.fillStyle = 'rgba(139,30,45,.14)'; ctx.fillRect(0, height - 6 * scale, width, 6 * scale);
    ctx.fillStyle = '#8B1E2D'; ctx.fillRect(0, height - 6 * scale, width * p, 6 * scale);
  }
  if (options.interactiveMode) for (const r of regions) {
    const b = regionCanvasRect(r, fit);
    ctx.save(); ctx.strokeStyle = r.id === options.selectedRegionId ? '#8B1E2D' : '#64748B';
    ctx.lineWidth = 2 * scale; ctx.setLineDash([5 * scale, 4 * scale]);
    ctx.strokeRect(b.x, b.y, b.width, b.height); ctx.restore();
  }
  ctx.restore(); return fit;
}
