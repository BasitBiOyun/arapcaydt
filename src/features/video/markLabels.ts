import type { AnnotationRegion, VideoAction } from '../../types';

const TITLE: Partial<Record<VideoAction['type'], (target: string) => string>> = {
  reject: t => `${t} elenir`,
  correct: t => `${t}: doğru cevap`,
  focus: t => `Odak: ${t}`,
  underline: t => `Altı çizilir: ${t}`,
  circle: t => `Daire: ${t}`,
  highlight: t => `Vurgu: ${t}`,
};

/** A mark in plain words ("C şıkkı elenir"); for other actions, just the box's name. */
export function cueTitle(action: VideoAction, regions: AnnotationRegion[]): string {
  const region = regions.find(r => r.id === action.targetRegionId);
  const option = /^option-([a-e])$/.exec(action.targetRegionId);
  const target = option ? `${option[1].toUpperCase()} şıkkı`
    : (region?.content || region?.label || 'Seçili alan').replace(/\s+/g, ' ').trim().slice(0, 40);
  return TITLE[action.type]?.(target) ?? target;
}

/** An underline moved up (negative) or down by a share of its text line. */
export const withLineOffset = (action: VideoAction, delta: number): VideoAction =>
  ({ ...action, lineOffset: Math.round(Math.max(-1.5, Math.min(1.5, (action.lineOffset ?? 0) + delta)) * 100) / 100 });
