import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {writePackageRelease} from './content/package-writer.mjs';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const sourcePath='language-packages/sources/exercises/english-suffix-supplement-7.0.5.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Restore only independently checked source relationships; never derive them from spelling. */
export async function englishSuffixSupplement(){
 const raw=await readFile(new URL(sourcePath,root)),source=JSON.parse(raw);
 assert.equal(sha(raw),'0fa8b75662b9481e108083eb341ed31b1c6bff6eea211ab03fef7baa9231b2df');
 assert.equal(source.independentReview.mechanicalPassed,true);
 const inventoryRaw=await readFile(new URL(source.sourceInventory,root));
 assert.equal(sha(inventoryRaw),source.sourceInventorySha256);
 const originals=new Map(JSON.parse(inventoryRaw).entries.map(row=>[row.id,row]));
 const baselineReport=await read('language-packages/sources/reviews/en-7.0.3.json');
 const packs=[];
 for(const descriptor of baselineReport.payloads){
  const bytes=await readFile(new URL(descriptor.file,root));
  assert.equal(sha(bytes),descriptor.sha256);packs.push(JSON.parse(bytes));
 }
 const [core,...pairs]=packs;
 const morphemes=new Map(core.morphemes.map(row=>[row.id,row]));
 for(const update of source.morphemeUpdates){
  const {morpheme}=update,original=originals.get(morpheme.id);
  for(const field of ['form','variants','kind','origin','senses','source'])assert.deepEqual(morpheme[field],original[field]);
  assert.equal(morphemes.has(morpheme.id),update.operation==='extend');
  morphemes.set(morpheme.id,{id:morpheme.id,form:morpheme.form,variants:morpheme.variants,kind:morpheme.kind,origin:morpheme.origin,
   examples:morpheme.examples,senses:morpheme.senses.map(({id,tags})=>({id,...(tags?{tags}:{})})),source:morpheme.source});
  for(const pair of pairs){
   const translated={id:morpheme.id,senses:morpheme.senses.map(sense=>({id:sense.id,meaning:sense[pair.explanationLanguage]}))};
   const index=pair.morphemes.findIndex(row=>row.id===morpheme.id);
   if(index<0)pair.morphemes.push(translated);else {assert.deepEqual(pair.morphemes[index],translated);pair.morphemes[index]=translated;}
  }
 }
 core.morphemes=[...morphemes.values()];
 const spellings=new Set(core.entries.flatMap(row=>[row.word,...(row.aliases||[])]).map(word=>word.toLowerCase()));
 for(const row of source.newDictionaryEntries){
  for(const spelling of [row.word,...row.aliases])assert.equal(spellings.has(spelling.toLowerCase()),false,'Duplicate dictionary spelling: '+spelling);
  core.entries.push({id:row.id,word:row.word,partOfSpeech:row.partOfSpeech,level:row.level,pronunciation:row.pronunciation,
   ...(row.aliases.length?{aliases:row.aliases,listeningAliases:row.aliases}:{}),tags:[],provenance:row.provenance,
   example:{text:row.sentence,focus:row.exampleFocus,provenance:row.exampleProvenance}});
  for(const pair of pairs)pair.entries.push({id:row.id,meaning:pair.explanationLanguage==='ko'?row.meaningKo:row.meaningEn,
   exampleTranslation:pair.explanationLanguage==='ko'?row.translationKo:row.sentence});
 }
 core.contentReview.bilingualExamples=core.entries.length;
 core.contentReview.rootSuffixSupplement={source:sourcePath,sourceSha256:sha(raw),independentReviewSha256:source.independentReview.sha256,
  baselineReviewedEntries:40710,newReviewedEntries:3,suffixGroups:14,relatedWordReferences:345,nativeSpeakerCertification:false};
 for(const pack of packs){
  pack.version=source.edition;if(pack.kind==='explanation')pack.studyVersion=source.edition;
  pack.license.notice='English 7.0.5 suffix supplement: fourteen source-backed affix groups and three independently reviewed verb senses. Affix explanations and word definitions/adaptations: English Wiktionary contributors and Lingonberry contributors, CC BY-SA 4.0; original new examples and Korean translations: Lingonberry contributors, CC BY 4.0. Exact sources and changes: '+sourcePath+'.\n\n'+pack.license.notice;
 }
 return {core,pairs,source};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {core,pairs}=await englishSuffixSupplement();
 if(!process.argv.includes('--dry-run'))await writePackageRelease(root,core,pairs,{compact:true});
 console.log(JSON.stringify({edition:core.version,entries:core.entries.length,morphemes:core.morphemes.length,dryRun:process.argv.includes('--dry-run')}));
}
