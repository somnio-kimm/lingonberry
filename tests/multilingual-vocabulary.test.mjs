import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {studyProfiles,studyWords,displayStudyWord,matchesStudyLevel} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const catalog=await read('web/catalog.json');
for(const language of Object.keys(studyProfiles)){
 const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1));
 test(`${language}: typed recall and meaning choices preserve the selected sense and part of speech`,async()=>{
  const pair=await read(catalog.find(row=>row.id===language+(language==='ko'?'-en':'-ko')).url.slice(1));
  const rows=new Map(pair.entries.map(row=>[row.id,row]));
  const words=studyWords({...core,explanationLanguage:'ko',entries:core.entries.map(row=>({...row,...rows.get(row.id)}))});
  const engine=createLexiconQuestions(studyProfiles[language]);
  for(const q of engine.vocabularyQuestions('vocabinput',words))assert.equal(engine.vocabularyAnswerCorrect(q,q.answer),true);
  const questions=engine.vocabularyQuestions('vocabmeaning',words);
  assert.ok(questions.length>20);
  for(const q of questions){assert.ok(q.options.every(option=>option.type===q.type));assert.equal(engine.vocabularyAnswerCorrect(q,q.word.id),true);assert.equal(engine.vocabularyAnswerCorrect(q,'invalid'),false);}
 });
}
test('French elision, Spanish articles and Japanese readings are accepted deliberately',()=>{
 const word={id:'x',lemma:'écueil',pos:'noun',article:"l'"};
 const engine=createLexiconQuestions(studyProfiles.fr),q={mode:'vocabinput',word,answer:"l'écueil"};
 assert.equal(displayStudyWord(word),"l'écueil");assert.equal(engine.vocabularyAnswerCorrect(q,'l’écueil'),true);assert.equal(engine.vocabularyAnswerCorrect(q,'écueil'),false);
 const ja=createLexiconQuestions(studyProfiles.ja);assert.equal(ja.vocabularyAnswerCorrect({mode:'vocabinput',word:{lemma:'読む',aliases:['よむ']},answer:'読む'},'よむ'),true);
});
test('review counts and progress stay isolated by language and reset is transactional',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const ja=createLexiconStore(storage,studyProfiles.ja),ko=createLexiconStore(storage,studyProfiles.ko);
 const q={mode:'vocabinput',id:'word:en',locale:'en',word:{id:'word'}};
 ja.record(q,'bad',false);assert.equal(Object.values(ja.state.wrongs)[0].count,1);assert.deepEqual(ko.state.wrongs,{});
 ja.record(q,'right',true,true);assert.equal(Object.values(ja.state.wrongs)[0].count,0);
 ja.preference('autoRemoveResolvedWrongs',true);assert.deepEqual(ja.state.wrongs,{});
 ja.setWordStatus('word','mastered');storage.setItem=()=>{throw new Error('quota');};assert.throws(()=>ja.reset());assert.equal(ja.wordStatus('word'),'mastered');
});

test('English filters use discrete IELTS groups',()=>{assert.equal(matchesStudyLevel({level:'IELTS 7.0–8.0'},'IELTS 4.0–6.5',studyProfiles.en),false);assert.equal(matchesStudyLevel({level:'IELTS 7.0–8.0'},'IELTS 7.0–8.0',studyProfiles.en),true);assert.equal(matchesStudyLevel({level:'IELTS 8.5–9.0'},'all',studyProfiles.en),false);});
