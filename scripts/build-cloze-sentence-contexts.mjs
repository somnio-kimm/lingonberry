import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {clozeSentence} from '../web/js/shared/cloze-translation.js';
import {writePackageRelease} from './content/package-writer.mjs';
const root=new URL('../',import.meta.url),sourcePath='language-packages/sources/exercises/cloze-sentence-contexts-ko-7.0.6.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function clozeSentenceContexts(){
 const raw=await readFile(new URL(sourcePath,root));assert.equal(sha(raw),'a1df41ecedfb7c1c494767a12bbc03f818eafc86f68aeeb7862bd86fce7c3b0c');
 const source=JSON.parse(raw),packs=[];
 for(const descriptor of [source.core,source.baseline]){
  const bytes=await readFile(new URL(descriptor.file,root));assert.equal(sha(bytes),descriptor.sha256);packs.push(JSON.parse(bytes));
 }
 const [core,pair]=packs,words=new Map(core.entries.map(row=>[row.id,row])),meanings=new Map(pair.entries.map(row=>[row.id,row])),translations=new Map(source.entries.map(row=>[row.sentence,row.translation])),byId=new Map(pair.exercises.map(row=>[row.id,row])),changed=[];
 for(const question of core.exercises){
  if(!['phrasal','collocations','idioms'].includes(question.category)||!['vocabinput','vocabmeaning'].includes(question.route)||!(question.gapFill||question.prompt.match(/_{2,}/gu)?.length===1))continue;
  const sentence=clozeSentence(question),word=words.get(question.entryId),meaning=meanings.get(question.entryId);
  const examples=[word?.example,...(word?.additionalExamples||[])],index=examples.findIndex(example=>example?.text.normalize('NFC')===sentence.normalize('NFC'));
  const existing=index===0?meaning?.exampleTranslation:index>0?meaning?.additionalExampleTranslations?.[index-1]:undefined;
  const translation=translations.get(sentence)||existing;if(!translation)continue;
  const row=byId.get(question.id);assert.ok(row);row.context=translation;changed.push(row.id);
 }
 for(const row of source.entries)assert.ok(changed.includes(row.exerciseId),row.exerciseId);
 pair.version=source.version;
 pair.license.notice='Exact matching sentence translations are reused unchanged with their existing source credits and licences. Six original Korean Cloze sentence translations, independently editorially reviewed: Lingonberry contributors, CC BY 4.0. Source and exact changed question sentences: '+sourcePath+'. Existing meanings, examples, sources, IDs and licences remain unchanged.\n\n'+pair.license.notice;
 return {core,pair,changed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {core,pair,changed}=await clozeSentenceContexts();
 if(!process.argv.includes('--dry-run'))await writePackageRelease(root,core,[pair],{compact:true});
 console.log(JSON.stringify({id:pair.id,version:pair.version,studyVersion:pair.studyVersion,contexts:changed.length}));
}
