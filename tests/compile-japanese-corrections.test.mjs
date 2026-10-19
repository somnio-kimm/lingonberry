import test from 'node:test';
import assert from 'node:assert/strict';
import {compileMeaningCorrections,decisionDigest} from '../scripts/content/compile-meaning-corrections.mjs';
import {prepareJapaneseReview,validateJapaneseDecisions} from '../scripts/content/japanese-meaning-review.mjs';
const proof={creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0',url:'https://en.wiktionary.org/wiki/大丈夫',sourceRowDigest:'a'.repeat(64),senseOrdinal:1,glosses:['safe; all right']};
function fixture(){
 const core={schemaVersion:2,kind:'study',id:'ja-core',targetLanguage:'ja',version:'3.0.0',license:{identifier:'CC-BY-SA-4.0',notice:'Original credits.'},exam:{id:'jlpt',levels:['N5','N4','N3','N2','N1'],vocabularyMembership:'editorial'},entries:[
  {id:'japan',word:'日本',partOfSpeech:'noun',level:'N5',pronunciation:'にほん',aliases:['にほん'],provenance:{kind:'app-authored'}},
  {id:'okay',word:'大丈夫',partOfSpeech:'noun',level:'N4',pronunciation:'だいじょぶ',aliases:['だいじょぶ'],provenance:{kind:'app-authored'},example:{text:'これで大丈夫です。',source:{kind:'app-authored',license:'CC-BY-4.0'}}},
 ]};
 const pairs=['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:'ja-'+locale,targetLanguage:'ja',explanationLanguage:locale,version:'3.0.0',studyVersion:'3.0.0',license:core.license,entries:[{id:'japan',meaning:locale==='en'?'Japan':'일본'},{id:'okay',meaning:locale==='en'?'A great man.':'대장부.',exampleTranslation:locale==='en'?'A great man.':'대장부예요.'}]}));
 const prepared=prepareJapaneseReview(core,...pairs),decisions=prepared.map(row=>({index:row.index,id:row.id,digest:row.digest,decision:row.index?'correct':'retain',reason:row.index?'Correct the adjective meaning, reading and example translation.':'Japanese word and both meanings agree.',evidence:row.index?[proof]:[]}));
 Object.assign(decisions[1],{en:'All right; safe.',ko:'괜찮은; 안전한.',pos:'adjective',pronunciation:'だいじょうぶ',aliases:['だいじょうぶ'],example:{text:'これで大丈夫です。',en:'This will be fine.',ko:'이것으로 괜찮아요.'}});
 return {core,pairs,decisions,sourceValidation:{checked:decisions.length,decisionDigest:decisionDigest(decisions),failures:[]},version:'4.0.0'};
}
const refresh=data=>{data.sourceValidation.checked=data.decisions.length;data.sourceValidation.decisionDigest=decisionDigest(data.decisions);return data;};
test('Japanese corrections preserve JLPT levels and unchanged entries while updating both meanings, readings and examples',()=>{
 const data=fixture(),before=structuredClone(data),{packages:[core,en,ko]}=compileMeaningCorrections(data);
 assert.deepEqual(data,before);assert.deepEqual(core.exam,data.core.exam);assert.deepEqual(core.entries[0],data.core.entries[0]);assert.equal(core.entries[1].level,'N4');assert.equal(core.entries[1].pronunciation,'だいじょうぶ');assert.deepEqual(core.entries[1].aliases,['だいじょうぶ']);assert.equal(core.entries[1].partOfSpeech,'adjective');
 assert.equal(en.entries[1].meaning,'All right; safe.');assert.equal(ko.entries[1].meaning,'괜찮은; 안전한.');assert.equal(en.entries[1].exampleTranslation,'This will be fine.');assert.equal(ko.entries[1].exampleTranslation,'이것으로 괜찮아요.');assert.equal(core.entries[1].example.source.license,'CC-BY-4.0');assert.equal(core.reviewInvalidations[0].id,'okay');
});
for(const [name,change] of [
 ['partial review',d=>d.decisions.pop()],['unresolved hold',d=>d.decisions[1].decision='hold'],['missing Korean meaning',d=>delete d.decisions[1].ko],['retained entry with edits',d=>d.decisions[0].ko='수정'],['unbound reading',d=>d.core.entries[0].pronunciation='にっぽん'],['unbound level',d=>d.core.entries[0].level='N1'],['bad example focus',d=>d.decisions[1].example.focus={text:'大丈夫',start:0}],['incomplete bilingual example',d=>delete d.decisions[1].example.ko],
])test('Japanese correction compiler rejects '+name,()=>{const data=fixture();change(data);refresh(data);assert.throws(()=>compileMeaningCorrections(data));});
test('Japanese new-concept replacement requires a matching replacement example and new identity',()=>{
 const data=fixture();data.decisions[1].decision='replace';refresh(data);const {packages:[core,en,ko]}=compileMeaningCorrections(data);const replacement=core.entries[1];assert.match(replacement.id,/^ja-lex-/);assert.notEqual(replacement.id,'okay');assert.equal(core.retiredEntries[0].sameConcept,undefined);assert.equal(en.entries[1].id,replacement.id);assert.equal(ko.entries[1].id,replacement.id);
 delete data.decisions[1].example;refresh(data);assert.throws(()=>compileMeaningCorrections(data),/replacement examples/);
});
test('Japanese full review binds all 12,027 current entries to exact readings, meanings and examples',async()=>{
 const {readFile}=await import('node:fs/promises');const json=async name=>JSON.parse(await readFile(new URL('../language-packages/'+name,import.meta.url),'utf8'));
 const entries=prepareJapaneseReview(await json('ja-core-3.0.0.json'),await json('ja-en-3.0.0.json'),await json('ja-ko-3.0.0.json'));
 assert.equal(entries.length,12027);assert.equal(entries.filter(row=>row.examples.length).length,2027);assert.ok(entries.every(row=>row.en&&row.ko&&row.digest.length===64));
 assert.throws(()=>validateJapaneseDecisions(entries,[]),/Incomplete/);
});

test('a Japanese part-of-speech correction preserves the existing reading unless explicitly changed',()=>{
 const data=fixture();delete data.decisions[1].pronunciation;delete data.decisions[1].aliases;refresh(data);
 const entry=compileMeaningCorrections(data).packages[0].entries[1];assert.equal(entry.pronunciation,data.core.entries[1].pronunciation);assert.deepEqual(entry.aliases,data.core.entries[1].aliases);
});
test('a Japanese replacement or changed headword requires an explicitly checked reading',()=>{
 for(const field of ['decision','word']){const data=fixture();data.decisions[1][field]=field==='decision'?'replace':'別語';delete data.decisions[1].pronunciation;refresh(data);assert.throws(()=>compileMeaningCorrections(data),/explicit replacement reading/);}
});
