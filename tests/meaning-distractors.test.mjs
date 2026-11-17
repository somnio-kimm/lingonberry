import test from 'node:test';
import assert from 'node:assert/strict';
import {createVocabularyEngine} from '../web/js/shared/vocabulary.js';
import {readChoiceInitial} from '../web/js/shared/meaning-distractors.js';
const makeWord=(id,meaning,pos='noun')=>({id,lemma:id,pos,studyMeaning:meaning,studyExplanationLanguage:'en'});
function createSeededRandom(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};}
function hasOutlier(options){const counts=new Map();for(const option of options){const key=readChoiceInitial(option.text);counts.set(key,(counts.get(key)||0)+1);}return options.length>=3&&counts.size>1&&Math.max(...counts.values())===options.length-1;}
const clustered=[makeWord('target','One urgent request for help.'),makeWord('t1','The surface beside a river.'),makeWord('t2','The building used for storage.'),makeWord('t3','The money paid for a service.'),makeWord('a','A room used for meetings.'),makeWord('b','Birds that migrate each winter.'),makeWord('c','Clothing worn during winter.')];
test('three neighbouring T definitions cannot reveal the O answer by its initial',()=>{
 const before=structuredClone(clustered),engine=createVocabularyEngine();
 for(let seed=1;seed<=100;seed++){const question=engine.createVocabularyPool('vocabmeaning',clustered).all(createSeededRandom(seed)).find(q=>q.word.id==='target');assert.equal(question.options.length,4);assert.equal(hasOutlier(question.options),false);assert.ok(question.options.every(option=>option.type==='noun'));}
 assert.deepEqual(clustered,before);
});
test('sparse pools use a balanced smaller set instead of three matching wrong starts',()=>{
 const question=createVocabularyEngine().createVocabularyPool('vocabmeaning',clustered.slice(0,4)).all(()=>0).find(q=>q.word.id==='target');assert.equal(question.options.length,2);assert.equal(hasOutlier(question.options),false);
});
test('same-style definitions retain four choices, and two-pair initial distributions remain usable',()=>{
 for(const meanings of [['The first thing.','The next object.','The other item.','The final thing.'],['A first object.','Another object.','Basic item one.','Basic item two.']]){
  const words=meanings.map((meaning,i)=>makeWord(String(i),meaning));const questions=createVocabularyEngine().createVocabularyPool('vocabmeaning',words).all(()=>.25);assert.ok(questions.every(q=>q.options.length===4&&!hasOutlier(q.options)));
 }
});
test('similar-length meanings are preferred over three conspicuously short alternatives',()=>{
 const target=makeWord('target','One deliberate request for urgent help.'),short=[makeWord('t1','The cat.'),makeWord('t2','The hat.'),makeWord('t3','The bat.')],similar=[makeWord('a','A sudden change in the direction of travel.'),makeWord('b','Building material made from sand and lime.'),makeWord('c','Clothing that protects people from the rain.')];
 const q=createVocabularyEngine().createVocabularyPool('vocabmeaning',[target,...short,...similar]).all(()=>0).find(q=>q.word.id==='target');assert.deepEqual(new Set(q.options.map(row=>row.id)),new Set(['target','a','b','c']));
});
test('wrong choices come from across the pool and vary while retaining distinct headwords',()=>{
 const words=Array.from({length:200},(_,i)=>makeWord('word'+i,'The distinctive item numbered '+i+'.')),engine=createVocabularyEngine(),pool=engine.createVocabularyPool('vocabmeaning',words),sets=new Set();
 for(let seed=1;seed<=20;seed++){const q=pool.all(createSeededRandom(seed)).find(q=>q.word.id==='word0');sets.add(q.options.filter(row=>row.id!=='word0').map(row=>row.id).sort().join(','));assert.equal(new Set(q.options.map(row=>row.id)).size,4);}
 assert.ok(sets.size>15);
});
test('known alternate senses and repeated wrong-headword senses remain excluded',()=>{
 const target=makeWord('target','One request for help.'),alias={...makeWord('alias','A legal challenge.'),lemma:'target'},sameMeaning=makeWord('valid-meaning','A legal challenge.'),peers=[...clustered.slice(1),makeWord('t1-other','Another sense of the same word.')];peers.at(-1).lemma='t1';const selected=[target,sameMeaning,...peers],pool=createVocabularyEngine().createVocabularyPool('vocabmeaning',selected,'en','vocabulary',{meaningWords:[...selected,alias]});
 const q=pool.all(createSeededRandom(25)).find(q=>q.word.id==='target');assert.ok(q);{assert.ok(!q.options.some(row=>row.id==='valid-meaning'));const lemmas=q.options.map(option=>selected.find(row=>row.id===option.id).lemma);assert.equal(new Set(lemmas).size,lemmas.length);}
});
for(const [text,expected]of [['  The meaning.','t'],['(Other meaning)','o'],['　学校','学'],['— 요금','요']])test(`visible initial is normalised for ${text}`,()=>assert.equal(readChoiceInitial(text),expected));
test('one question samples a large eligible pool without shuffling every entry',()=>{
 const words=Array.from({length:10000},(_,i)=>makeWord('word'+i,'The item numbered '+i+'.')),pool=createVocabularyEngine().createVocabularyPool('vocabmeaning',words);let calls=0;const q=pool.choose(undefined,()=>{calls++;return .4;});assert.ok(q);assert.equal(q.options.length,4);assert.ok(calls<100,`Unexpected full-pool randomisation: ${calls} calls`);
});

test('a unique opening word is not exposed by three other openings with the same initial',()=>{
 const words=[makeWord('target','That which serves a useful purpose.'),makeWord('t1','The surface beside a river.'),makeWord('t2','The building used for storage.'),makeWord('t3','The money paid for a service.')],q=createVocabularyEngine().createVocabularyPool('vocabmeaning',words).all(()=>0).find(q=>q.word.id==='target');assert.equal(q.options.length,2);
});
