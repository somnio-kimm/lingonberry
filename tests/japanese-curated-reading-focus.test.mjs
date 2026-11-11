import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {createExerciseQuestions,exerciseAnswerCorrect,isValidExerciseQuestion} from '../web/js/shared/language-exercises.js';
import {japaneseReadingPrompt} from '../web/js/shared/japanese-reading-prompt.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
import {renderExerciseReview} from '../web/js/shared/exercise-review-view.js';
import {validateExercises} from '../web/js/packages/exercises.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
const word={id:'pour',lemma:'注ぐ',pronunciation:'つぐ',language:'ja',pos:'verb',studyMeaning:'pour a drink',examples:[{text:'杯に酒を注いだ。',focus:{start:4,text:'注いだ'},studyTranslation:'I poured a drink into the cup.'}]};
const curated={id:'pour-past',entryId:'pour',route:'vocabinput',category:'reading',prompt:'杯に酒を注いだ。',readingFocus:{start:4,text:'注いだ'},answer:'ついだ',acceptedAnswers:['そそいだ'],context:'I poured a drink into the cup.'};
const policy={version:1,excludedSpellings:[],variants:[]};
const study={targetLanguage:'ja',explanationLanguage:'en',readingPractice:policy,exercises:[curated]};
const question=()=>createExerciseQuestions(prepareLanguageExercises(study,[word]),[word],'vocabinput','reading','en')[0];
test('curated inflected focus survives preparation and current quiz rendering with supplied readings',()=>{
 const q=question();assert.equal(q.prompt,'杯に酒を注いだ。');assert.deepEqual(q.readingFocus,{start:4,text:'注いだ'});assert.equal(q.answer,'ついだ');
 for(const answer of ['ついだ','そそいだ','ソソイダ'])assert.equal(exerciseAnswerCorrect(q,answer),true);
 for(const answer of ['つぐ','そそぐ','wrong'])assert.equal(exerciseAnswerCorrect(q,answer),false);
 const html=renderExercisePrompt(q);assert.match(html,/<span class="study-reading-target">注いだ<\/span>/);assert.match(html,/杯に酒を/);assert.match(html,/I poured a drink into the cup\./);assert.doesNotMatch(html,/ついだ|そそいだ|<rt>|vocab-instruction/);
});
test('saved Review renders its original inflected sentence, focus and translation after dictionary changes',()=>{
 const storage=new Map(),store=createLexiconStore({getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},studyProfiles.ja),q=question();store.record(q,'wrong',false);
 const saved=Object.values(store.state.wrongs)[0],before=JSON.stringify(saved),current={...word,studyMeaning:'new meaning',examples:[{text:'別の文。',studyTranslation:'A changed sentence.'}]};
 const html=renderExerciseReview(saved,{word:current,headword:'注ぐ',language:'ja',displayLanguage:'en',t:x=>x});
 assert.match(html,/<span class="study-reading-target">注いだ<\/span>/);assert.match(html,/I poured a drink into the cup\./);assert.doesNotMatch(html,/changed sentence/);assert.equal(JSON.stringify(saved),before);assert.equal(exerciseAnswerCorrect(saved.question,'そそいだ'),true);
});
for(const focus of [null,{}, {start:-1,text:'注いだ'},{start:4.5,text:'注いだ'},{start:99,text:'注いだ'},{start:4,text:'注ぐ'},{start:4,text:''},{start:4,text:42}])test(`malformed or stale explicit reading focus is withheld: ${JSON.stringify(focus)}`,()=>{
 const row={...curated,readingFocus:focus};const rows=prepareLanguageExercises({...study,exercises:[row]},[word]);assert.equal(rows.some(q=>q.category==='reading'),false,'Never fall back to a bare lemma with the inflected answer, including generated choices');
 const raw={...row,word,exercise:true};assert.equal(createExerciseQuestions([row],[word],'vocabinput','reading','en').length,0);assert.equal(exerciseAnswerCorrect(raw,'ついだ'),false);assert.equal(japaneseReadingPrompt(word,row.prompt,focus),undefined);
 assert.equal(isValidExerciseQuestion(raw),false);assert.equal(exerciseAnswerCorrect({...raw,options:[{id:'0',text:'ついだ'}],correctOption:'0'},'0'),false);
 const before=JSON.stringify(raw);assert.equal(renderExercisePrompt(raw),'');assert.doesNotMatch(renderExerciseReview({question:raw,input:'wrong'},{word,headword:word.lemma,language:'ja',displayLanguage:'en',t:x=>x}),/study-reading-target/);assert.equal(JSON.stringify(raw),before);
});
test('a package rejects stale explicit spans instead of installing a mismatched curated question',()=>{
 const pack={kind:'study',targetLanguage:'ja',entries:[{id:'pour',word:'注ぐ',pronunciation:'つぐ'}],exercises:[{...curated,context:undefined}]};delete pack.exercises[0].context;
 assert.doesNotThrow(()=>validateExercises(pack));pack.exercises[0].readingFocus={start:4,text:'注ぐ'};assert.throws(()=>validateExercises(pack),/reading focus/);
});
test('automatic reading still uses the lemma and never infers past readings from an example focus',()=>{
 const q=createExerciseQuestions(prepareLanguageExercises({...study,exercises:[]},[word]),[word],'vocabinput','reading','en')[0];assert.equal(q.prompt,'注ぐ');assert.equal(q.answer,'つぐ');assert.deepEqual(q.acceptedAnswers,[]);
});
test('explicit focus uses the original span without trimming offsets or mutating repeated targets',()=>{
 const prompt=' 注いだあと、もう一度注いだ。',focus={start:11,text:'注いだ'},before=JSON.stringify({prompt,focus});assert.deepEqual(japaneseReadingPrompt(word,prompt,focus),{prompt,readingFocus:focus});assert.equal(JSON.stringify({prompt,focus}),before);
});
test('explicit targets preserve complete Unicode characters and escape their sentence',()=>{
 const prompt='<img src=x>𠮷野へ行った。',focus={start:11,text:'𠮷野'},unicodeWord={...word,lemma:'𠮷野',pronunciation:'よしの'};
 assert.deepEqual(japaneseReadingPrompt(unicodeWord,prompt,focus),{prompt,readingFocus:focus});
 assert.equal(japaneseReadingPrompt(unicodeWord,prompt,{start:12,text:'\udfb7野'}),undefined);
 const html=renderExercisePrompt({...curated,word:unicodeWord,prompt,readingFocus:focus});assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img/);assert.match(html,/<span class="study-reading-target">𠮷野<\/span>/);
});
test('other exercise categories do not acquire Japanese reading-target rules',()=>{
 const q={category:'idioms',readingFocus:null,answer:'yes'};assert.equal(isValidExerciseQuestion(q),true);assert.equal(exerciseAnswerCorrect(q,'yes'),true);
});
