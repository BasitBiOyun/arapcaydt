import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRegionEdits, assignOption } from '../src/services/analysis/regionEdits';
import type { AnnotationRegion, VideoConfig } from '../src/types';
const region = (id:string, content = ''):AnnotationRegion => ({id,type:id.startsWith('option-') ? id as any : 'keyword',label:id,content,x:.2,y:id.startsWith('option-')?.4:.2,width:.1,height:.05});
const base:VideoConfig={aspectRatio:'16:9',fps:30,backgroundColor:'#fff',showWatermark:false,annotations:[],regions:[region('option-a')],timelineActions:[{id:'keep',type:'focus',targetRegionId:'option-a',start:2,duration:3}]};
const text='A şıkkı. Olmaz. B şıkkı. Doğru cevap B. مُمَيِّزَاتٌ';
const words=[{text:'A',start:0,end:1},{text:'şıkkı.',start:1,end:2},{text:'Olmaz.',start:2,end:3},{text:'B',start:4,end:5},{text:'şıkkı.',start:5,end:6},{text:'Doğru',start:6,end:7},{text:'cevap',start:7,end:8},{text:'B.',start:8,end:9},{text:'مُمَيِّزَاتٌ',start:10,end:11}];
test('new manual option immediately gets focus/check from narration and retains other timings',()=>{
 const next=applyRegionEdits(base,[...base.regions!,region('option-b')],text,words,12);
 assert.ok(next.timelineActions!.some(a=>a.targetRegionId==='option-b' && a.type==='correct'));
 assert.ok(next.timelineActions!.some(a=>a.id==='keep' && a.start===2));
 assert.ok(next.regions!.find(r=>r.id==='option-b')!.manuallyAdjusted);
});
test('a box named as a missing option gets its tick from the narration; its own marks move with it',()=>{
 const drawn={...region('manual-box-1'),label:'Elle eklenen alan'};
 const config={...base,regions:[...base.regions!,drawn],timelineActions:[...base.timelineActions!,
  {id:'manual-manual-box-1-focus-3000-1',type:'focus' as const,targetRegionId:'manual-box-1',regionId:'manual-box-1',start:3,duration:2},
  {id:'manual-manual-box-1-reject-3000-2',type:'reject' as const,targetRegionId:'manual-box-1',regionId:'manual-box-1',start:3,duration:9}]};
 const next=assignOption(config,'manual-box-1','B',text,words,12);
 const b=next.regions!.find(r=>r.id==='option-b')!;
 assert.deepEqual([b.type,b.label,b.x,b.y],['option-b','B Şıkkı',drawn.x,drawn.y]);
 assert.ok(!next.regions!.some(r=>r.id==='manual-box-1'));
 const marks=next.timelineActions!.filter(a=>a.targetRegionId==='option-b');
 assert.ok(marks.some(a=>a.type==='correct'&&a.start>=5.9),'the narrated tick, at the spoken answer');
 assert.ok(!marks.some(a=>a.type==='reject'),'the hand-made cross gives way to the narrated verdict');
 assert.ok(marks.some(a=>a.type==='focus'&&a.start===3&&a.regionId==='option-b'),'the teacher\'s frame moves with the box');
 assert.ok(next.timelineActions!.some(a=>a.id==='keep'),'other options keep their marks');
 assert.ok(!next.warnings!.some(w=>w.includes('B')&&w.startsWith('Şu şıklar')),'B is no longer missing');
});
test('naming a box as an option that already has one replaces the old box and keeps its narrated marks',()=>{
 const withB=applyRegionEdits(base,[...base.regions!,region('option-b')],text,words,12);
 const tick=withB.timelineActions!.find(a=>a.targetRegionId==='option-b'&&a.type==='correct')!;
 const config={...withB,regions:[...withB.regions!,{...region('manual-box-2'),x:.6,y:.7}]};
 const next=assignOption(config,'manual-box-2','B',text,words,12);
 assert.equal(next.regions!.filter(r=>r.id==='option-b').length,1);
 assert.deepEqual([next.regions!.find(r=>r.id==='option-b')!.x,next.regions!.find(r=>r.id==='option-b')!.y],[.6,.7],'the new place');
 assert.ok(next.timelineActions!.some(a=>a.id===tick.id&&a.start===tick.start),'the narrated tick keeps its time');
 assert.equal(assignOption(next,'option-b','B',text,words,12),next,'naming a box what it already is changes nothing');
 const relabeled=assignOption(next,'option-a','C',text,words,12);
 assert.ok(!relabeled.timelineActions!.some(a=>a.id==='keep'),'narrated marks of the option it was taken for do not follow it');
 assert.ok(relabeled.regions!.some(r=>r.id==='option-c')&&!relabeled.regions!.some(r=>r.id==='option-a'));
});
test('selected phrase creates one timed underline; deletion removes actions and persists suppression',()=>{
 const next=applyRegionEdits(base,[...base.regions!,region('manual-phrase','مُمَيِّزَاتٌ')],text,words,12);
 const marks=next.timelineActions!.filter(a=>a.targetRegionId==='manual-phrase');
 assert.deepEqual(marks.map(a=>a.type).sort(),['underline']);
 assert.ok(marks.every(a=>a.start>=9.5));
 const removed=applyRegionEdits(next,base.regions!,text,words,12);
 assert.ok(!removed.timelineActions!.some(a=>a.targetRegionId==='manual-phrase'));
 assert.ok(removed.suppressedRegionIds!.includes('manual-phrase'));
});
test('move preserves manually edited timeline, while restoring a deleted box clears suppression',()=>{
 const next=applyRegionEdits({...base,suppressedRegionIds:['option-b']},[{...base.regions![0],y:.3},region('option-b')],text,words,12);
 assert.ok(next.timelineActions!.some(a=>a.id==='keep'));
 assert.ok(!next.suppressedRegionIds!.includes('option-b'));
});

test('regenerating keeps deleted targets suppressed and manual phrase timing intact', async () => {
 const { localOcrService } = await import('../src/services/ocr/localOcrService');
 const { localVideoPipeline } = await import('../src/services/pipeline/localVideoPipeline');
 const { readFileSync } = await import('node:fs');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/soru2-ocr.json',import.meta.url),'utf8'));
 const original=localOcrService.recognize;
 localOcrService.recognize=async()=>fixture;
 try {
   const phrase={...region('manual-phrase','مُمَيِّزَاتٌ'),manuallyAdjusted:true};
   const result=await localVideoPipeline.executePipeline({imageUrl:'fixture',solutionText:text,narrationSource:{type:'uploaded',audioUrl:'fixture',duration:12,words},existingRegions:[phrase],suppressedRegionIds:['option-a']});
   assert.ok(!result.regions.some(r=>r.id==='option-a'));
   assert.ok(!result.actions.some(a=>a.targetRegionId==='option-a'));
   assert.ok(result.actions.some(a=>a.targetRegionId==='manual-phrase' && a.type==='underline' && a.start>=9.5));
 } finally {localOcrService.recognize=original;}
});

test('missing visual B does not apply its rejection to the preceding A', async()=>{
 const {parseSolutionSemantics}=await import('../src/services/analysis/solutionParser');
 const result=parseSolutionSemantics('A şıkkı. B şıkkı. Olmaz.',[region('option-a')]);
 assert.ok(!result.events.some(e=>e.actionType==='reject'));
});

test('on-picture editing: corners resize without flipping or leaving the image; only marks on screen count', async () => {
  const { resizeRegion, marksAt, pickableRegions } = await import('../src/features/video/PreviewEditOverlay');
  const box = { id: 'option-b', type: 'option-b', label: 'B', x: .2, y: .4, width: .3, height: .1 } as any;
  const grown = resizeRegion(box, 'se', .1, .05);
  assert.deepEqual([grown.x, grown.y, +grown.width.toFixed(3), +grown.height.toFixed(3), grown.manuallyAdjusted], [.2, .4, .4, .15, true]);
  const moved = resizeRegion(box, 'nw', -.05, 0);
  assert.equal(+moved.x.toFixed(3), .15);
  assert.equal(+(moved.x + moved.width).toFixed(3), .5, 'the opposite corner stays put');
  const flipped = resizeRegion(box, 'se', -.9, -.9);
  assert.ok(flipped.width > 0 && flipped.height > 0, 'never inside out');
  const outside = resizeRegion(box, 'ne', 2, -2);
  assert.equal(outside.x + outside.width, 1); assert.equal(outside.y, 0);
  const actions = [
    { id: 'f', type: 'focus', targetRegionId: 'option-b', start: 2, duration: 1 },
    { id: 'x', type: 'reject', targetRegionId: 'option-b', start: 3, duration: 20 },
    { id: 'd', type: 'dim-others', targetRegionId: 'option-b', start: 0, duration: 30 },
  ] as any;
  assert.deepEqual(marksAt(actions, 'option-b', 2.5).map((a: any) => a.id), ['f']);
  assert.deepEqual(marksAt(actions, 'option-b', 10).map((a: any) => a.id), ['x']);
  assert.deepEqual(pickableRegions([box, { ...box, id: 'question-root', height: .8 }]).map(r => r.id), ['option-b']);
});

test('toolbar marks: added at the paused moment; a tick replaces the cross; a drawn box stays on the image', async () => {
  const { addMark, drawnRegion } = await import('../src/features/video/PreviewEditOverlay');
  const cross = addMark([], 'option-b', 'reject', 12, 40);
  assert.deepEqual(cross.map(a => [a.type, a.start, a.duration]), [['reject', 12, 28]], 'a cross stays to the end');
  const tick = addMark(cross, 'option-b', 'correct', 15, 40);
  assert.deepEqual(tick.map(a => a.type), ['correct'], 'the tick replaces the cross on the same option');
  assert.deepEqual(addMark(cross, 'option-b', 'reject', 5, 40).map(a => [a.type, a.start]), [['reject', 5]], 'one cross per option: the new one moves it');
  assert.equal(addMark(cross, 'option-c', 'reject', 5, 40).length, 2, 'other options keep theirs');
  const both = addMark(addMark([], 'phrase', 'underline', 39.95, 40), 'option-a', 'focus', 5, 40);
  assert.deepEqual(both.map(a => a.type), ['focus', 'underline'], 'sorted by time');
  assert.ok(both[1].duration > 0);
  assert.equal(both[0].duration, 2.5);
  const box = drawnRegion('n', .9, .8, 1.2, .6);
  assert.deepEqual([box.x, box.y, +box.width.toFixed(2), +box.height.toFixed(2)], [.9, .6, .1, .2]);
  const { applyRegionEdits } = await import('../src/services/analysis/regionEdits');
  const config = applyRegionEdits({ aspectRatio: '16:9', fps: 30, backgroundColor: '#fff', showWatermark: false, annotations: [], regions: [], timelineActions: [] } as any,
    [{ ...box, id: 'manual-box-1' }], 'metin', [], 40);
  assert.equal(config.regions!.length, 1, 'a drawn box is kept like any other');
});

test('mark strip: marks never overlap on screen; dragging moves a mark or one of its edges', async () => {
  const { laneLayout, dragPill, stripMarks } = await import('../src/features/video/MarkTimeline');
  const marks = stripMarks([
    { id: 'u', type: 'underline', targetRegionId: 'p', start: 1, duration: 3, drawDuration: 1 },
    { id: 'f', type: 'focus', targetRegionId: 'option-a', start: 2, duration: 2 },
    { id: 'x', type: 'reject', targetRegionId: 'option-a', start: 4.5, duration: 35.5 },
    { id: 'd', type: 'dim-others', targetRegionId: 'option-a', start: 0, duration: 40 },
  ] as any);
  assert.deepEqual(marks.map(m => m.id), ['u', 'f', 'x'], 'background effects are not marks');
  const lanes = laneLayout(marks, 1.8);
  assert.deepEqual([lanes.get('u'), lanes.get('f'), lanes.get('x')], [0, 1, 0]);
  const u = marks[0];
  assert.deepEqual([dragPill(u, 'move', 2, 40).start, dragPill(u, 'move', 2, 40).duration], [3, 3]);
  const later = dragPill(u, 'start', 1, 40);
  assert.deepEqual([later.start, later.duration], [2, 2], 'the end stays put');
  assert.ok(Math.abs(dragPill(u, 'start', 5, 40).duration - .3) < 1e-9, 'never shorter than 0.3 s');
  const shorter = dragPill(u, 'end', -2.5, 40);
  assert.equal(shorter.duration, .5);
  const cross = dragPill(marks[2], 'end', 3, 40);
  assert.deepEqual([cross.start, cross.start + cross.duration], [7.5, 40], 'a cross only moves its start and still lasts to the end');
});

test('mark strip: a mark near the end is pulled inside the strip and gets its own row', async () => {
  const { laneLayout, pillStart, stripMarks } = await import('../src/features/video/MarkTimeline');
  const marks = stripMarks([
    { id: 'e', type: 'reject', targetRegionId: 'option-e', start: 80, duration: 6 },
    { id: 'a', type: 'correct', targetRegionId: 'option-a', start: 85, duration: 1 },
  ] as any);
  const min = 86 * .045;
  assert.ok(Math.abs(pillStart(marks[1], min, 86) - (86 - min)) < 1e-9, 'the last tick ends at the strip end, not past it');
  assert.equal(pillStart(marks[0], min, 86), 80, 'marks with room stay at their start');
  const lanes = laneLayout(marks, min, 86);
  assert.notEqual(lanes.get('e'), lanes.get('a'), 'a pulled-in pill never covers its neighbour');
});

test('picture editing: sides resize one edge; a flat underline stroke becomes the line above it', async () => {
  const { resizeRegion, placeFromStroke, typicalLineHeight } = await import('../src/features/video/PreviewEditOverlay');
  const box = { id: 'b', type: 'keyword', label: '', x: .2, y: .2, width: .2, height: .1 } as any;
  const wider = resizeRegion(box, 'e', .1, .3);
  assert.deepEqual([wider.x, +wider.width.toFixed(2), wider.y, +wider.height.toFixed(2)], [.2, .3, .2, .1], 'the right side moves only the right edge');
  const lower = resizeRegion(box, 's', .3, .05);
  assert.deepEqual([lower.x, +lower.width.toFixed(2), +lower.height.toFixed(2)], [.2, .2, .15], 'the bottom side moves only the bottom edge');
  const fit = { x: 0, y: 0, width: 1000, height: 500 };
  const stroke = { ...box, x: .5, y: .6, width: .2, height: .004 };
  const line = placeFromStroke(stroke, 'underline', fit, .05)!;
  assert.deepEqual([line.x, +line.y.toFixed(3), +(line.y + line.height).toFixed(3)], [.5, .554, .604], 'the words sit just above the stroke');
  assert.equal(placeFromStroke(stroke, 'focus', fit, .05), null, 'a flat stroke is not a frame');
  assert.equal(placeFromStroke({ ...stroke, width: .005 }, 'underline', fit, .05), null, 'a click is not a line');
  assert.equal(typicalLineHeight([{ ...box, content: 'a', height: .04 }, { ...box, content: 'b', height: .06 }, { ...box, content: 'c', height: .05 }]), .05);
});

test('underlines follow the spoken words, drawn over the whole length of the mark', async () => {
  const { underlineSteps } = await import('../src/services/analysis/timelineAligner');
  const { stepProgress, underlineProgress, underlineDrawTime, underlineSpanFor } = await import('../src/features/video/engine/timeline');
  const steps = underlineSteps([{ text: 'ٱلْحَلِيبَ', start: 10, end: 11 }, { text: 'بَارِدٌ', start: 11.5, end: 12 }], 10)!;
  assert.deepEqual(steps.map(s => s.at), [1, 1.5, 2], 'the second word starts after a pause');
  assert.equal(stepProgress(steps, .5), steps[0].to / 2);
  assert.equal(stepProgress(steps, 1.25), steps[0].to, 'the line waits during the pause');
  assert.equal(stepProgress(steps, 2), 1);
  assert.equal(underlineSteps([{ text: 'tek', start: 1, end: 2 }], 1), undefined, 'one word sweeps as before');
  for (const d of [.5, 1, 3, 5, 10]) assert.ok(Math.abs(underlineSpanFor(underlineDrawTime(d)) - d) < 1e-9, `span ↔ draw time at ${d} s`);
  const line = { id: 'u', type: 'underline', targetRegionId: 'p', start: 0, duration: 5 } as any;
  assert.ok(Math.abs(underlineDrawTime(5) - 4.2) < 1e-9, 'a 5 s mark draws for 4.2 s and shows the full line 0.8 s');
  assert.ok(Math.abs(underlineProgress(line, 2.1) - .5) < 1e-9, 'even pace over the mark');
  assert.ok(Math.abs(underlineProgress({ ...line, duration: 1 }, .4) - .5) < 1e-9, 'a 1 s mark draws in 0.8 s');
  const worded = { ...line, duration: underlineSpanFor(2), drawSteps: steps };
  assert.equal(underlineProgress(worded, 1.25), steps[0].to, 'at its natural length the words keep their spoken times');
  assert.equal(underlineProgress({ ...worded, duration: underlineSpanFor(4) }, 2.5), steps[0].to, 'a twice as long mark draws each word twice as slowly');
});

test('Ctrl+V: a copied box sits a little aside, its marks start at the paused moment', async () => {
  const { pastedBox } = await import('../src/features/video/PreviewEditOverlay');
  const box = { id: 'option-b', type: 'option-b', label: 'B', content: 'metin', x: .2, y: .97, width: .3, height: .03 } as any;
  const marks = [
    { id: 'f', type: 'focus', targetRegionId: 'option-b', start: 4, duration: 2 },
    { id: 'x', type: 'reject', targetRegionId: 'option-b', start: 5, duration: 35 },
  ] as any;
  const { region, marks: copied } = pastedBox(box, marks, 'manual-box-9', 20, 40);
  assert.deepEqual([region.id, region.type, region.content, +region.x.toFixed(2), region.y + region.height <= 1], ['manual-box-9', 'keyword', undefined, .22, true]);
  assert.deepEqual(copied.map(m => [m.type, m.targetRegionId, m.start, m.duration]), [['focus', 'manual-box-9', 20, 2], ['reject', 'manual-box-9', 21, 19]]);
  assert.ok(new Set(copied.map(m => m.id)).size === 2 && !copied.some(m => marks.some((o: any) => o.id === m.id)), 'new ids');
});

test('"Burada hata var" on the mark strip picks the mark that just appeared', async () => {
  const { markJustSeen } = await import('../src/features/video/MarkTimeline');
  const marks = [
    { id: 'u', type: 'underline', targetRegionId: 'p', start: 3, duration: 2 },
    { id: 'x', type: 'reject', targetRegionId: 'option-a', start: 6, duration: 30 },
    { id: 'f', type: 'focus', targetRegionId: 'option-b', start: 20, duration: 2 },
  ] as any;
  assert.equal(markJustSeen(marks, 7.5)?.id, 'x', 'the last one before the pause');
  assert.equal(markJustSeen(marks, 5.95)?.id, 'x', 'a mark appearing right at the pause counts');
  assert.equal(markJustSeen(marks, 15), null, 'nothing within the last seconds');
  assert.equal(markJustSeen([{ ...marks[0], duration: 12 }], 14)?.id, 'u', 'an underline still on screen counts');
});
