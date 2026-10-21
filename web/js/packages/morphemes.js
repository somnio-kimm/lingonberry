/** Reference inventory is independent of the study-word list and scored family questions. */
const fail=message=>{throw new Error(`Invalid language package: morphemes ${message}`);};
const check=(value,message)=>{if(!value)fail(message);};
const text=(value,max=4000)=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const identifier=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(value);
export const readableMorpheme=value=>typeof value==='string'&&/^-?[A-Za-z]+(?:[-'][A-Za-z]+)*-?$/u.test(value)&&value.length<=100;
export function validateMorphemes(pack){
 if(pack.morphemes===undefined)return;
 check(pack.targetLanguage==='en'&&Array.isArray(pack.morphemes)&&pack.morphemes.length<=20000,'inventory');
 const ids=new Set(),senses=new Set();
 for(const row of pack.morphemes){
  check(row&&identifier(row.id)&&!ids.has(row.id),'id');ids.add(row.id);
  const allowed=pack.kind==='study'?['id','form','variants','kind','origin','examples','senses','source']:['id','senses'];
  check(Object.keys(row).every(key=>allowed.includes(key)),'fields');
  check(Array.isArray(row.senses)&&row.senses.length>0&&row.senses.length<=100,'senses');
  for(const sense of row.senses){check(identifier(sense.id)&&!senses.has(sense.id),'sense id');senses.add(sense.id);
   check(Object.keys(sense).every(key=>(pack.kind==='study'?['id','tags']:['id','meaning']).includes(key)),'sense fields');
   if(pack.kind==='explanation')check(text(sense.meaning),'meaning');
   else if(sense.tags!==undefined)check(Array.isArray(sense.tags)&&sense.tags.length<=100&&sense.tags.every(tag=>text(tag,200)),'tags');
  }
  if(pack.kind==='explanation')continue;
  check(readableMorpheme(row.form),'readable form');
  check(Array.isArray(row.variants)&&row.variants.length<=100&&row.variants.every(readableMorpheme),'variants');
  check(['root','prefix','suffix','infix','interfix','circumfix','affix'].includes(row.kind),'kind');
  check(text(row.origin,100)&&/^[A-Za-z ,/()-]+$/u.test(row.origin),'origin');
  check(Array.isArray(row.examples)&&row.examples.length<=5000&&row.examples.every(value=>text(value,200)),'related words');
  try{const url=new URL(row.source);check(url.protocol==='https:'&&!url.username&&!url.password,'source');}catch{fail('source');}
 }
}
export function validateMorphemeTranslations(core,pair){
 const rows=core.morphemes||[],translated=new Map((pair.morphemes||[]).map(row=>[row.id,row]));
 check(translated.size===rows.length,'translation coverage');
 for(const row of rows){const meanings=new Map((translated.get(row.id)?.senses||[]).map(s=>[s.id,s.meaning]));check(meanings.size===row.senses.length&&row.senses.every(s=>meanings.has(s.id)),'sense coverage');}
}
export function assembleMorphemes(core,pair){
 const translated=new Map((pair.morphemes||[]).flatMap(row=>row.senses.map(s=>[s.id,s.meaning])));
 return (core.morphemes||[]).map(row=>({...row,senses:row.senses.map(s=>({...s,meaning:translated.get(s.id)}))}));
}
