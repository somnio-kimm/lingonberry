import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalogue=await read('language-packages/catalog.json'),editions=await read('docs/example-editions.json');
for(const [language,report]of Object.entries(editions))test(language+': authored edition keeps IDs, attribution and complete installed explanations',async()=>{
 const descriptor=catalogue.find(row=>row.id===language+'-core'),editionVersion='3.0.0',editionPath=`language-packages/${language}-core-${editionVersion}.json`,core=await read(editionPath),old=await read(`language-packages/${language}-core-${report.sourceVersion}.json`);
 validatePackage(core,descriptor.version===editionVersion?descriptor:undefined);assert.deepEqual(core.entries.map(row=>row.id),old.entries.map(row=>row.id));
 const bytes=await readFile(new URL('../'+editionPath,import.meta.url));if(descriptor.version===editionVersion){assert.equal(bytes.length,descriptor.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);}else{const archived=await read(`language-packages/sources/meaning-reviews/${language}-3.0.0/manifest.json`);assert.equal(createHash('sha256').update(bytes).digest('hex'),archived.sourcePackages.find(row=>row.path===editionPath).sha256);}
 const authoredBytes=await readFile(new URL('../'+(report.authoredPath||`language-packages/sources/examples/${language}-authored.jsonl`),import.meta.url)),authored=authoredBytes.toString().trim().split('\n').map(JSON.parse);
 assert.equal(createHash('sha256').update(authoredBytes).digest('hex'),report.authoringSha256);assert.equal(authored.length,report.newAuthoredExamples);
 const byId=new Map(core.entries.map(row=>[row.id,row]));
 const correctionBytes=await readFile(new URL('../'+(report.correctionsPath||`language-packages/sources/examples/${language}-corrections.jsonl`),import.meta.url));assert.equal(createHash('sha256').update(correctionBytes).digest('hex'),report.correctionsSha256);
 for(const correction of correctionBytes.toString().trim().split('\n').filter(Boolean).map(JSON.parse)){const entry=byId.get(correction.id);for(const field of ['word','partOfSpeech','article','pronunciation','aliases'])if(correction[field]!==undefined)assert.deepEqual(entry[field],correction[field]);}

 for(const row of authored){const entry=byId.get(row.id);assert.equal(entry.example.text,row.text);assert.equal(entry.example.provenance.license,'CC-BY-4.0');if(row.focus)assert.ok(findSentenceFocus({lemma:entry.word},entry.example,language),entry.id);}
 for(const pair of catalogue.filter(row=>row.kind==='explanation'&&row.targetLanguage===language))validateExplanation(core,await read(`language-packages/${pair.id}-${editionVersion}.json`));
 assert.equal(core.entries.filter(row=>row.example).length,report.bilingualExamples);assert.equal(report.nativeSpeakerReview,'pending');assert.match(core.license.notice,/original source provenance/i);
});
