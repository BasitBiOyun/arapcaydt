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
test('camera pushes in only on long questions, eases in, and never shows past the slide',async()=>{
  const {cameraAt,isLongQuestion}=await import('../src/features/video/engine/renderer');
  const fit={x:0,y:0,width:1920,height:1080};
  const opt=(l:string,y:number,w:number)=>({id:`option-${l}`,type:`option-${l}`,label:l,x:.26,y,width:w,height:.08}) as any;
  const long=[opt('a',.4,.35),opt('b',.5,.35),opt('c',.6,.35)];
  const short=[opt('a',.4,.09),opt('b',.5,.09),{id:'question-root',type:'paragraph',label:'k',x:.4,y:.3,width:.3,height:.07} as any];
  const actions:VideoAction[]=[{id:'f',type:'focus',targetRegionId:'option-c',start:4,duration:3}];
  assert.ok(isLongQuestion(long));assert.ok(!isLongQuestion(short));
  assert.equal(cameraAt(6,actions,short,fit,1920,1080).zoom,1);
  assert.equal(cameraAt(3,actions,long,fit,1920,1080).zoom,1);
  const easing=cameraAt(4.2,actions,long,fit,1920,1080), settled=cameraAt(5.5,actions,long,fit,1920,1080);
  assert.ok(easing.zoom>1&&easing.zoom<settled.zoom,'zoom ramps in');
  assert.ok(settled.zoom<=1.22);
  const hx=1920/(2*settled.zoom);assert.ok(settled.cx>=hx&&settled.cx<=1920-hx);
  assert.equal(cameraAt(8,actions,long,fit,1920,1080).zoom,1,'returns to the full slide after the focus');
  assert.deepEqual(cameraAt(5,actions,long,fit,1920,1080),cameraAt(5,actions,long,fit,1920,1080));
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
