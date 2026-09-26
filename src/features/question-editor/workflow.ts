import type {QuestionProject,VideoAction,AnnotationRegion} from '../../types';
import {parseSolutionSemantics} from '../../services/analysis/solutionParser';
export const steps=['Soru','Metin','Ses','İşaretler','İndir'];
export function resumeStep(p:QuestionProject) {
  if(!p.imageUrl)return 0;
  if(!p.solutionText.trim())return 1;
  if(!(p.audioApproved||p.narrationSource?.isApproved||p.audioNarration?.isApproved))return 2;
  if(!p.videoReady)return 3;
  return 4;
}
export function checkNarration(text:string,answer:string) {
  const options=['A','B','C','D','E'];
  const regions=options.map(l=>({id:`option-${l.toLowerCase()}`,type:'option',label:l,x:0,y:0,width:.1,height:.1} as AnnotationRegion));
  const parsed=parseSolutionSemantics(text,regions);
  return {
    characters:text.trim().length,
    missing:options.filter(l=>!parsed.events.some(e=>e.targetOptionLetter===l)),
    mismatch:parsed.deducedCorrectAnswer && parsed.deducedCorrectAnswer!==answer ? parsed.deducedCorrectAnswer : undefined,
  };
}
export function shiftAction(action:VideoAction,delta:number,duration:number):VideoAction {
  const start=Math.max(0,Math.min(Math.max(0,duration-.05),action.start+delta));
  return {...action,start,startTime:start,duration:Math.max(.05,Math.min(action.duration,duration-start))};
}
export function moveRegion(region:AnnotationRegion,dx:number,dy:number):AnnotationRegion {
  return {...region,x:Math.max(0,Math.min(1-region.width,region.x+dx)),y:Math.max(0,Math.min(1-region.height,region.y+dy)),manuallyAdjusted:true};
}

/** Next/previous animation cue from the playhead (keyboard navigation in the timing editor). */
export function adjacentAction(actions:VideoAction[],time:number,direction:1|-1):VideoAction|undefined {
  const sorted=[...actions].sort((a,b)=>a.start-b.start);
  return direction>0?sorted.find(a=>a.start>time+.05):[...sorted].reverse().find(a=>a.start<time-.05);
}
/** Keys typed into a form field never drive the player. */
export function isTypingTarget(target:EventTarget|null):boolean {
  const el=target as HTMLElement|null;
  return !!el&&(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable===true);
}
