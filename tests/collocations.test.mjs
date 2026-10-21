import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCollocations,validateCollocationTranslations,assembleCollocations} from '../web/js/packages/collocations.js';
import {createVocabularyEngine,validVocabularyQuestion} from '../web/js/shared/vocabulary.js';
import {renderCollocations,collocationPreview} from '../web/js/shared/collocation-view.js';
import {createVocabularyReview} from '../web/js/shared/vocabulary-review.js';
const core={kind:'study',entries:[{id:'word',collocations:[{id:'de-collocation-001',phrase:'eine Entscheidung treffen',type:'verb-phrase',example:'Wir müssen heute eine Entscheidung treffen.',acceptedAnswers:['eine Entscheidung fällen']}]}]};
const pair={kind:'explanation',entries:[{id:'word',collocations:[{id:'de-collocation-001',meaning:'make a decision',exampleTranslation:'We need to make a decision today.',meaningChoices:['make a decision','drink tea','ask a question']}]}]};
const word=()=>({id:'word',lemma:'Entscheidung',article:'die',pos:'noun',studyMeaning:'decision',studyExplanationLanguage:'en',collocations:assembleCollocations(core.entries[0],pair.entries[0])});
test('collocations require compatible independently translated identities and safe bounded data',()=>{
 validateCollocations(core);validateCollocations(pair);validateCollocationTranslations(core.entries[0],pair.entries[0]);
 for(const edit of [p=>p.entries[0].collocations[0].meaning='leaked translation',p=>p.entries[0].collocations.push(p.entries[0].collocations[0]),p=>p.entries[0].collocations[0].phrase='',p=>delete p.entries[0].collocations[0].id]){const p=structuredClone(core);edit(p);assert.throws(()=>validateCollocations(p),/Invalid language package/);}
 assert.throws(()=>validateCollocationTranslations(core.entries[0],{collocations:[]}),/incomplete/);
});
test('default German input policy cannot force a noun article onto a collocation',()=>{
 const engine=createVocabularyEngine({gradeInput(){throw new Error('Regular noun grading must not run');}}),q=engine.createVocabularyPool('vocabinput',[word()],'en','collocations').choose();
 assert.ok(engine.vocabularyAnswerCorrect(q,'eine Entscheidung treffen'));assert.ok(engine.vocabularyAnswerCorrect(q,'Eine Entscheidung fällen'));assert.ok(!engine.vocabularyAnswerCorrect(q,'die Entscheidung'));assert.ok(validVocabularyQuestion(q));
 const review=createVocabularyReview({requiresNounArticle:()=>true,vocabularyInputAnswer:()=> 'die Entscheidung'})({mode:'vocabinput',question:q,word:q.word,locale:'en'});assert.equal(review.requiresArticle,false);assert.equal(review.correctAnswer,q.answer);
});
test('meaning options are all phrase meanings and grade using existing Review-compatible IDs',()=>{
 const engine=createVocabularyEngine(),q=engine.createVocabularyPool('vocabmeaning',[word()],'en','collocations').choose();assert.equal(q.prompt,'eine Entscheidung treffen');assert.ok(q.options.every(row=>row.type===q.type));assert.ok(engine.vocabularyAnswerCorrect(q,'word'));assert.ok(validVocabularyQuestion(q));assert.equal(q.options.find(row=>row.id==='word').text,'make a decision');
});
test('word details and list preview escape phrase text while keeping explanation language separate',()=>{
 const w=word();w.collocations[0].phrase='<script>alert(1)</script>';const html=renderCollocations(w,'ko');assert.match(html,/연어/);assert.match(html,/make a decision/);assert.ok(!html.includes('<script>'));assert.match(collocationPreview(w),/&lt;script&gt;/);
});
test('old packages without collocations remain usable and do not fabricate data',()=>{
 const engine=createVocabularyEngine();assert.equal(engine.createVocabularyPool('vocabinput',[{id:'x',lemma:'old',pos:'noun',studyMeaning:'old'}],'en','collocations').choose(),undefined);assert.equal(renderCollocations({}),'');assert.equal(collocationPreview({}),'');
});

test('every language starter spans its existing study levels without changing anchor IDs',async()=>{
 const {readFile}=await import('node:fs/promises'),read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
 const source=await read('language-packages/sources/exercises/collocations.json'),catalog=await read('language-packages/catalog.json');
 assert.deepEqual(Object.keys(source.languages).sort(),['de','en','es','fr','ja','ko','zh']);
 for(const [language,rows] of Object.entries(source.languages)){
  const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1)),byId=new Map(core.entries.map(row=>[row.id,row])),covered=new Set();
  for(const row of rows){assert.equal(byId.get(row.entryId)?.word,row.anchor);assert.ok(row.phrase.includes(row.anchor));assert.ok(row.meaning.en&&row.meaning.ko&&row.exampleTranslation.en&&row.exampleTranslation.ko);covered.add(byId.get(row.entryId).level);}
  assert.deepEqual([...covered].sort(),[...new Set(core.entries.map(row=>row.level))].sort(),language);
 }
});

test('Chinese and German word search includes the studied collocation text',async()=>{
 const {matchesWordSearch,wordSearchQuery}=await import('../web/languages/zh/js/services/word-search.js');assert.ok(matchesWordSearch({hanzi:'电话',collocations:[{phrase:'打电话',meaning:'make a phone call'}]},wordSearchQuery('打电话')));
 const {dictionaryEntries}=await import('../web/languages/de/js/core/dictionary.js');const w={...word(),cefr:'A1',meaning_en:['decision'],meaning_ko:[]};assert.equal(dictionaryEntries([w],{query:'eine Entscheidung treffen'}).length,1);
});
