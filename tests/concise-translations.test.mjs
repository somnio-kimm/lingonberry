import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {prepareConciseChanges,compileConcisePair,sourceEquivalent} from '../scripts/content/concise-translations.mjs';
const provenance={creator:'National Institute of Korean Language',license:'CC-BY-SA-2.0-KR',entryId:'123',senseId:'1',sourceWord:'자동차',url:'https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=123'};
const sense={id:'123',sense:'1',word:'자동차',definition:'엔진의 힘으로 도로 위를 움직이는 차.',equivalents:{en:{lemma:'car',definition:'A vehicle powered by an engine.'}}};
const nikl=new Map([['123:1',sense]]);
function input(language='ja',locale='ko'){
 const core=fixture({id:language+'-core',targetLanguage:language,entries:[{id:'car',word:language==='ja'?'車':'car',partOfSpeech:'noun',example:{text:'車を買いました。'}}]}).data;
 const pair=explanationFixture(core,locale,{entries:[{id:'car',meaning:locale==='ko'?sense.definition:sense.equivalents.en.definition,provenance,exampleTranslation:locale==='ko'?'차를 샀어요.':'I bought a car.'}]}).data;
 return {core,pair};
}
test('car displays 자동차 / car from the exact source equivalent instead of a vehicle definition',()=>{
 for(const [locale,meaning]of [['ko','자동차'],['en','car']]){
  const {core,pair}=input('ja',locale),changes=prepareConciseChanges(core,pair,nikl),updated=compileConcisePair(core,pair,changes,'1.1.0');
  assert.equal(updated.entries[0].meaning,meaning);assert.equal(changes[0].sourceRef,'123:1');assert.equal(pair.entries[0].meaning,locale==='ko'?sense.definition:sense.equivalents.en.definition);assert.equal(updated.studyVersion,core.version);
  assert.equal(updated.entries[0].exampleTranslation,pair.entries[0].exampleTranslation);assert.deepEqual(updated.entries[0].provenance,provenance);assert.match(updated.license.notice,/National Institute of Korean Language/);
 }
});
test('English-to-English retains dictionary definitions, even when a short source equivalent exists',()=>{
 const {core,pair}=input('en','en');assert.deepEqual(prepareConciseChanges(core,pair,nikl),[]);assert.throws(()=>compileConcisePair(core,pair,[],'1.1.0'),/Same-language/);
});
test('sense identifiers distinguish running from jumping; corrected definitions are protected',()=>{
 const running={...sense,sense:'2',word:'뛰다',definition:'빨리 움직이다.',equivalents:{en:{lemma:'run',definition:'To move quickly on foot.'}}},jumping={...running,sense:'1',equivalents:{en:{lemma:'jump',definition:'To leap into the air.'}}},index=new Map([['456:1',jumping],['456:2',running]]);
 const entry={meaning:running.equivalents.en.definition,provenance:{...provenance,entryId:'456',senseId:'2',sourceWord:'뛰다'}};
 assert.equal(sourceEquivalent(entry,'en',index).meaning,'run');assert.equal(sourceEquivalent({...entry,meaning:'To run for elected office.'},'en',index),undefined);
 assert.equal(sourceEquivalent({...entry,provenance:{...entry.provenance,sourceWord:'다른 단어'}},'en',index),undefined);
});
test('Japanese source-script glosses and a literal bird sense cannot replace an English figurative-person meaning',()=>{
 const {core,pair}=input('ja','en');pair.entries[0].meaning='A person who recovers from great adversity like a phoenix.';pair.entries[0].provenance={kind:'licensed-adaptation',sources:[{kind:'wiktionary',edition:'ja',glosses:['死んでも蘇る鳥。']},{kind:'wiktionary',edition:'en',glosses:['a phoenix (mythological bird)']}]};
 assert.deepEqual(prepareConciseChanges(core,pair,nikl),[]);
});
test('explicit Japanese editorial equivalents bind both old meanings and the unchanged headword',()=>{
 const {core,pair}=input(),edit={id:'car',word:'車',before:{ko:pair.entries[0].meaning,en:'Original English definition'},ko:'자동차',en:'car'};
 assert.equal(prepareConciseChanges(core,pair,nikl,[edit])[0].method,'editorial-equivalent');
 assert.throws(()=>prepareConciseChanges(core,pair,nikl,[{...edit,word:'別語'}]),/Stale/);assert.throws(()=>prepareConciseChanges(core,pair,nikl,[{...edit,before:{ko:'Stale'}}]),/Stale/);
});
test('new explanation versions cannot overwrite editions, accept stale edits or retain a long overriding meanings array',()=>{
 const {core,pair}=input();pair.entries[0].meanings=[pair.entries[0].meaning];const changes=prepareConciseChanges(core,pair,nikl);
 assert.equal(compileConcisePair(core,pair,changes,'1.1.0').entries[0].meanings,undefined);
 assert.throws(()=>compileConcisePair(core,pair,changes,'1.0.0'),/immutable version/);assert.throws(()=>compileConcisePair(core,pair,[{...changes[0],before:'Stale'}],'1.1.0'),/stale/);assert.throws(()=>compileConcisePair(core,pair,[...changes,...changes],'1.1.0'),/duplicate/);
});
