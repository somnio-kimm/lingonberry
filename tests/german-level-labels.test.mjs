import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STUDY_LEVELS,studyLevelLabel,normaliseStudyLevel} from '../web/languages/de/js/app-definition.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {dictionaryEntries} from '../web/languages/de/js/core/dictionary.js';
import {filterWrongEntries} from '../web/languages/de/js/core/wrong.js';

test('all six German levels use GZ labels without renaming source IDs',()=>{
 assert.deepEqual(STUDY_LEVELS.map(level=>[level.id,level.label]),['A1','A2','B1','B2','C1','C2'].map(id=>[id,'GZ '+id]));
 assert.equal(studyLevelLabel('C1'),'GZ C1');assert.equal(studyLevelLabel('reference'),'reference');
});

test('upper sections and Review filters are separate, with alphabetical vocabulary order',()=>{
 const words=[['B2','Zebra'],['C1','Mitte'],['C2','Seltenheit'],['B2','Apfel'],['A1','Haus']].map(([cefr,lemma])=>({id:lemma,sense_id:lemma,cefr,lemma,pos:'noun',meaning_en:[],meaning_ko:[]}));
 const original=structuredClone(words),rows=words.map(word=>({unit:{level:word.cefr},word,type:'noun',quizMode:'vocabinput'}));
 assert.deepEqual(dictionaryEntries(words,{level:'B2'}).map(word=>word.lemma),['Apfel','Zebra']);
 assert.deepEqual(dictionaryEntries(words,{level:'C1'}).map(word=>word.lemma),['Mitte']);
 assert.deepEqual(dictionaryEntries(words,{level:'C2'}).map(word=>word.lemma),['Seltenheit']);
 assert.equal(filterWrongEntries(rows,{level:'B2'}).length,2);
 assert.equal(filterWrongEntries(rows,{level:'C1'}).length,1);
 assert.equal(filterWrongEntries(rows,{level:'C2'}).length,1);
 assert.deepEqual(words,original);
});

test('combined selections reopen at B2 without changing individual selections or progress',()=>{
 for(const previous of ['A2','B2','C1','C2','B2-C2']){
  const saved={version:1,units:{},concepts:{},preferences:{studyLevel:previous},wordStatus:{word:'mastered'},quizAnswers:{vocabinput:{q:{level:'C1',attempts:[{correct:false,input:'old answer'}]}}}};
  let stored=JSON.stringify(saved);const storage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
  const store=createStore(storage),expected=previous==='B2-C2'?'B2':previous;
  assert.equal(normaliseStudyLevel(previous),expected);assert.equal(store.state.preferences.studyLevel,expected);
  assert.equal(store.wordStatus('word'),'mastered');assert.deepEqual(store.state.quizAnswers.vocabinput,saved.quizAnswers.vocabinput);
  store.preference('studyLevel',expected);assert.equal(createStore(storage).state.preferences.studyLevel,expected);
 }
});

test('all upper-level entries retain the documented frequency split, including rare academic terms',async()=>{
 const core=JSON.parse(await readFile(new URL('../language-packages/de-core-3.0.0.json',import.meta.url),'utf8'));
 const counts={B2:0,C1:0,C2:0};
 for(const word of core.entries.filter(word=>Object.hasOwn(counts,word.level))){
  const frequency=word.grammar.level_evidence.frequency;
  assert.equal(typeof frequency,'number',word.word);
  assert.equal(word.level,frequency>=4?'B2':frequency>=3?'C1':'C2',word.word);
  counts[word.level]++;
 }
 assert.deepEqual(counts,{B2:662,C1:2007,C2:5599});
 for(const lemma of ['epistemisch','teleologisch','heuristisch','inkommensurabel'])assert.equal(core.entries.find(word=>word.word===lemma)?.level,'C2',lemma);
});
