import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missingMarkerCrops} from '../src/services/ocr/markerRecovery';
import {detectYdtQuestionRegions} from '../src/services/ocr/ydtQuestionDetector';
import fixture from './fixtures/soru4-ocr.json';
test('Soru 4: missing D label is recovered from its option text and matches the OCR-read box',()=>{
 const crops=missingMarkerCrops(fixture.optionMarkers,1920,1080);
 assert.equal(crops.length,1);assert.equal(crops[0].letter,'D');
 const r=crops[0].rectangle;assert.ok(r.left<=1008&&r.left+r.width>=1044&&r.top<=616&&r.top+r.height>=652);
 // The unread D is placed on the A B / C D / E lattice only because its option text exists there;
 // it must match the box a real OCR read of "D)" produces.
 const inferred=detectYdtQuestionRegions(fixture).regions.find(r=>r.id==='option-d')!;
 assert.ok(inferred.x>.50&&inferred.x+inferred.width<.64&&inferred.y>.54&&inferred.y+inferred.height<.64);
 const marker={text:'D)',confidence:89,x:1008/1920,y:616/1080,width:50/1920,height:36/1080,pixelX:1008,pixelY:616,pixelWidth:50,pixelHeight:36};
 const result=detectYdtQuestionRegions({...fixture,optionMarkers:[...fixture.optionMarkers,marker]});
 assert.deepEqual(result.detectedOptions,['A','B','C','D','E']);
 const d=result.regions.find(r=>r.id==='option-d')!;
 assert.ok(d.x>.50&&d.x+d.width<.64);assert.ok(d.y>.54&&d.y+d.height<.64);
 assert.deepEqual(missingMarkerCrops(fixture.optionMarkers.slice(0,2),1920,1080),[]);
});
