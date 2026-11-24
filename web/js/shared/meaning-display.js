import {escapeHtml} from './ui.js';

const parenthetical=/\([^()（）]*\)|（[^()（）]*）/gu;

/** Display established gloss breaks without treating synonyms or sentence commas as new senses. */
export function meaningDisplayLines(value){
 const lines=new Set();
 for(let gloss of Array.isArray(value)?value:[value]){
  if(typeof gloss!=='string')continue;
  let previous;
  do{
   previous=gloss;
   gloss=gloss.replace(parenthetical,'');
  }while(gloss!==previous);
  for(const line of gloss.split(/[;；\r\n]+/u)){
   const text=line.trim().replace(/^[,，]+\s*|\s*[,，]+$/gu,'').replace(/[^\S\r\n]+/gu,' ').replace(/\s+([,.!?。！？])/gu,'$1');
   if(text)lines.add(text);
  }
 }
 return [...lines];
}

export function renderStudyMeaning(value){
 return meaningDisplayLines(value).map(escapeHtml).join('<br>');
}
