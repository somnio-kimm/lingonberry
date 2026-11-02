import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadingChoices,createReadingChoiceSampler} from '../web/js/shared/reading-choices.js';
const rows=['た','だ','ま','か','タ'].map((answer,i)=>({id:'read-'+i,entryId:'w'+i,route:'vocabinput',category:'reading',answer,instruction:'Type the reading.',acceptedAnswers:i===0?['だ']:[]}));
const words=rows.map((row,i)=>({id:row.entryId,pos:i===4?'noun':'verb'}));
test('reading choices exclude every accepted variant and require same word type for distractors',()=>{
 const choices=createReadingChoices(rows,words);assert.equal(choices.length,4);const first=choices.find(row=>row.entryId==='w0');assert.equal(first.route,'vocabmeaning');assert.ok(!first.options.includes('だ'));assert.ok(!first.options.includes('タ'));assert.equal(first.answer,'た');assert.equal(first.options.length,3);
});
test('do not invent reading choices with insufficient verified distractors',()=>{assert.deepEqual(createReadingChoices(rows.slice(0,1),words),[]);});
test('Korean explanation uses Korean instructions regardless of original imperative wording',()=>{const translated=rows.map(row=>({...row,instruction:'읽기를 적으세요.'}));assert.match(createReadingChoices(translated,words,'ko')[0].instruction,/선택/);});


test('Okurigana choices vary the same kanji boundary and include the requested 久い distractor',async()=>{
 const {createOkuriganaSpellingQuestion}=await import('../web/js/shared/japanese-reading.js');
 const entry={id:'hisashii',lemma:'久しい',pronunciation:'ひさしい',pos:'adjective',studyMeaning:'a long time'};
 const row=createOkuriganaSpellingQuestion(entry,'en'),choice=createReadingChoices([row],[entry])[0];
 assert.equal(choice.prompt,'ひさしい');assert.equal(choice.answer,'久しい');assert.ok(choice.options.includes('久い'));assert.equal(choice.options.length,4);assert.ok(choice.options.every(text=>text.startsWith('久')));assert.match(choice.instruction,/complete word/);
});
test('Okurigana choices never use recognised alternate spellings as wrong options',async()=>{
 const {createOkuriganaSpellingQuestion}=await import('../web/js/shared/japanese-reading.js');
 const entry={id:'act',lemma:'行う',pronunciation:'おこなう',pos:'verb'},kanji=new Map([['行',{kun:['おこな.う','おこ.なう']}]]);
 const row=createOkuriganaSpellingQuestion(entry,'ko',{kanji}),choice=createReadingChoices([row],[entry],'ko')[0];assert.ok(!choice.options.includes('行なう'));assert.match(choice.instruction,/단어 전체/);
});


test('fresh samples can reach beyond the first 128 readings without crossing part of speech',()=>{
 const inputs=Array.from({length:300},(_,i)=>({id:'noun-'+i,entryId:'noun-'+i,route:'vocabinput',category:'reading',answer:'よみ'+i}));
 const entries=inputs.map(row=>({id:row.entryId,pos:'noun'}));
 inputs.push({id:'verb',entryId:'verb',route:'vocabinput',category:'reading',answer:'はしる'});entries.push({id:'verb',pos:'verb'});
 const sample=createReadingChoiceSampler(inputs,entries),first=sample(inputs[0],()=>0),middle=sample(inputs[0],()=>.5);
 assert.ok(first.options.includes('よみ299'),'Late dictionary readings are eligible');assert.equal(first.options.length,4);assert.ok(!first.options.includes('はしる'));assert.notDeepEqual([...first.options].sort(),[...middle.options].sort());
 assert.ok(inputs.every(row=>row.options===undefined),'Sampling does not mutate prepared questions');
});
test('normalised accepted variants and duplicate kana readings never become wrong options',()=>{
 const answers=['た','だ','ダ','か','カ','ま'],inputs=answers.map((answer,i)=>({id:'q'+i,entryId:'w'+i,route:'vocabinput',category:'reading',answer,acceptedAnswers:i===0?['だ']:[]})),entries=inputs.map(row=>({id:row.entryId,pos:'verb'}));
 const sample=createReadingChoiceSampler(inputs,entries),question=sample(inputs[0],()=>0),fold=text=>text.normalize('NFKC').replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 assert.deepEqual(new Set(question.options.map(fold)),new Set(['た','か','ま']));
});
test('unknown or incompatible word types cannot fill a small reading-choice pool',()=>{
 const inputs=['verb','functional','unknown'].map((entryId,i)=>({id:entryId,entryId,route:'vocabinput',category:'reading',answer:['よむ','たべる','はしる'][i]}));
 const sample=createReadingChoiceSampler(inputs,[{id:'verb',pos:'verb'},{id:'functional',pos:'functional',subtype:'verb'},{id:'unknown'}]);assert.equal(sample(inputs[0]),undefined);
});
test('resampling leaves a saved question and its original options unchanged',()=>{
 const sample=createReadingChoiceSampler(rows,words),saved={...rows[0],route:'vocabmeaning',options:['た','ま','か']},before=structuredClone(saved);const fresh=sample(saved,()=>.5);assert.notEqual(fresh,saved);assert.deepEqual(saved,before);
});
test('all real Japanese reading choices use verified same-POS alternatives and exclude accepted variants',async()=>{
 const {readFile}=await import('node:fs/promises'),{assembleStudy}=await import('../web/js/packages/study.js'),{studyWords}=await import('../web/js/presentation/study-profiles.js'),{prepareLanguageExercises}=await import('../web/js/shared/exercise-pools.js'),{normaliseKana}=await import('../web/js/shared/japanese-reading.js');
 const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url))),study=assembleStudy(await read('language-packages/ja-core-4.4.0.json'),await read('language-packages/ja-en-4.5.0.json')),entries=studyWords(study),byId=new Map(entries.map(row=>[row.id,row])),exercises=prepareLanguageExercises(study,entries),pools=new Map();
 for(const row of exercises.filter(row=>row.category==='reading'&&row.route==='vocabinput')){const pos=byId.get(row.entryId).pos;if(!pools.has(pos))pools.set(pos,new Set());pools.get(pos).add(normaliseKana(row.answer));}
 assert.ok(pools.get('noun').size>1000,'The full noun pool remains available');let checked=0;
 for(const row of exercises.filter(row=>row.category==='reading'&&row.route==='vocabmeaning')){const pool=pools.get(byId.get(row.entryId).pos),keys=row.options.map(normaliseKana),accepted=new Set([row.answer,...(row.acceptedAnswers||[])].map(normaliseKana));assert.equal(new Set(keys).size,keys.length);assert.equal(keys.filter(key=>accepted.has(key)).length,1);assert.ok(keys.every(key=>accepted.has(key)||pool.has(key)),row.id);checked++;}
 assert.ok(checked>9000);
});
