import {britishEnglish} from './british-english.mjs';
import {validateExplanation} from '../../web/js/packages/schema.js';
import {compareContentVersions} from '../../web/js/shared/review-content.js';
/** Normalise only attested spelling variants when matching an archived definition. */
export function normaliseSourceEnglish(text){
 const spellings={behavior:'behaviour',behaviors:'behaviours',catalog:'catalogue',honor:'honour',honors:'honours',flavor:'flavour',flavors:'flavours',humor:'humour',rumor:'rumour',traveler:'traveller',airplane:'aeroplane',airplanes:'aeroplanes',aircrafts:'aircraft'};
 return britishEnglish(String(text)).replace(/\b[a-z]+\b/gu,word=>spellings[word]||word);
}
function* sources(provenance={}){
 yield provenance;
 if(provenance.source&&typeof provenance.source==='object')yield* sources(provenance.source);
 for(const source of provenance.sources||[])yield* sources(source);
}
/** Use the exact selected source sense, never another sense of the same Korean word. */
export function sourceEquivalent(entry,locale,nikl){
 for(const source of sources(entry.provenance)){
  const sense=nikl.get(source.entryId+':'+source.senseId);
  if(source.license!=='CC-BY-SA-2.0-KR'||!sense||source.sourceWord!==sense.word)continue;
  const definition=locale==='ko'?sense.definition:sense.equivalents?.[locale]?.definition;
  if(!definition||(locale==='en'?normaliseSourceEnglish(definition)!==normaliseSourceEnglish(entry.meaning):definition!==entry.meaning))continue;
  let meaning=locale==='ko'?sense.word:sense.equivalents?.[locale]?.lemma;
  if(typeof meaning!=='string'||!meaning.trim())continue;
  if(locale==='en'){meaning=normaliseSourceEnglish(meaning);if(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{Script=Hangul}]/u.test(meaning))continue;}
  return {meaning:meaning.trim(),method:'nikl-equivalent',sourceRef:source.entryId+':'+source.senseId};
 }
}
function explicitEquivalent(entry,locale){
 const [head,...rest]=entry.meaning.split(/[;:]/u),phrase=head.trim(),limit=locale==='ko'?18:42;
 if(!rest.length||phrase.length>limit||phrase.split(/\s+/u).length>(locale==='ko'?1:5)||rest.join(';').split(/\s+/u).length<(locale==='ko'?4:7))return;
 if(locale==='en'&&/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(phrase))return;
 return {meaning:phrase,method:'explicit-equivalent-prefix'};
}
function selectedEnglishGloss(entry){
 const existing=normaliseSourceEnglish(entry.meaning).replace(/^(?:a|an|the|to)\s+/iu,'').toLowerCase();
 for(const source of sources(entry.provenance)){
  if(source.kind!=='wiktionary'||!(source.edition==='en'||source.creator==='English Wiktionary contributors'))continue;
  for(const gloss of [...(source.glosses||[])].reverse()){
   const meaning=normaliseSourceEnglish(gloss),head=meaning.split(/[;(,:]/u)[0].replace(/^(?:a|an|the|to)\s+/iu,'').trim().toLowerCase();
   if(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{Script=Hangul}]/u.test(meaning)||!head||meaning.length>90||meaning.length>=entry.meaning.length||/^(?:synonym|clipping|short for|alternative|obsolete|used to|a term|an expression)\b/u.test(head))continue;
   if(existing===head||existing.startsWith(head+' ')||existing.startsWith(head+';')||existing.startsWith(head+':')||existing.startsWith(head+','))return {meaning,method:'selected-english-gloss'};
  }
 }
}
export function prepareConciseChanges(core,pair,nikl,editorial=[]){
 validateExplanation(core,pair);
 if(pair.targetLanguage===pair.explanationLanguage)return [];
 const words=new Map(core.entries.map(row=>[row.id,row])),edits=new Map();
 for(const edit of editorial){if(edits.has(edit.id))throw new Error('Duplicate concise editorial row '+edit.id);edits.set(edit.id,edit);}
 const changes=[];
 for(const entry of pair.entries){
  let result;const edit=edits.get(entry.id);
  if(edit){
   if(edit.word!==words.get(entry.id).word||edit.before[pair.explanationLanguage]!==entry.meaning)throw new Error('Stale concise editorial row '+entry.id);
   result={meaning:edit[pair.explanationLanguage],method:'editorial-equivalent'};edits.delete(entry.id);
  }else{
   result=sourceEquivalent(entry,pair.explanationLanguage,nikl);
   if(!result&&core.targetLanguage==='ja')result=(pair.explanationLanguage==='en'?selectedEnglishGloss(entry):undefined)||explicitEquivalent(entry,pair.explanationLanguage);
  }
  if(result&&result.meaning!==entry.meaning)changes.push({id:entry.id,word:words.get(entry.id).word,before:entry.meaning,...result});
 }
 if(edits.size)throw new Error('Unknown concise editorial IDs');
 return changes;
}
/** Explanation-only edition: keep the installed study core, examples and stable IDs. */
export function compileConcisePair(core,pair,changes,version){
 validateExplanation(core,pair);
 if(pair.targetLanguage===pair.explanationLanguage)throw new Error('Same-language definitions must remain unchanged');
 if(compareContentVersions(version,pair.version)<=0)throw new Error('Concise translations need a new immutable version');
 const originals=new Map(pair.entries.map(row=>[row.id,row])),seen=new Set();
 for(const row of changes){
  const old=originals.get(row.id);
  if(!old||seen.has(row.id)||row.before!==old.meaning)throw new Error('Unknown, duplicate or stale concise change '+row.id);
  if(typeof row.meaning!=='string'||!row.meaning.trim()||row.meaning.length>4000)throw new Error('Empty or invalid concise meaning');
  if(!['nikl-equivalent','selected-english-gloss','explicit-equivalent-prefix','editorial-equivalent'].includes(row.method))throw new Error('Unknown concise source method');
  if(pair.explanationLanguage==='en'&&/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(row.meaning))throw new Error('Non-English concise meaning');
  seen.add(row.id);
 }
 const byId=new Map(changes.map(row=>[row.id,row]));
 const entries=pair.entries.map(old=>{
  const change=byId.get(old.id);if(!change)return old;
  const row={...old,meaning:change.meaning}; // Per-entry methods stay in the public ledger, not every download.
  delete row.meanings;return row;
 });
 const notice='Lingonberry concise cross-language meanings. Short equivalents replace dictionary definitions without changing lexical senses or example translations. NIKL headwords and translated equivalents retain National Institute of Korean Language attribution and CC BY-SA 2.0 KR. Wiktionary text and editorial adaptations retain their earlier source credits and CC BY-SA 4.0 where applicable. Prior definitions remain in the immutable earlier explanation packages. Reproduction and change records: language-packages/sources/concise-translations/. No audio, images or publisher quotations are added. English-to-English definitions are unchanged. AI-assisted editorial review; native-speaker certification pending.\n\nEarlier source notices:\n\n';
 const result={...pair,version,entries,meaningPolicy:'concise-cross-language-equivalents',license:{...pair.license,notice:notice+pair.license.notice}};
 validateExplanation(core,result);return result;
}
