import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missingMarkerCrops} from '../src/services/ocr/markerRecovery';
import {detectYdtQuestionRegions} from '../src/services/ocr/ydtQuestionDetector';
import fixture from './fixtures/soru4-ocr.json';
test('Soru 4: recovery scans the missing D label without inventing a box',()=>{
 const crops=missingMarkerCrops(fixture.optionMarkers,1920,1080);
 assert.equal(crops.length,1);assert.equal(crops[0].letter,'D');
 const r=crops[0].rectangle;assert.ok(r.left<=1008&&r.left+r.width>=1044&&r.top<=616&&r.top+r.height>=652);
 assert.equal(detectYdtQuestionRegions(fixture).detectedOptions.includes('D'),false);
 const marker={text:'D)',confidence:89,x:1008/1920,y:616/1080,width:50/1920,height:36/1080,pixelX:1008,pixelY:616,pixelWidth:50,pixelHeight:36};
 const result=detectYdtQuestionRegions({...fixture,optionMarkers:[...fixture.optionMarkers,marker]});
 assert.deepEqual(result.detectedOptions,['A','B','C','D','E']);
 const d=result.regions.find(r=>r.id==='option-d')!;
 assert.ok(d.x>.50&&d.x+d.width<.64);assert.ok(d.y>.54&&d.y+d.height<.64);
 assert.deepEqual(missingMarkerCrops(fixture.optionMarkers.slice(0,2),1920,1080),[]);
});
