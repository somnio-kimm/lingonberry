import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appendEnglishWords,englishSenseBinding,applyEnglishDifficulty} from '../scripts/content/english-difficulty.mjs';
import {ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
async function fixture(){const core=await read('language-packages/en-core-4.1.0.json'),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-4.1.0.json`))),additions=await read('language-packages/sources/english-difficulty-additions.json'),review=await read('language-packages/sources/english-difficulty-review.json');appendEnglishWords(core,pairs,additions);return {core,pairs,additions,review};}
test('every stored English sense has a bound decision and expert count uses distinct headwords',async()=>{
 const {core,pairs,review}=await fixture(),ids=core.entries.map(row=>row.id),result=applyEnglishDifficulty(core,pairs,review);assert.equal(result.reviewed,core.entries.length);assert.deepEqual(core.entries.map(row=>row.id),ids);assert.ok(result.distinctWords[ENGLISH_LEVELS[3]]>=1000);assert.equal(result.distinctWords[ENGLISH_LEVELS[3]],new Set(core.entries.filter(row=>row.level===ENGLISH_LEVELS[3]).map(row=>row.word.toLowerCase())).size);
 for(const word of ['beginner','comb','tidy','lamp','oven','passport','rabbit']){const rows=core.entries.filter(row=>row.word===word);assert.ok(rows.length);assert.ok(rows.every(row=>row.level===ENGLISH_LEVELS[0]),word+' ordinary meanings belong at the bottom');}
 for(const word of ['abstruse','obfuscate','recalcitrant','cogent'])assert.equal(core.entries.find(row=>row.word===word).level,ENGLISH_LEVELS[3]);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},store=createLexiconStore(storage,{id:'en',levels:ENGLISH_LEVELS}),comb=core.entries.find(row=>row.word==='comb');store.setWordStatus(comb.id,'mastered');assert.equal(createLexiconStore(storage,{id:'en',levels:ENGLISH_LEVELS}).wordStatus(comb.id),'mastered');
});
test('incomplete, duplicated, stale or undersized reviews cannot publish',async()=>{
 for(const mutate of [r=>r.decisions.pop(),r=>r.decisions.push(r.decisions[0]),r=>r.senseSha256='stale',r=>r.decisions.forEach(row=>{if(row.band===3)row.band=2;})]){const {core,pairs,review}=await fixture();mutate(review);assert.throws(()=>applyEnglishDifficulty(core,pairs,review),/review|1000/);}
 const {core,pairs,review}=await fixture();pairs[0].entries[0].meaning='A changed concept.';assert.notEqual(englishSenseBinding(core,pairs),review.senseSha256);assert.throws(()=>applyEnglishDifficulty(core,pairs,review),/stored senses/);
});
test('published difficulty packages preserve existing meanings and add complete bilingual examples',async()=>{
 const core=await read('language-packages/en-core-4.2.0.json'),report=await read('language-packages/sources/english-difficulty-report.json'),additions=await read('language-packages/sources/english-difficulty-additions.json');assert.equal(core.entries.length,11977+additions.entries.length);assert.equal(report.reviewed,core.entries.length);assert.ok(report.distinctWords[ENGLISH_LEVELS[3]]>=1000);const family=core.families.find(row=>row.id==='en-family-claudere');for(const word of ['include','preclude','occlude'])assert.ok(family.members.some(member=>member.word===word));
 for(const locale of ['en','ko']){const previous=await read(`language-packages/en-${locale}-4.1.0.json`),current=await read(`language-packages/en-${locale}-4.2.0.json`);assert.equal(current.entries.length,core.entries.length);assert.deepEqual(current.entries.slice(0,previous.entries.length),previous.entries);assert.match(current.license.identifier,/MIT/);for(const row of current.entries.slice(previous.entries.length)){assert.ok(row.meaning&&row.exampleTranslation);if(locale==='ko')assert.match(row.meaning,/[가-힣]/);}}
});
test('new dictionary additions cannot duplicate an existing headword',()=>{assert.throws(()=>appendEnglishWords({entries:[{id:'x',word:'cogent'}]},[],{entries:[{word:'cogent'}]}),/already present/);});
