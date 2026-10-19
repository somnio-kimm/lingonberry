import {allowsExplanation} from '../../web/js/shared/language-pairs.js';
import {validatePackage,validateExplanation} from '../../web/js/packages/schema.js';
import {validateExampleRecord,validateCorrection,applyEntryCorrection,translationMap} from './example-records.mjs';

/** Build a new immutable edition; missing extra locales remain outside the catalogue. */
export function compileExamples({core,pairs,authored,corrections=[],version}){
 if(version===core.version)throw new Error('Example updates require a new immutable version');
 const originals=new Map(core.entries.map(row=>[row.id,row])),records=new Map(),edits=new Map();
 for(const row of authored){if(records.has(row.id))throw new Error('Duplicate example: '+row.id);validateExampleRecord(row,originals.get(row.id),core.targetLanguage);records.set(row.id,row);}
 for(const row of corrections){if(edits.has(row.id))throw new Error('Duplicate correction: '+row.id);validateCorrection(row,originals.get(row.id));if(!records.has(row.id))throw new Error('Sense corrections require a matched replacement example: '+row.id);edits.set(row.id,row);}
 const notice=`Learn Language example expansion, edition ${version}.\n\nOriginal examples and translations by Learn Language contributors, 2026, CC BY 4.0. These are AI-assisted editorial drafts; fluent-speaker review remains pending. Sense, article and grammatical corrections to licensed dictionary entries are CC BY-SA 4.0 adaptations. Stable entry IDs and original source provenance are retained. The authoring and correction records are included in language-packages/sources/examples/. No unreviewed model output, audio or publisher quotations are added.\n\nEarlier edition source notices follow:\n\n${core.license.notice}`;
 const license={...core.license,notice,links:(core.license.links||[]).map(link=>link.title==='Unrestricted Content Downloads and Source Information'?{...link,url:'https://github.com/somnio-kimm/lingonberry/tree/main/language-packages'}:link)};
 const entries=core.entries.map(original=>{
  const record=records.get(original.id),edit=edits.get(original.id);if(!record)return original;
  const updated={...applyEntryCorrection(original,edit)},example={text:record.text,...(record.focus?{focus:record.focus}:{}),provenance:{...record.provenance,creator:'Learn Language contributors'}};
  if(edit){delete updated.referenceExamples;if(edit.word&&edit.word!==original.word){if(!edit.aliases)delete updated.aliases;if(!edit.pronunciation)delete updated.pronunciation;}}
  // The replacement has its own translation set; old additional examples would need separate translations.
  delete updated.additionalExamples;
  return {...updated,example,exampleStatus:'editorial-draft; native-speaker-review-pending'};
 });
 const complete=entries.filter(row=>row.example).length;
 const study={...core,version,license,contentReview:{...core.contentReview,status:'editorial-example-preview',nativeSpeakerReview:'pending',bilingualExamples:complete,examplesPending:entries.length-complete,newAuthoredExamples:records.size,senseCorrections:edits.size,examplePolicy:'Original usage examples and explicit sense corrections; only complete explanation packages are offered. Native review and remaining examples are pending.'},entries};
 const explanations=pairs.filter(pair=>allowsExplanation(core.targetLanguage,pair.explanationLanguage)).map(pair=>{
  const locale=pair.explanationLanguage,previous=new Map(pair.entries.map(row=>[row.id,row]));
  const translated=entries.map(entry=>{
   const old=previous.get(entry.id),edit=edits.get(entry.id),record=records.get(entry.id);if(!record)return old;
   const meaning=edit?(edit.meanings?.[locale]||(locale==='en'?edit.meaningEn:locale==='ko'?edit.meaningKo:undefined)):old?.meaning;
   if(!meaning)throw new Error(`Missing corrected ${locale} meaning: ${entry.id}`);
   const exampleTranslation=translationMap(record,core.targetLanguage)[locale];if(!exampleTranslation)throw new Error(`Missing ${locale} example translation: ${entry.id}`);
   const next={...old,id:entry.id,meaning,exampleTranslation,exampleTranslationProvenance:{...record.provenance,creator:'Learn Language contributors'}};
   delete next.additionalExampleTranslations;
   if(edit){delete next.meanings;next.editorialCorrection={reason:edit.reason,provenance:edit.provenance};}
   return next;
  });
  return {...pair,version,studyVersion:version,license,entries:translated};
 });
 validatePackage(study);for(const pair of explanations)validateExplanation(study,pair);
 return [study,...explanations];
}
