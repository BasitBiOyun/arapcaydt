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
