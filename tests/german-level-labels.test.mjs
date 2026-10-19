import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDY_LEVELS,studyLevelLabel,studyLevelGroup} from '../web/languages/de/js/app-definition.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {dictionaryEntries} from '../web/languages/de/js/core/dictionary.js';
import {filterWrongEntries} from '../web/languages/de/js/core/wrong.js';

test('Goethe word-list groups use GZ labels without renaming stored level IDs',()=>{
 assert.deepEqual(STUDY_LEVELS.slice(0,3).map(level=>[level.id,level.label]),[['A1','GZ A1'],['A2','GZ A2'],['B1','GZ B1']]);
 assert.equal(studyLevelLabel('A2'),'GZ A2');
 assert.equal(studyLevelLabel('reference'),'reference');
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const store=createStore(storage);store.preference('studyLevel','A2');store.setWordStatus('de-haus','mastered');
 const restored=createStore(storage);
 assert.equal(restored.state.preferences.studyLevel,'A2');
 assert.equal(restored.wordStatus('de-haus'),'mastered');
});

test('B2 through C2 share one visible group while source levels remain intact',()=>{
 assert.deepEqual(STUDY_LEVELS.map(level=>level.label),['GZ A1','GZ A2','GZ B1','GZ B2-C2']);
 for(const level of ['B2','C1','C2','B2-C2']){
  assert.equal(studyLevelGroup(level),'B2-C2');assert.equal(studyLevelLabel(level),'GZ B2-C2');
 }
 const words=[['B2','Zebra'],['C1','Apfel'],['C2','Mitte'],['A1','Haus']].map(([cefr,lemma])=>({id:lemma,sense_id:lemma,cefr,lemma,pos:'noun',meaning_en:[],meaning_ko:[]}));
 const original=structuredClone(words);
 assert.deepEqual(dictionaryEntries(words,{level:'B2-C2'}).map(word=>word.lemma),['Apfel','Mitte','Zebra']);
 assert.deepEqual(dictionaryEntries(words,{level:'C1'}).map(word=>word.lemma),['Apfel','Mitte','Zebra']);
 const rows=words.map(word=>({unit:{level:word.cefr},word,type:'noun',quizMode:'vocabinput'}));
 assert.equal(filterWrongEntries(rows,{level:'B2-C2'}).length,3);
 assert.deepEqual(words,original);
});

test('saved upper-level selections migrate without changing word status or attempt history',()=>{
 for(const previous of ['B2','C1','C2']){
  const saved={version:1,units:{},concepts:{},preferences:{studyLevel:previous},wordStatus:{word:'mastered'},quizAnswers:{vocabinput:{q:{level:previous,attempts:[{correct:false,input:'old answer'}]}}}};
  const storage={getItem:()=>JSON.stringify(saved),setItem:()=>{}};
  const store=createStore(storage);
  assert.equal(store.state.preferences.studyLevel,'B2-C2');
  assert.equal(store.wordStatus('word'),'mastered');
  assert.deepEqual(store.state.quizAnswers.vocabinput,saved.quizAnswers.vocabinput);
  store.preference('studyLevel','B2-C2');
 }
});
