import test from 'node:test';
import assert from 'node:assert/strict';
import {compileExamples} from '../scripts/content/compile-examples.mjs';
const license={identifier:'CC-BY-SA-4.0',notice:'Original dictionary attribution.',links:[]};
const core={schemaVersion:2,kind:'study',id:'fr-core',targetLanguage:'fr',version:'2.0.0',license,entries:[{id:'book',word:'livre',partOfSpeech:'noun',level:'A1',article:'la',grammar:{gender:'feminine'},exampleStatus:'bilingual-example-pending'}]};
const pairs=['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:'fr-'+locale,targetLanguage:'fr',explanationLanguage:locale,version:'2.0.0',studyVersion:'2.0.0',license,entries:[{id:'book',meaning:locale==='en'?'wrong sense':'잘못된 뜻'}]}));
const provenance={kind:'app-authored',license:'CC-BY-4.0',review:'editorial-draft; native-speaker-review-pending'};
const authored=[{id:'book',text:'Je lis un livre.',en:'I am reading a book.',ko:'나는 책을 읽고 있어요.',focus:{text:'livre'},provenance}];
const corrections=[{id:'book',article:'le',grammar:{gender:'masculine'},meaningEn:'book',meaningKo:'책',reason:'Fix the selected sense and article.',provenance:{license:'CC-BY-SA-4.0'}}];
test('new examples and corrections compile into independent complete explanation packages',()=>{
 const [study,en,ko]=compileExamples({core,pairs,authored,corrections,version:'3.0.0'});assert.equal(study.version,'3.0.0');assert.equal(study.entries[0].article,'le');assert.equal(study.entries[0].example.translations,undefined);assert.equal(en.entries[0].meaning,'book');assert.equal(ko.entries[0].exampleTranslation,'나는 책을 읽고 있어요.');assert.equal(study.contentReview.examplesPending,0);assert.match(study.license.notice,/Original dictionary attribution/);assert.equal(core.entries[0].article,'la');assert.equal(pairs[0].entries[0].meaning,'wrong sense');
});
test('new editions cannot reuse the old version or silently keep stale translations',()=>{
 assert.throws(()=>compileExamples({core,pairs,authored,version:'2.0.0'}),/immutable/);
 assert.throws(()=>compileExamples({core,pairs,authored:[{...authored[0],ko:undefined}],version:'3.0.0'}),/Missing ko/);
 assert.throws(()=>compileExamples({core,pairs,authored:[],corrections,version:'3.0.0'}),/matched replacement/);
 assert.throws(()=>compileExamples({core,pairs,authored,corrections:[{...corrections[0],meaningKo:undefined}],version:'3.0.0'}),/corrected ko/);
});
test('mixed source reuse preserves creators and source licences in examples and translations',()=>{
 const source={creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0',url:'https://en.wiktionary.org/wiki/livre'};
 const record={...authored[0],provenance:{kind:'licensed-adaptation',license:'CC-BY-SA-4.0',creator:'Credited source and translation editors',sources:[source],changes:'Original translation and punctuation adjustment',review:'AI-editorial-checked; native-speaker-review-pending'}};
 const [study,en]=compileExamples({core,pairs,authored:[record],corrections,version:'3.0.0'});
 assert.deepEqual(study.entries[0].example.provenance,record.provenance);
 assert.deepEqual(en.entries[0].exampleTranslationProvenance,record.provenance);
 assert.match(study.license.notice,/Source-derived examples and adaptations retain their own source licences/);
 assert.match(study.license.notice,/Original dictionary attribution/);
});
