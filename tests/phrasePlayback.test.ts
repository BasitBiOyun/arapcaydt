import test from 'node:test';
import assert from 'node:assert/strict';
import {findBestArabicMatches, findArabicMatchesInOcr} from '../src/services/ocr/arabicMatcher';
import {parseSolutionSemantics} from '../src/services/analysis/solutionParser';
import {alignEventsWithNarration} from '../src/services/analysis/timelineAligner';
import {computeTimelineVisualState} from '../src/features/video/engine/timeline';
import {markerGeometry} from '../src/features/video/engine/renderer';
import {detectYdtQuestionRegions} from '../src/services/ocr/ydtQuestionDetector';
import type {OCRWord} from '../src/services/ocr/ocrTypes';
import type {AnnotationRegion} from '../src/types';
import originalOcr from './fixtures/soru4-ocr.json';
import arabicStem from './fixtures/soru4-arabic-stem.json';
const word=(text:string,x:number,y=.3,height=.05):OCRWord=>({text,x,y,width:.09,height,confidence:90,pixelX:x*1920,pixelY:y*1080,pixelWidth:.09*1920,pixelHeight:height*1080});

test('full reading draws once, the second word once at its first own reading; repeats add no marks',()=>{
 const text='الْقِطَارُ سَرِيعٌ. سَرِيعٌ demektir. سَرِيعٌ ve سَرِيعٌ.';
 const matches=findBestArabicMatches(text,[word('القطار',.7),word('سريع',.59)]);
 const parsed=parseSolutionSemantics(text,matches.map(m=>m.region),matches);
 assert.deepEqual(parsed.events.map(e=>e.semanticTriggerPhrase),['الْقِطَارُ سَرِيعٌ','سَرِيعٌ']);
 const spoken=[{text:'الْقِطَارُ',start:1,end:2},{text:'سَرِيعٌ',start:2,end:3},{text:'سَرِيعٌ',start:5,end:6},{text:'demektir',start:6,end:7},{text:'سَرِيعٌ',start:8,end:9},{text:'ve',start:9,end:10},{text:'سَرِيعٌ',start:10,end:11}];
 const actions=alignEventsWithNarration(parsed.events,spoken,12,text);
 assert.deepEqual(actions.map(a=>Math.round(a.start)),[1,5]);
 const state=computeTimelineVisualState(2,actions);
 assert.equal(state.activeUnderlines.length,1);
 // Word by word: once the first word is said the line has passed under it (6 of 10 letters), not the whole phrase.
 assert.ok(Math.abs(state.activeUnderlines[0].progress-.6)<.01);
 const half=computeTimelineVisualState(2.5,actions).activeUnderlines[0].progress;
 assert.ok(half>.75 && half<.85,'halfway through the second word, halfway under it');
 assert.equal(computeTimelineVisualState(3,actions).activeUnderlines[0].progress,1);
 assert.equal(state.activeHighlights.length,0);
});
test('short Arabic word never matches a longer Arabic word; option gets only a box',()=>{
 const phrase=findArabicMatchesInOcr('سَرِيعَةٌ',[word('سريعة',.55,.5)])[0];
 const option:AnnotationRegion={id:'option-b',type:'option-b',label:'B',x:.5,y:.48,width:.2,height:.1};
 const parsed=parseSolutionSemantics('B şıkkı سَرِيعَةٌ.',[option,phrase.region],[phrase]);
 assert.deepEqual(parsed.events.map(e=>e.actionType),['focus']);
 const short={...phrase,phrase:'سريع',region:{...phrase.region,y:.2}};
 assert.equal(parseSolutionSemantics('سريعة',[short.region],[short]).events.length,0);
});
test('wrapped stem lines start at their own words, not both at the beginning',()=>{
 const text='فِي مَيْدَانِ كُونَاك';
 const matches=findArabicMatchesInOcr(text,[word('في',.5),word('ميدان',.39),word('كوناك',.7,.39)]);
 const parsed=parseSolutionSemantics(text,matches.map(m=>m.region),matches);
 const actions=alignEventsWithNarration(parsed.events,[{text:'فِي',start:0,end:1},{text:'مَيْدَانِ',start:1,end:2},{text:'كُونَاك',start:4,end:5}],6,text);
 assert.deepEqual(actions.map(a=>Math.round(a.start)),[0,4]);
});
test('Arabic-only OCR restores a Latin-misread word, partial matching never swallows the missing word',()=>{
 const primary=[word('القطار',.7),word('434',.59),word('ولكن',.48)];
 const alternative=[word('القطار',.7),word('سريع',.59),word('ولكن',.48)];
 const text='الْقِطَارُ سَرِيعٌ وَلَكِنْ';
 const full=findBestArabicMatches(text,primary,alternative);
 assert.equal(full.length,1);assert.equal(full[0].matchedWords.length,3);
 const partial=findBestArabicMatches(text,primary);
 assert.equal(partial.length,2);assert.ok(partial.every(m=>m.region.width<.11));
});
test('crosses have constant radius and follow Latin label centers despite tall Arabic text',()=>{
 const words=[word('A)',.1,.5,.03),word('سارع',.2,.50,.05),word('C)',.1,.7,.03),word('سرعة',.2,.69,.09)];
 const layout=detectYdtQuestionRegions({words,lines:[],text:'',imageWidth:1920,imageHeight:1080});
 const a=layout.regions.find(r=>r.id==='option-a')!, c=layout.regions.find(r=>r.id==='option-c')!;
 const mark=(r:AnnotationRegion)=>markerGeometry({x:r.x*1920,y:r.y*1080,width:r.width*1920,height:r.height*1080},1920,1,false,r.markerAnchor);
 assert.equal(mark(a).radius,mark(c).radius);
 assert.ok(Math.abs(mark(a).y-(.5+.03/2)*1080)<.01);
 assert.ok(Math.abs(mark(c).y-(.7+.03/2)*1080)<.01);
});
test('short underline ends on time and cannot linger across the next cue',()=>{
 const state=computeTimelineVisualState(.6,[{id:'u',type:'underline',targetRegionId:'word',start:0,duration:.5}]);
 assert.equal(state.activeUnderlines.length,0);
});
test('actual Soru 4 Arabic retry recovers منه and the complete question, including standalone second word',()=>{
 const text='الْقِطَارُ سَرِيعٌ، وَلَكِنَّ الطَّائِرَةَ ---- مِنْهُ بِكَثِيرٍ. سَرِيعٌ hızlı demektir. مِنْهُ ondan demektir.';
 const matches=findBestArabicMatches(text,originalOcr.words,arabicStem);
 const parsed=parseSolutionSemantics(text,matches.map(m=>m.region),matches);
 assert.deepEqual(parsed.events.map(e=>e.semanticTriggerPhrase),['الْقِطَارُ سَرِيعٌ، وَلَكِنَّ الطَّائِرَةَ','مِنْهُ بِكَثِيرٍ','سَرِيعٌ','مِنْهُ']);
});
test('Turkish letter pronunciation spellings retain option targeting and timestamps',()=>{
 const regions=['B','C','D'].map(letter=>({id:`option-${letter.toLowerCase()}`,type:'option',label:letter,x:.1,y:.5,width:.2,height:.1} as AnnotationRegion));
 const text='Be şıkkı. Olmaz. Ce şıkkına bakalım. Olmaz. Doğru cevap De.';
 const words=text.split(' ').map((text,i)=>({text,start:i,end:i+.8}));
 const parsed=parseSolutionSemantics(text,regions);
 assert.equal(parsed.deducedCorrectAnswer,'D');
 assert.equal(parsed.events.find(e=>e.targetOptionLetter==='C')?.semanticTriggerPhrase,'Ce şıkkına');
 const actions=alignEventsWithNarration(parsed.events,words,12,text);
 assert.ok(Math.abs(actions.find(a=>a.type==='focus' && a.targetRegionId==='option-c')!.start-3)<.1);
});
test('a word found twice in the question is underlined inside the quote being explained, never at random',()=>{
 // The stem has كتاب twice: in the quoted sentence (row 1) and elsewhere (row 2).
 const ocr=[word('قرأت',.8,.2),word('كتاب',.7,.2),word('كتاب',.6,.5),word('جديد',.5,.5)];
 const quoted=findBestArabicMatches('قرأت كتاب. كتاب kitap demektir.',ocr);
 const single=quoted.find(m=>m.phrase==='كتاب')!;
 assert.equal(single.region.y<.3,true,'the word inside the underlined sentence');
 assert.deepEqual(findBestArabicMatches('كتاب kitap demektir.',ocr),[],'two places, no quote: left to the teacher');
 assert.equal(findBestArabicMatches('جديد yeni demektir.',ocr).length,1,'one place: drawn');
 assert.deepEqual(findBestArabicMatches('في burada harf-i cerdir.',[word('في',.5,.5)]),[],'a lone particle is not underlined');
});
test('an underline never flashes past: readable draw, a moment on screen, adjustable by the teacher',async()=>{
 const {withLineOffset}=await import('../src/features/video/markLabels');
 const {underlineDrawTime}=await import('../src/features/video/engine/timeline');
 const matches=findBestArabicMatches('كتاب ve قلم.',[word('كتاب',.7),word('قلم',.5)]);
 const parsed=parseSolutionSemantics('كتاب ve قلم.',matches.map(m=>m.region),matches);
 // Spoken quickly: 0.2 s per word, the next underline right after.
 const actions=alignEventsWithNarration(parsed.events,[{text:'كتاب',start:1,end:1.2},{text:'ve',start:1.2,end:1.3},{text:'قلم',start:1.3,end:1.5}],10,'كتاب ve قلم.');
 const first=actions.find(a=>a.type==='underline')!;
 assert.ok(underlineDrawTime(first.duration)>=.6-1e-9,'drawn at a readable pace');
 assert.ok(first.duration>underlineDrawTime(first.duration),'shows a moment once drawn');
 const stay={...first,duration:5};
 // The drawing follows the mark's length: a 5 s mark is half drawn 2.1 s in (draw time 4.2 s).
 assert.ok(Math.abs(computeTimelineVisualState(first.start+2.1,[stay]).activeUnderlines[0].progress-.5)<.01);
 assert.equal(withLineOffset(withLineOffset(first,-.15),-.15).lineOffset,-.3);
 const state=computeTimelineVisualState(first.start+.7,[{...first,lineOffset:-.3}]);
 assert.equal(state.activeUnderlines[0].offset,-.3);
});
