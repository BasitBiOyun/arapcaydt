import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRegionEdits } from '../src/services/analysis/regionEdits';
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
  assert.ok(both[1].duration > 0 && both[1].drawDuration === .6);
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
  assert.equal(shorter.duration, .5); assert.ok(shorter.drawDuration! <= .3 + 1e-9, 'drawn within its time');
  const cross = dragPill(marks[2], 'end', 3, 40);
  assert.deepEqual([cross.start, cross.start + cross.duration], [7.5, 40], 'a cross only moves its start and still lasts to the end');
});
