import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';
import {validateExercises,validateExerciseTranslations} from '../../web/js/packages/exercises.js';
import {validateMorphemes,validateMorphemeTranslations} from '../../web/js/packages/morphemes.js';
import {validatePracticeData} from '../../web/js/packages/practice-data.js';
import {isActiveExerciseCategory} from '../../web/js/shared/language-exercises.js';

const copy=value=>structuredClone(value);
const text=value=>typeof value==='string'&&!!value.trim();
const key=value=>value.normalize('NFKC').toLocaleLowerCase('en').replace(/[‘’]/gu,"'");
const index=(rows,name)=>{
 const result=new Map();
 for(const row of rows||[]){
  if(!text(row?.id)||result.has(row.id))throw new Error('Duplicate or missing '+name+' ID');
  result.set(row.id,row);
 }
 return result;
};
const wordCharacter=/[\p{L}\p{M}\p{N}]/u;
function mentions(sentence,word){
 const haystack=key(sentence),needle=key(word);
 for(let start=haystack.indexOf(needle);start>=0;start=haystack.indexOf(needle,start+1)){
  const before=Array.from(haystack.slice(0,start)).at(-1)||'';
  const after=Array.from(haystack.slice(start+needle.length))[0]||'';
  if(!wordCharacter.test(before)&&!wordCharacter.test(after))return true;
 }
 return false;
}
function completedPrompt(row){
 if(row.gapFill){
  const {parts,answers}=row.gapFill;
  if(!Array.isArray(parts)||!Array.isArray(answers)||parts.length!==answers.length+1)return '';
  return parts.map((part,i)=>part+(answers[i]||'')).join('');
 }
 return typeof row.prompt==='string'?row.prompt.replace('___',row.answer):'';
}

/**
 * Rebind baseline references to the final reviewed inventory without adding words.
 * Only explicit effective-review mergeWith chains establish an equivalent ID.
 * Excluded/unknown IDs, invalid concepts, cycles and missing bilingual content drop.
 * Semantic exercises require unchanged selected EN/KO meanings and POS; wording
 * changes are withheld rather than guessed to be equivalent. Retired English
 * countability metadata is omitted. Morphemes need active related-word examples.
 * This preserves existing gap exercises, but never creates one from a draft.
 *
 * Returns {core:{exercises,families,morphemes,practiceData?},
 * english:{exercises,families,morphemes},korean:{...},report} for the caller to
 * combine with its assembled entries and package metadata. Inputs remain intact.
 */
export function rebuildReviewedEnglishReferences({baselineCore,baselineEnglish,baselineKorean,
 entries,englishEntries,koreanEntries,reviews=[],invalidConceptIds=[]}){
 const active=index(entries,'active entry'),old=index(baselineCore.entries,'baseline entry');
 const current=[index(englishEntries,'English meaning'),index(koreanEntries,'Korean meaning')];
 const previous=[index(baselineEnglish.entries,'baseline English meaning'),index(baselineKorean.entries,'baseline Korean meaning')];
 const reviewed=index(reviews,'review'),invalid=new Set(invalidConceptIds);
 for(const entry of active.values())if(!current.every(map=>text(map.get(entry.id)?.meaning))){
  throw new Error('Missing current paired meaning: '+entry.id);
 }
 const report={dropped:[],remapped:[],counts:{}};
 const drop=(kind,id,reason)=>report.dropped.push({kind,id,reason});
 function resolve(id){
  const seen=new Set();let target=id;
  while(true){
   if(invalid.has(target))return {reason:'invalid-concept'};
   if(seen.has(target))return {reason:'canonical-cycle'};
   seen.add(target);const review=reviewed.get(target);
   if(review?.mergeWith){target=review.mergeWith;continue;}
   if(review&&isEnglishReviewExcluded(review))return {reason:'excluded-entry'};
   return active.has(target)?{id:target,entry:active.get(target)}:{reason:'inactive-or-unknown-entry'};
  }
 }
 function sameConcept(id,target){
  const before=old.get(id),after=active.get(target);
  return !!before&&!!after&&before.partOfSpeech===after.partOfSpeech&&
   current.every((map,i)=>text(previous[i].get(id)?.meaning)&&
    previous[i].get(id).meaning===map.get(target)?.meaning);
 }
 function lexicalForms(id,target){
  const before=old.get(id),after=active.get(target);
  if(!before||!after)return [];
  if(key(before.word)===key(after.word))return [after.word];
  // No lookup by spelling can turn a synonym or homograph into an ID mapping.
  if(id!==target&&(after.aliases||[]).some(alias=>key(alias)===key(before.word))){
   return [after.word,before.word];
  }
  return [];
 }
 // Explicit undefined also clears a retired baseline field when the caller
 // spreads these references over baseline package metadata before serialising.
 const core={exercises:[],families:[],morphemes:[],practiceData:undefined};
 const english={exercises:[],families:[],morphemes:[]};
 const korean={exercises:[],families:[],morphemes:[]};
 const pairs=[baselineEnglish,baselineKorean],output=[english,korean];
 const translatedExercises=pairs.map(pair=>index(pair.exercises,'exercise translation'));
 const exerciseIds=new Set();
 for(const row of baselineCore.exercises||[]){
  if(exerciseIds.has(row.id))throw new Error('Duplicate exercise ID');exerciseIds.add(row.id);
  const resolved=resolve(row.entryId);
  let reason=resolved.reason;
  if(!reason&&!isActiveExerciseCategory('en',row.category))reason='inactive-exercise-category';
  if(!reason&&!sameConcept(row.entryId,resolved.id))reason='changed-selected-meaning-or-pos';
  const forms=!reason?lexicalForms(row.entryId,resolved.id):[];
  if(!reason&&(!forms.length||!forms.some(form=>mentions(completedPrompt(row),form))))reason='exercise-does-not-test-referenced-word';
  const translations=translatedExercises.map(map=>map.get(row.id));
  if(!reason&&translations.some(value=>!value))reason='missing-bilingual-exercise';
  const transformed={...copy(row),entryId:resolved.id};
  if(!reason){
   try{
    validateExercises({kind:'study',targetLanguage:'en',entries:[resolved.entry],exercises:[transformed]});
    for(const translated of translations)validateExercises({kind:'explanation',targetLanguage:'en',entries:[],exercises:[translated]});
   }catch{reason='invalid-exercise-content';}
  }
  if(reason){drop('exercise',row.id,reason);continue;}
  core.exercises.push(transformed);translations.forEach((row,i)=>output[i].exercises.push(copy(row)));
  if(row.entryId!==resolved.id)report.remapped.push({kind:'exercise',id:row.id,from:row.entryId,to:resolved.id});
 }

 const translatedFamilies=pairs.map(pair=>index(pair.families,'family translation'));
 const familyIds=new Set();
 for(const family of baselineCore.families||[]){
  if(familyIds.has(family.id))throw new Error('Duplicate family ID');familyIds.add(family.id);
  const translations=translatedFamilies.map(map=>map.get(family.id));
  if(translations.some(row=>!text(row?.meaning))){drop('family',family.id,'missing-bilingual-family');continue;}
  const members=[],seen=new Set();
  for(const member of family.members||[]){
   const resolved=resolve(member.entryId);
   const reason=resolved.reason||(!lexicalForms(member.entryId,resolved.id).length?'unverified-lexical-replacement':null);
   if(reason){drop('family-member',family.id+':'+member.entryId,reason);continue;}
   if(seen.has(resolved.id)){drop('family-member',family.id+':'+member.entryId,'duplicate-canonical-member');continue;}
   seen.add(resolved.id);const transformed={...copy(member),entryId:resolved.id,word:resolved.entry.word};
   if(member.word!==resolved.entry.word)delete transformed.parts;
   members.push(transformed);
   if(member.entryId!==resolved.id)report.remapped.push({kind:'family-member',id:family.id,from:member.entryId,to:resolved.id});
  }
  if(!members.length){drop('family',family.id,'empty-after-review');continue;}
  core.families.push({...copy(family),members});
  translations.forEach((translation,i)=>output[i].families.push({...copy(translation),
   members:members.map(member=>({entryId:member.entryId,note:current[i].get(member.entryId).meaning}))}));
 }

 // Morphemes are a separate licensed reference inventory, never study entries.
 const translatedMorphemes=pairs.map(pair=>index(pair.morphemes,'morpheme translation'));
 const activeWords=new Set([...active.values()].map(entry=>key(entry.word)));
 for(const entry of old.values()){
  const resolved=resolve(entry.id);
  if(resolved.id&&lexicalForms(entry.id,resolved.id).some(form=>key(form)===key(entry.word)))activeWords.add(key(entry.word));
 }
 const morphemeIds=new Set();
 for(const row of baselineCore.morphemes||[]){
  if(morphemeIds.has(row.id))throw new Error('Duplicate morpheme ID');morphemeIds.add(row.id);
  const translations=translatedMorphemes.map(map=>map.get(row.id));
  const senseMaps=translations.map(row=>new Map((row?.senses||[]).map(sense=>[sense.id,sense])));
  const senses=(row.senses||[]).filter(sense=>{
   if(senseMaps.every(map=>text(map.get(sense.id)?.meaning)))return true;
   drop('morpheme-sense',sense.id,'missing-bilingual-morpheme-sense');return false;
  });
  if(!senses.length){drop('morpheme',row.id,'no-paired-senses');continue;}
  const examples=[...new Set((row.examples||[]).filter(word=>{
   if(activeWords.has(key(word)))return true;
   drop('morpheme-example',row.id+':'+word,'not-an-active-word-or-verified-alias');return false;
  }))];
  if(!examples.length){drop('morpheme',row.id,'no-active-related-words');continue;}
  core.morphemes.push({...copy(row),senses:copy(senses),examples});
  translations.forEach((translation,i)=>output[i].morphemes.push({...copy(translation),
   senses:senses.map(sense=>copy(senseMaps[i].get(sense.id)))}));
 }

 if(baselineCore.practiceData){
  for(const row of baselineCore.practiceData.countability||[])drop('countability',row.entryId,'removed-english-feature');
  if(baselineCore.practiceData.rootFamilies){
   const rootFamilies=[];
   for(const family of baselineCore.practiceData.rootFamilies){
    const members=[],seen=new Set();
    for(const member of family.members||[]){
     const resolved=resolve(member.entryId);
     const reason=resolved.reason||(!lexicalForms(member.entryId,resolved.id).length?'unverified-lexical-replacement':
      seen.has(resolved.id)?'duplicate-canonical-member':null);
     if(reason){drop('historical-root-member',family.id+':'+member.entryId,reason);continue;}
     seen.add(resolved.id);members.push({...copy(member),entryId:resolved.id});
    }
    if(members.length<2||new Set(members.map(member=>key(active.get(member.entryId).word))).size<2){
     drop('historical-root-family',family.id,'fewer-than-two-active-words');continue;
    }
    rootFamilies.push({...copy(family),members});
   }
   if(rootFamilies.length)core.practiceData={version:1,rootFamilies};
  }
 }
 const study={kind:'study',targetLanguage:'en',entries,...core};
 validateExercises(study);validateMorphemes(study);validatePracticeData(study);
 for(const [i,translated] of output.entries()){
  const pair={kind:'explanation',targetLanguage:'en',entries:i?koreanEntries:englishEntries,...translated};
  validateExercises(pair);validateMorphemes(pair);
  validateExerciseTranslations(study,pair);validateMorphemeTranslations(study,pair);
 }
 for(const reason of report.dropped){
  const name=reason.kind;report.counts[name]??={dropped:0};report.counts[name].dropped++;
 }
 for(const name of ['exercises','families','morphemes'])report.counts[name]={
  input:(baselineCore[name]||[]).length,retained:core[name].length,dropped:(baselineCore[name]||[]).length-core[name].length};
 return {core,english,korean,report};
}
