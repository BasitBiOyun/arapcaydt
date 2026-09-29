import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFitRect, regionCanvasRect, markerGeometry } from '../src/features/video/engine/renderer';
import { computeTimelineVisualState } from '../src/features/video/engine/timeline';
import { exportDimensions, videoExporter } from '../src/features/video/engine/exporter';
import type { VideoAction } from '../src/types';

test('1080p slide stays pixel aligned without a replacement header or inset', () => {
  assert.deepEqual(calculateFitRect(1920,1080,1920,1080), {x:0,y:0,width:1920,height:1080});
});
test('portrait sources keep aspect ratio and normalized overlays use the image rectangle', () => {
  const fit=calculateFitRect(1000,2000,1920,1080);
  assert.deepEqual(fit,{x:690,y:0,width:540,height:1080});
  assert.deepEqual(regionCanvasRect({id:'x',type:'option',label:'A',x:.1,y:.5,width:.2,height:.1},fit),
    {x:744,y:540,width:108,height:108});
});
test('cross sits outside the text and vertically centered; correct tick uses the right side',()=>{
  const rect={x:498,y:549,width:204,height:71};
  const cross=markerGeometry(rect,1920), tick=markerGeometry(rect,1920,1,true);
  assert.ok(cross.x+cross.radius<rect.x);
  assert.ok(tick.x-tick.radius>rect.x+rect.width);
  assert.equal(cross.y,rect.y+rect.height/2);
  assert.equal(tick.y,cross.y);
});
test('markers at image edges use available whitespace',()=>{
  const rect={x:0,y:500,width:200,height:70};
  const cross=markerGeometry(rect,1920);
  assert.ok(cross.x-cross.radius>rect.width);
  const edge=markerGeometry({x:1720,y:500,width:200,height:70},1920,1,true);
  assert.ok(edge.x+edge.radius<1720);
});
test('seeking backwards removes future marks and correct overrides earlier reject',()=>{
  const actions:VideoAction[]=[
    {id:'r',type:'reject',targetRegionId:'a',start:10,duration:90},
    {id:'c',type:'correct',targetRegionId:'a',start:20,duration:80},
  ];
  assert.deepEqual(computeTimelineVisualState(9,actions).rejectedRegions,{});
  assert.ok(computeTimelineVisualState(15,actions).rejectedRegions.a);
  const end=computeTimelineVisualState(25,actions);
  assert.ok(end.correctRegions.a);assert.equal(end.rejectedRegions.a,undefined);
  assert.deepEqual(computeTimelineVisualState(0,actions).correctRegions,{});
});
test('export honors portrait and 720p dimensions',()=>{
  assert.deepEqual(exportDimensions({resolution:'1080p',aspectRatio:'9:16',fps:30,format:'mp4'}),{width:1080,height:1920});
  assert.deepEqual(exportDimensions({resolution:'720p',aspectRatio:'16:9',fps:30,format:'mp4'}),{width:1280,height:720});
});
test('unsupported export fails explicitly instead of saving WebM with an MP4 extension',async()=>{
  await assert.rejects(videoExporter.exportVideo(()=>{},undefined,5,
    {resolution:'1080p',aspectRatio:'16:9',fps:30,format:'webm'},()=>{}),/MP4/);
});

test('marks never land on a neighbouring option (five options in one row)',()=>{
  const a={x:500,y:480,width:150,height:60}, b={x:672,y:480,width:150,height:60};
  const tick=markerGeometry(a,1920,1,true,undefined,[b]);
  assert.ok(tick.x+tick.radius*1.35<=b.x || tick.x-tick.radius*1.35>=b.x+b.width || tick.y+tick.radius<=b.y);
  assert.ok(tick.x<a.x, 'no room on the right, so the check moves to the free left side');
  const cross=markerGeometry(b,1920,1,false,undefined,[a]);
  assert.ok(cross.x>b.x+b.width, 'no room on the left, so the cross moves right');
});
test('X / check glyphs are drawn once: no drop-shadow offset leaks into the white strokes',async()=>{
  const {renderQuestionVideoFrame}=await import('../src/features/video/engine/renderer');
  const state:Record<string,unknown>={};const leaks:string[]=[];
  const ctx:any=new Proxy(state,{get:(t,k)=>k in t?t[k as string]:k==='measureText'?()=>({width:10}):k==='stroke'?()=>{
      if(t.strokeStyle==='#FFFFFF'&&t.shadowColor!=='transparent'&&((t.shadowOffsetY as number)||(t.shadowOffsetX as number)))leaks.push(String(t.shadowOffsetY));
    }:()=>{},set:(t,k,v)=>{t[k as string]=v;return true;}});
  const regions=[{id:'option-a',type:'option-a',label:'A',x:.3,y:.4,width:.1,height:.06},{id:'option-b',type:'option-b',label:'B',x:.3,y:.5,width:.1,height:.06}] as any;
  const actions:VideoAction[]=[{id:'r',type:'reject',targetRegionId:'option-a',start:0,duration:9},{id:'c',type:'correct',targetRegionId:'option-b',start:0,duration:9}];
  renderQuestionVideoFrame(ctx,1920,1080,null,regions,actions,2,{width:1920,height:1080,aspectRatio:'16:9'});
  assert.deepEqual(leaks,[]);
});
test('the slide is never zoomed: long questions stay whole while an option is examined',async()=>{
  const {renderQuestionVideoFrame}=await import('../src/features/video/engine/renderer');
  const scales:number[]=[];
  const ctx:any=new Proxy({} as Record<string,unknown>,{get:(t,k)=>k in t?t[k as string]:k==='measureText'?()=>({width:10}):k==='scale'?(x:number)=>scales.push(x):()=>{},set:(t,k,v)=>{t[k as string]=v;return true;}});
  const opt=(l:string,y:number)=>({id:`option-${l}`,type:`option-${l}`,label:l,x:.26,y,width:.35,height:.08}) as any;
  const regions=[opt('a',.4),opt('b',.5),opt('c',.6)];
  const actions:VideoAction[]=[{id:'f',type:'focus',targetRegionId:'option-c',start:4,duration:3}];
  for(const time of [4.2,5.5,6.5]) renderQuestionVideoFrame(ctx,1920,1080,null,regions,actions,time,{width:1920,height:1080,aspectRatio:'16:9',duration:10});
  assert.deepEqual(scales.filter(x=>x>1),[]);
});
test('closing frame restates the checked answer only after the narration ends',async()=>{
  const {renderQuestionVideoFrame,outroSeconds}=await import('../src/features/video/engine/renderer');
  const texts:string[]=[];
  const ctx:any=new Proxy({} as Record<string,unknown>,{get:(t,k)=>k in t?t[k as string]:k==='measureText'?()=>({width:10}):k==='fillText'?(s:string)=>texts.push(s):()=>{},set:(t,k,v)=>{t[k as string]=v;return true;}});
  const regions=[{id:'option-c',type:'option-c',label:'C',x:.3,y:.5,width:.1,height:.06}] as any;
  const actions:VideoAction[]=[{id:'c',type:'correct',targetRegionId:'option-c',start:8,duration:2}];
  const opts={width:1920,height:1080,aspectRatio:'16:9' as const,duration:10};
  assert.equal(outroSeconds(actions),2.5);assert.equal(outroSeconds([]),0);assert.equal(outroSeconds(actions,false),0);
  renderQuestionVideoFrame(ctx,1920,1080,null,regions,actions,9.9,opts);
  assert.ok(!texts.includes('Doğru cevap: C'));
  renderQuestionVideoFrame(ctx,1920,1080,null,regions,actions,11,opts);
  assert.ok(texts.includes('Doğru cevap: C'));
});
test('"Doğru cevap" label never covers the question stem',async()=>{
  const {renderQuestionVideoFrame}=await import('../src/features/video/engine/renderer');
  const draw=(regions:any[])=>{const texts:string[]=[];
    const ctx:any=new Proxy({} as Record<string,unknown>,{get:(t,k)=>k in t?t[k as string]:k==='measureText'?()=>({width:120}):k==='fillText'?(s:string)=>texts.push(s):()=>{},set:(t,k,v)=>{t[k as string]=v;return true;}});
    renderQuestionVideoFrame(ctx,1920,1080,null,regions,[{id:'c',type:'correct',targetRegionId:'option-a',start:0,duration:9}],3,{width:1920,height:1080,aspectRatio:'16:9'});
    return texts;};
  const option={id:'option-a',type:'option-a',label:'A',x:.27,y:.4,width:.35,height:.08};
  assert.ok(draw([option]).includes('Doğru cevap'));
  assert.ok(!draw([option,{id:'question-root',type:'paragraph',label:'k',x:.44,y:.38,width:.33,height:.06}]).includes('Doğru cevap'));
});
test('MP4 tracks only take increasing timestamps (a packet one frame early is dropped, not fatal)',async()=>{
  const {monotonicGate}=await import('../src/features/video/engine/exporter');
  const gate=monotonicGate();
  // The macOS AAC encoder after a restart: 2 773 333 µs, then one frame back to 2 752 000 µs.
  assert.deepEqual([2730667,2752000,2773333,2752000,2773333,2794667].map(gate),[true,true,true,false,false,true]);
});

test('captions get their own strip: a tall question never lies under the caption', async () => {
  const { captionStrip, imageFitRect, calculateFitRect } = await import('../src/features/video/engine/renderer');
  const captions = [{ text: 'Doğru cevap E şıkkıdır.', start: 0, end: 2 }];
  const tall = { w: 1000, h: 1400 };
  const bottom = captionStrip({ captions, captionY: .85 }, 1080)!;
  assert.equal(bottom.edge, 'bottom');
  const optionE = { id: 'option-e', type: 'option-e', label: 'E', x: .1, y: .9, width: .8, height: .08 } as any;
  const optionA = { id: 'option-a', type: 'option-a', label: 'A', x: .1, y: .05, width: .8, height: .08 } as any;
  const fit = imageFitRect(tall.w, tall.h, 1920, 1080, bottom, [optionE]);
  assert.ok(fit.y + fit.height <= 1080 - bottom.size + .5, 'option E ends above the caption strip');
  // Nothing marked lies under the strip (option E ends higher): the question keeps its full size.
  const roomy = { ...optionE, y: .7 };
  assert.deepEqual(imageFitRect(tall.w, tall.h, 1920, 1080, bottom, [roomy, { id: 'question-root', type: 'paragraph', label: '', x: 0, y: 0, width: 1, height: 1 } as any]),
    calculateFitRect(tall.w, tall.h, 1920, 1080));
  const top = imageFitRect(tall.w, tall.h, 1920, 1080, captionStrip({ captions, captionY: .15 }, 1080), [optionA]);
  assert.ok(top.y >= bottom.size - .5, 'a caption at the top pushes the question down');
  // A wide slide that already leaves room only moves up; it does not shrink.
  const wide = imageFitRect(1920, 700, 1920, 1080, bottom, [{ ...optionE, y: .95, height: .04 }]);
  assert.equal(Math.round(wide.width), 1920);
  assert.ok(wide.y + wide.height <= 1080 - bottom.size + .5);
  // No captions, captions off, or a caption placed mid-screen: the image uses the whole frame as before.
  assert.equal(captionStrip({ captions: [], captionY: .85 }, 1080), null);
  assert.equal(captionStrip({ captions, showCaptions: false }, 1080), null);
  assert.equal(captionStrip({ captions, captionY: .5 }, 1080), null);
  assert.deepEqual(imageFitRect(tall.w, tall.h, 1920, 1080, null), calculateFitRect(tall.w, tall.h, 1920, 1080));
  // The teacher's own size wins and stays clear of the strip.
  const own = imageFitRect(tall.w, tall.h, 1920, 1080, bottom, [], .8);
  assert.equal(Math.round(own.height), 864);
  assert.ok(own.y + own.height <= 1080 - bottom.size + .5);
  assert.equal(Math.round(own.x + own.width / 2), 960);
});

test('underlines sit right under their words and move with the teacher’s nudges', async () => {
  const { underlineY } = await import('../src/features/video/engine/renderer');
  const line = { x: 100, y: 200, width: 400, height: 50 };
  assert.equal(underlineY(line, 1), 252, 'two pixels under the box, no longer a line-height gap');
  assert.equal(underlineY(line, 1, -.2), 242);
  assert.equal(underlineY(line, 1, .3), 267);
});
