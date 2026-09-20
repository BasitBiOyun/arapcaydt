import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRegionEdits } from '../src/services/analysis/regionEdits';
import type { AnnotationRegion, VideoConfig } from '../src/types';
const region = (id:string, content = ''):AnnotationRegion => ({id,type:id.startsWith('option-') ? id as any : 'keyword',label:id,content,x:.2,y:.4,width:.1,height:.05});
const base:VideoConfig={aspectRatio:'16:9',fps:30,backgroundColor:'#fff',showWatermark:false,annotations:[],regions:[region('option-a')],timelineActions:[{id:'keep',type:'focus',targetRegionId:'option-a',start:2,duration:3}]};
const text='A şıkkı. Olmaz. B şıkkı. Doğru cevap B. مُمَيِّزَاتٌ';
const words=[{text:'A',start:0,end:1},{text:'şıkkı.',start:1,end:2},{text:'Olmaz.',start:2,end:3},{text:'B',start:4,end:5},{text:'şıkkı.',start:5,end:6},{text:'Doğru',start:6,end:7},{text:'cevap',start:7,end:8},{text:'B.',start:8,end:9},{text:'مُمَيِّزَاتٌ',start:10,end:11}];
test('new manual option immediately gets focus/check from narration and retains other timings',()=>{
 const next=applyRegionEdits(base,[...base.regions!,region('option-b')],text,words,12);
 assert.ok(next.timelineActions!.some(a=>a.targetRegionId==='option-b' && a.type==='correct'));
 assert.ok(next.timelineActions!.some(a=>a.id==='keep' && a.start===2));
 assert.ok(next.regions!.find(r=>r.id==='option-b')!.manuallyAdjusted);
});
test('selected phrase creates timed highlight and underline; deletion removes actions and persists suppression',()=>{
 const next=applyRegionEdits(base,[...base.regions!,region('manual-phrase','مُمَيِّزَاتٌ')],text,words,12);
 const marks=next.timelineActions!.filter(a=>a.targetRegionId==='manual-phrase');
 assert.deepEqual(marks.map(a=>a.type).sort(),['highlight','underline']);
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
   assert.ok(result.actions.some(a=>a.targetRegionId==='manual-phrase' && a.type==='highlight' && a.start>=9.5));
 } finally {localOcrService.recognize=original;}
});

test('missing visual B does not apply its rejection to the preceding A', async()=>{
 const {parseSolutionSemantics}=await import('../src/services/analysis/solutionParser');
 const result=parseSolutionSemantics('A şıkkı. B şıkkı. Olmaz.',[region('option-a')]);
 assert.ok(!result.events.some(e=>e.actionType==='reject'));
});
