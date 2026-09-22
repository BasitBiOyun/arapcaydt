import {OCRWord} from './ocrTypes';

/** Crop only after three actual labels establish a two-column grid.
 * The crop is a search area, never an accepted annotation: OCR must read the
 * expected letter inside it before the detector receives a new marker. */
export function missingMarkerCrops(markers:OCRWord[],width:number,height:number){
  const byLetter=new Map(markers.map(w=>[w.text.replace(/[^A-E]/g,''),w]));
  const patterns=[['A','C','B','D'],['B','D','A','C'],['C','A','D','B'],['D','B','C','A']];
  return patterns.flatMap(([letter,columnLetter,rowLetter,cornerLetter])=>{
    if(byLetter.has(letter))return [];
    const column=byLetter.get(columnLetter),row=byLetter.get(rowLetter),corner=byLetter.get(cornerLetter);
    if(!column||!row||!corner)return [];
    if(Math.abs(column.y-corner.y)>.025||Math.abs(row.x-corner.x)>.035||Math.abs(column.x-row.x)<.12||Math.abs(column.y-row.y)<.04)return [];
    const left=Math.max(0,Math.floor(column.pixelX-width*.008));
    const top=Math.max(0,Math.floor(row.pixelY-height*.015));
    return [{letter,rectangle:{left,top,width:Math.min(width-left,Math.ceil(column.pixelWidth+width*.016)),height:Math.min(height-top,Math.ceil(row.pixelHeight+height*.03))}}];
  });
}
