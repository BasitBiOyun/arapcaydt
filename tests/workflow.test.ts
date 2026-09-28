import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSaveQueue} from '../src/features/projects/saveQueue';
import {checkNarration,moveRegion,resumeStep,shiftAction} from '../src/features/question-editor/workflow';
import type {QuestionProject,VideoAction,AnnotationRegion} from '../src/types';

test('saves remain ordered and identical pending revisions share one request',async()=>{
 let release!:()=>void;const barrier=new Promise<void>(r=>release=r);const written:number[]=[];
 const queue=createSaveQueue<{revision:number}>(async value=>{if(value.revision===1)await barrier;written.push(value.revision);return value;});
 const first={revision:1},second={revision:2};const a=queue(first),duplicate=queue(first),b=queue(second);
 assert.equal(a,duplicate);await Promise.resolve();assert.deepEqual(written,[]);
 release();await Promise.all([a,b]);assert.deepEqual(written,[1,2]);
});
test('a failed save does not block subsequent edits',async()=>{
 const queue=createSaveQueue<number>(async value=>{if(value===1)throw new Error('offline');return value;});
 const failed=queue(1),next=queue(2);await assert.rejects(failed,/offline/);assert.equal(await next,2);
});
test('resume requires each prerequisite and respects revoked audio approval',()=>{
 const p={imageUrl:'',solutionText:'',videoReady:false,audioApproved:false} as QuestionProject;
 assert.equal(resumeStep(p),0);p.imageUrl='image';assert.equal(resumeStep(p),1);
 p.solutionText='çözüm';assert.equal(resumeStep(p),2);p.audioApproved=true;assert.equal(resumeStep(p),3);
 p.videoReady=true;assert.equal(resumeStep(p),4);p.audioApproved=false;assert.equal(resumeStep(p),2);
});
test('timing nudges never move outside the audio and update both clocks',()=>{
 const action={id:'a',type:'underline',start:.1,startTime:.1,duration:2} as VideoAction;
 const early=shiftAction(action,-.2,10);assert.equal(early.start,0);assert.equal(early.startTime,0);
 const late=shiftAction(action,20,10);assert.equal(late.start,9.95);assert.ok(late.start+late.duration<=10.00001);
});
test('keyboard nudges keep the whole annotation inside the image',()=>{
 const r={id:'a',x:.9,y:.9,width:.1,height:.1} as AnnotationRegion;
 const moved=moveRegion(r,.01,.01);assert.equal(moved.x,.9);assert.equal(moved.y,.9);assert.equal(moved.manuallyAdjusted,true);
 assert.equal(moveRegion(r,-2,-2).x,0);
});
test('narration preflight finds omitted options',()=>{
 const result=checkNarration('A şıkkı kullanım demektir. B şıkkı seçim demektir.','A');
 assert.ok(result.missing.includes('C'));assert.ok(result.missing.includes('E'));
 assert.equal(result.missing.includes('A'),false);
});

test('keyboard navigation jumps to the next and previous cue from the playhead', async () => {
  const { adjacentAction, isTypingTarget } = await import('../src/features/question-editor/workflow');
  const actions = [5, 1, 9].map((start, i) => ({ id: `a${i}`, type: 'focus', targetRegionId: 'x', start, duration: 1 })) as any;
  assert.equal(adjacentAction(actions, 1, 1)?.start, 5, 'the cue under the playhead is skipped');
  assert.equal(adjacentAction(actions, 5, -1)?.start, 1);
  assert.equal(adjacentAction(actions, 9, 1), undefined);
  assert.equal(adjacentAction(actions, 0, -1), undefined);
  assert.ok(isTypingTarget({ tagName: 'TEXTAREA' } as any));
  assert.ok(!isTypingTarget({ tagName: 'CANVAS' } as any));
});

test('simple timing list: nudging keeps ✗/✓ marks to the end and other cues their length', async () => {
  const { nudgeAction } = await import('../src/features/question-editor/workflow');
  const mark = { id: 'm', type: 'reject' as const, targetRegionId: 'option-c', start: 10, duration: 20 };
  const earlier = nudgeAction(mark, -0.3, 30);
  assert.equal(earlier.start, 9.7);
  assert.ok(Math.abs(earlier.start + earlier.duration - 30) < 1e-9, 'still visible until the end');
  const later = nudgeAction(mark, 0.3, 30);
  assert.ok(Math.abs(later.start + later.duration - 30) < 1e-9);
  const underline = { id: 'u', type: 'underline' as const, targetRegionId: 'arabic-1', start: 4, duration: 1.2 };
  assert.deepEqual([nudgeAction(underline, 0.3, 30).start, nudgeAction(underline, 0.3, 30).duration], [4.3, 1.2]);
  assert.equal(nudgeAction(underline, -9, 30).start, 0, 'never before the start');
  assert.ok(nudgeAction(underline, 99, 30).start <= 29.9, 'never past the end');
  assert.equal(nudgeAction(mark, 0.3, 30).startTime, 10.3);
});

test('simple timing list shows the marks a teacher hears, in order, with plain titles', async () => {
  const { listedCues, cueTitle } = await import('../src/features/question-editor/SimpleTimingList');
  const actions = [
    { id: '3', type: 'correct' as const, targetRegionId: 'option-d', start: 20, duration: 5, label: 'correct: doğru cevap D' },
    { id: '1', type: 'focus' as const, targetRegionId: 'option-a', start: 2, duration: 3 },
    { id: 'x', type: 'dim-others' as const, targetRegionId: 'option-a', start: 2, duration: 3 },
    { id: '2', type: 'reject' as const, targetRegionId: 'option-a', start: 5, duration: 20 },
    { id: '4', type: 'underline' as const, targetRegionId: 'ar-1', start: 1, duration: 1 },
  ];
  const regions = [{ id: 'ar-1', label: 'Arapça', type: 'custom' as const, content: 'ذَهَبَ الطَّالِبُ', x: 0, y: 0, width: .1, height: .1 }];
  const cues = listedCues(actions);
  assert.deepEqual(cues.map(c => c.id), ['4', '1', '2', '3']);
  assert.deepEqual(cues.map(c => cueTitle(c, regions as any)),
    ['Altı çizilir: ذَهَبَ الطَّالِبُ', 'Odak: A şıkkı', 'A şıkkı elenir', 'D şıkkı: doğru cevap']);  const { cueSummary } = await import('../src/features/question-editor/SimpleTimingList');
  assert.equal(cueSummary(cues), '1 şık elenir · 1 doğru cevap · 2 vurgu', 'the closed list still says what will happen');
  assert.equal(cueSummary([]), '');
});

test('player and marks list share one time format', async () => {
  const { clock } = await import('../src/features/question-editor/workflow');
  assert.equal(clock(0), '00:00,0');
  assert.equal(clock(39.24), '00:39,2');
  assert.equal(clock(65.35), '01:05,4');
  assert.equal(clock(59.97), '01:00,0', 'rounding carries into the minute');
});
