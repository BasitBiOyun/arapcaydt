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
