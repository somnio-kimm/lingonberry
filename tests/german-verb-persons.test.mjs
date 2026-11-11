import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONS,VERB_FORMS,verbFormQuestions,validGrammarQuestion,snapshotGrammarQuestion} from '../web/languages/de/js/core/grammar-quizzes.js';
import {validatePackage} from '../web/js/packages/schema.js';
import {fixture} from './package-fixture.js';
const forms=values=>Object.fromEntries(PERSONS.map((person,i)=>[person,values[i]]));
const auxiliaries=[
 {id:'have',lemma:'haben',pos:'verb',forms:{praesens:forms(['habe','hast','hat','haben','habt','haben']),praeteritum:forms(['hatte','hattest','hatte','hatten','hattet','hatten'])}},
 {id:'be',lemma:'sein',pos:'verb',forms:{praesens:forms(['bin','bist','ist','sind','seid','sind']),praeteritum:forms(['war','warst','war','waren','wart','waren'])}},
];
const event=()=>({id:'event',lemma:'geschehen',pos:'verb',cefr:'B1',meaning_en:['happen'],meaning_ko:['일어나다'],infinitive:'geschehen',forms:{praesens:{er:'geschieht',sie:'geschehen'},praeteritum:{er:'geschah',sie:'geschahen'},konjunktiv_ii:{er:'geschähe',sie:'geschähen'},perfekt:'ist geschehen'},verb_persons:['er','sie']});

test('declared German person restriction applies to all seven simple and derived tenses',()=>{
 const word=event(),questions=verbFormQuestions([word],auxiliaries);
 assert.equal(questions.length,14);
 for(const tense of VERB_FORMS)assert.deepEqual(questions.filter(q=>q.tense===tense).map(q=>q.person),['er','sie']);
 assert.equal(questions.find(q=>q.tense==='perfekt'&&q.person==='er').answer,'ist geschehen');
 assert.equal(questions.find(q=>q.tense==='futur_ii'&&q.person==='sie').answer,'werden geschehen sein');
});

test('partial finite data without a declared restriction retains all six derived-person questions',()=>{
 const word={...event(),id:'work',lemma:'arbeiten',infinitive:'arbeiten',forms:{perfekt:'hat gearbeitet'}};delete word.verb_persons;
 const questions=verbFormQuestions([word],auxiliaries);
 assert.equal(questions.length,24);
 for(const tense of ['perfekt','plusquamperfekt','futur_i','futur_ii'])assert.deepEqual(questions.filter(q=>q.tense===tense).map(q=>q.person),PERSONS);
});

test('snapshots retain a detached person constraint and reject a mismatched saved question',()=>{
 const word=event(),q=verbFormQuestions([word],auxiliaries)[0],snapshot=snapshotGrammarQuestion(q);
 assert.deepEqual(snapshot.word.verb_persons,['er','sie']);assert.notEqual(snapshot.word.verb_persons,word.verb_persons);
 assert.equal(validGrammarQuestion(snapshot),true);assert.equal(validGrammarQuestion({...snapshot,person:'ich'}),false);
 word.verb_persons.push('ich');assert.deepEqual(snapshot.word.verb_persons,['er','sie']);
});

test('German package constraints require a nonempty unique known-person list on a verb',()=>{
 const entry={id:'event',word:'geschehen',partOfSpeech:'verb',grammar:{verb_persons:['er','sie']}};
 assert.doesNotThrow(()=>validatePackage(fixture({entries:[entry]}).data));
 for(const value of [null,[],['er','er'],['third-person'],'er'])assert.throws(()=>validatePackage(fixture({entries:[{...entry,grammar:{verb_persons:value}}]}).data),/Invalid language package/);
 assert.throws(()=>validatePackage(fixture({entries:[{...entry,partOfSpeech:'noun'}]}).data),/Invalid language package/);
});
