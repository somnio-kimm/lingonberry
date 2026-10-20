import {validatePracticeData} from './practice-data.js';
import {EXERCISE_ROUTES,JAPANESE_FORM_KINDS} from '../shared/language-exercises.js';
const fail=message=>{throw new Error(`Invalid language package: ${message}`);};
const check=(condition,message)=>{if(!condition)fail(message);};
const text=(value,name)=>check(typeof value==='string'&&value.trim().length>0&&value.length<=4000,name);
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value);
const list=(value,name)=>check(Array.isArray(value)&&value.length<=10000,name);
export function validateExercises(pack){
 validatePracticeData(pack);
 const entries=new Set(pack.entries.map(row=>row.id)),ids=new Set();
 if(pack.readingPractice!==undefined){const p=pack.readingPractice;check(pack.kind==='study'&&pack.targetLanguage==='ja'&&p?.version===1,'reading practice policy');list(p.excludedSpellings,'reading exclusions');p.excludedSpellings.forEach(value=>text(value,'reading exclusion'));list(p.variants,'reading variants');const seen=new Set();for(const row of p.variants){check(entries.has(row.entryId)&&!seen.has(row.entryId),'reading variant entry');seen.add(row.entryId);check(Array.isArray(row.readings)&&row.readings.length>0&&row.readings.length<=20,'reading variants');row.readings.forEach(value=>check(typeof value==='string'&&/^[ぁ-ゖァ-ヶー]+$/u.test(value),'kana reading variant'));const entry=pack.entries.find(entry=>entry.id===row.entryId);check(row.readings.includes(entry.pronunciation),'primary reading variant');}}
 if(pack.exercises!==undefined){list(pack.exercises,'exercises');for(const row of pack.exercises){
  check(row&&id(row.id)&&!ids.has(row.id),'exercise id');ids.add(row.id);
  if(pack.kind==='explanation'){text(row.instruction,'exercise instruction');text(row.explanation,'exercise explanation');continue;}
  check(entries.has(row.entryId),'exercise entry');check(EXERCISE_ROUTES[pack.targetLanguage]?.[row.category]?.includes(row.route),'exercise route');text(row.prompt,'exercise prompt');text(row.answer,'exercise answer');
  check(row.instruction===undefined&&row.explanation===undefined,'exercise translations belong in explanation packs');
  if(row.acceptedAnswers!==undefined){check(Array.isArray(row.acceptedAnswers)&&row.acceptedAnswers.length<=20,'accepted exercise answers');row.acceptedAnswers.forEach(value=>text(value,'accepted exercise answer'));}
  if(row.options!==undefined){check(Array.isArray(row.options)&&row.options.length>=2&&row.options.length<=6&&new Set(row.options).size===row.options.length&&row.options.includes(row.answer),'exercise options');row.options.forEach(value=>text(value,'exercise option'));}
  if(row.formKind!==undefined)check(pack.targetLanguage==='ja'&&row.route==='forms'&&Object.hasOwn(JAPANESE_FORM_KINDS,row.formKind),'Japanese form kind');
  check(row.route!=='vocabmeaning'||!!row.options,'vocabulary choice options');check(row.route!=='vocabinput'||!row.options,'vocabulary typing options');
  if(row.segments!==undefined){check(Array.isArray(row.segments)&&row.segments.length>0&&row.segments.length<=30,'reading segments');for(const segment of row.segments){text(segment.text,'segment text');text(segment.reading,'segment reading');check(['kanji','kana'].includes(segment.kind),'segment kind');}const word=pack.entries.find(entry=>entry.id===row.entryId);check(row.segments.map(s=>s.text).join('')===word.word,'segment spelling');check(row.segments.map(s=>s.reading).join('')===word.pronunciation,'segment reading alignment');}
 }}
 const families=new Set();if(pack.families!==undefined){list(pack.families,'root families');check(pack.targetLanguage==='en','root family language');for(const family of pack.families){check(family&&id(family.id)&&!families.has(family.id),'family id');families.add(family.id);if(pack.kind==='explanation'){text(family.meaning,'root meaning');}else{text(family.root,'root');check(family.meaning===undefined,'root translation belongs in explanation pack');}check(Array.isArray(family.members)&&family.members.length>0&&family.members.length<=30,'root members');const members=new Set();for(const member of family.members){check(entries.has(member.entryId)&&!members.has(member.entryId),'root entry');members.add(member.entryId);if(pack.kind==='explanation')text(member.note,'root note');else{text(member.word,'root word');text(member.parts,'root parts');check(member.note===undefined,'root note belongs in explanation pack');}}}}
}
export function validateExerciseTranslations(study,pair){
 for(const key of ['exercises','families']){
  const rows=study[key]||[],translated=new Map((pair[key]||[]).map(row=>[row.id,row]));check(rows.length===translated.size,`incomplete ${key} translations`);
  for(const row of rows){const translation=translated.get(row.id);check(!!translation,`missing ${key} translation`);if(key==='families'){check(row.members.length===translation.members.length&&row.members.every(member=>translation.members.some(item=>item.entryId===member.entryId)),'root member translations');}}
 }
}
export function assembleExercises(study,pair){
 const translations=new Map((pair.exercises||[]).map(row=>[row.id,row])),families=new Map((pair.families||[]).map(row=>[row.id,row]));
 return {exercises:(study.exercises||[]).map(row=>({...row,...translations.get(row.id)})),families:(study.families||[]).map(row=>({...row,meaning:families.get(row.id).meaning,members:row.members.map(member=>({...member,note:families.get(row.id).members.find(item=>item.entryId===member.entryId).note}))}))};
}
