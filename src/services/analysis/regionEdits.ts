import { AnnotationRegion, VideoConfig, NarrationWord } from '../../types';
import { parseSolutionSemantics } from './solutionParser';
import { alignEventsWithNarration } from './timelineAligner';

export function planRegionActions(regions: AnnotationRegion[], text: string, words: NarrationWord[], duration: number) {
  const matches = regions.filter(r => r.content && !r.type.startsWith('option') && r.id !== 'question-root')
    .map(region => ({ phrase: region.content!, region, matchedWords: [] }));
  return alignEventsWithNarration(parseSolutionSemantics(text, regions, matches).events, words, duration, text);
}

/** Geometry edits retain existing timing; new/retargeted phrases get real audio timing. */
export function applyRegionEdits(config: VideoConfig, next: AnnotationRegion[], text: string, words: NarrationWord[], duration: number): VideoConfig {
  const before = config.regions || [];
  const regions = next.map(r => {
    const old = before.find(o => o.id === r.id);
    return JSON.stringify(old) === JSON.stringify(r) ? r : { ...r, manuallyAdjusted: true };
  });
  const changedTargets = new Set(regions.filter(r => {
    const old = before.find(o => o.id === r.id);
    return !old || old.type !== r.type || old.content !== r.content;
  }).map(r => r.id));
  const ids = new Set(regions.map(r => r.id));
  const actions = (config.timelineActions || []).filter(a => ids.has(a.targetRegionId) && !changedTargets.has(a.targetRegionId));
  const fresh = planRegionActions(regions, text, words, duration).filter(a => changedTargets.has(a.targetRegionId));
  const removed = before.filter(r => !ids.has(r.id)).map(r => r.id);
  const missing = ['A','B','C','D','E'].filter(l => !ids.has(`option-${l.toLowerCase()}`));
  return { ...config, regions,
    suppressedRegionIds: [...new Set([...(config.suppressedRegionIds || []), ...removed])].filter(id => !ids.has(id)),
    timelineActions: [...actions, ...fresh.map(a => ({ ...a, id: `edit-${a.targetRegionId}-${a.type}-${a.start}` }))].sort((a,b) => a.start-b.start),
    warnings: [...(config.warnings || []).filter(w => !w.startsWith('Şu şıklar bulunamadı:')),
      ...(missing.length ? [`Şu şıklar bulunamadı: ${missing.join(', ')}. Alan düzenleyicisinden ekleyebilirsiniz.`] : [])],
  };
}
