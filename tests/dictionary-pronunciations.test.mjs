import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateExplanation} from '../web/js/packages/schema.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
test('pronunciation release retains all meanings, example translations and learner IDs',async()=>{
 for(const [language,oldVersion,newVersion,oldPairs]of [['en','7.0.5','7.1.0',['7.0.5','7.0.6']],['de','4.0.0','4.1.0',['4.0.0','4.0.0']]]){
  const [oldCore,core]=await Promise.all([oldVersion,newVersion].map(version=>read(`language-packages/${language}-core-${version}.json`)));assert.deepEqual(core.entries.map(row=>row.id),oldCore.entries.map(row=>row.id));
  for(const [i,locale]of ['en','ko'].entries()){const [oldPair,pair]=await Promise.all([read(`language-packages/${language}-${locale}-${oldPairs[i]}.json`),read(`language-packages/${language}-${locale}-${newVersion}.json`)]);assert.deepEqual(pair.entries,oldPair.entries);assert.equal(pair.studyVersion,core.version);validateExplanation(core,pair);}
 }
});
test('every added reading resolves to its exact credited headword/POS source record',async()=>{
 const path='language-packages/sources/dictionary-pronunciations-20261118.json',bytes=await readFile(new URL('../'+path,import.meta.url)),ledger=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(ledger.license,'CC-BY-SA-4.0');
 for(const [language,version]of [['en','7.1.0'],['de','4.1.0']]){const core=await read(`language-packages/${language}-core-${version}.json`);assert.equal(core.contentReview.pronunciationSupplement.sourceSha256,hash);const added=core.entries.filter(row=>row.pronunciationSource?.record!==undefined);assert.ok(added.length>8000);for(const row of added){const record=ledger.entries[row.pronunciationSource.record];assert.equal(record.word,row.word);assert.equal(record.language,language);assert.equal(record.partOfSpeech,['proper noun','plural noun'].includes(row.partOfSpeech)?'noun':row.partOfSpeech);assert.equal(record.pronunciation,row.pronunciation);assert.match(record.sourceUrl,/^https:\/\/(?:en|de)\.wiktionary\.org\/wiki\//u);assert.match(record.historyUrl,/action=history/u);}assert.match(core.license.notice,/CC BY-SA4\.0/u);}
});
test('common short words use supplied British English and standard German transcriptions',async()=>{
 const en=await read('language-packages/en-core-7.1.0.json'),de=await read('language-packages/de-core-4.1.0.json');assert.equal(en.entries.find(row=>row.word==='car'&&row.partOfSpeech==='noun').pronunciation,'/kɑː/');assert.equal(de.entries.find(row=>row.word==='Auto'&&row.partOfSpeech==='noun').pronunciation,'[ˈaʊ̯to]');
});

test('IPA selection rejects ambiguous, historical and mismatched forms',()=>{const result=spawnSync('python3',['scripts/content/import-dictionary-pronunciations.py','--self-test'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
test('German grammatical words use exact supplied subtypes and retain the prior pronunciation ledger',async()=>{
 const [core,prior,ledger]=await Promise.all([read('language-packages/de-core-4.1.1.json'),read('language-packages/de-core-4.1.0.json'),read('language-packages/sources/german-functional-pronunciations-20261118.json')]);assert.equal(core.entries.length,prior.entries.length);
 const added=core.entries.filter(row=>row.pronunciationSource?.supplementRecord!==undefined);assert.equal(added.length,561);for(const row of added){assert.equal(row.partOfSpeech,'functional');const item=ledger.entries[row.pronunciationSource.supplementRecord];assert.equal(item.word,row.word);assert.equal(item.partOfSpeech,row.grammar.subtype==='article'?'determiner':row.grammar.subtype);assert.equal(item.pronunciation,row.pronunciation);}
 for(const [word,ipa]of [['ab','[ap]'],['ob','[ɔp]'],['ich','[ɪç]'],['das','[das]'],['und','[ʊnt]']])assert.equal(core.entries.find(row=>row.word===word&&row.partOfSpeech==='functional').pronunciation,ipa);
 for(const old of prior.entries.filter(row=>row.pronunciation)){const current=core.entries.find(row=>row.id===old.id);assert.equal(current.pronunciation,old.pronunciation);assert.deepEqual(current.pronunciationSource,old.pronunciationSource);}
 for(const locale of ['en','ko']){const pair=await read(`language-packages/de-${locale}-4.1.1.json`),previous=await read(`language-packages/de-${locale}-4.1.0.json`);assert.deepEqual(pair.entries,previous.entries);validateExplanation(core,pair);}
});
