import test from 'node:test';
import assert from 'node:assert/strict';
import {japaneseReadingPrompt} from '../web/js/shared/japanese-reading-prompt.js';
import {createJapaneseReadingExercises} from '../web/js/shared/japanese-reading.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
import {exerciseLabel} from '../web/js/shared/language-exercises.js';
import {lexiconText} from '../web/js/shared/lexicon-text.js';
const word={id:'school',lemma:'学校',pronunciation:'がっこう',language:'ja',studyMeaning:'school',examples:[{text:'弟は学校へ歩いて行く。'}]};
test('new reading questions show the sentence once and locate its complete target',()=>{
 const question=createJapaneseReadingExercises([word],'en',{version:1,excludedSpellings:[],variants:[]}).find(row=>row.category==='reading');
 assert.equal(question.prompt,'弟は学校へ歩いて行く。');assert.deepEqual(question.readingFocus,{start:2,text:'学校'});assert.equal(question.answer,'がっこう');assert.equal(question.prompt.split('学校').length-1,1);
});
for(const prompt of ['学校\n弟は学校へ歩いて行く。','弟は［学校］へ歩いて行く。','弟は【学校】へ歩いて行く。','弟は[学校]へ歩いて行く。'])test(`legacy reading prompt normalises safely: ${prompt}`,()=>{
 assert.deepEqual(japaneseReadingPrompt(word,prompt),{prompt:'弟は学校へ歩いて行く。',readingFocus:{start:2,text:'学校'}});
});
test('missing, inflected and embedded-compound targets use a standalone word without guessing its reading',()=>{
 assert.equal(japaneseReadingPrompt({...word,lemma:'学'},'学校へ行く。').prompt,'学');
 assert.deepEqual(japaneseReadingPrompt({...word,lemma:'食べる'},'毎日食べます。'),{prompt:'食べる',readingFocus:{start:0,text:'食べる'}});
 assert.deepEqual(japaneseReadingPrompt(word),{prompt:'学校',readingFocus:{start:0,text:'学校'}});
});
test('reading instructions follow Display Language independently of Explanation Language',()=>{
 const q={category:'reading',word,prompt:'学校\n弟は［学校］へ歩いて行く。',locale:'en',instruction:'An older instruction.',options:[{id:'0',text:'がっこう'}]};
 const korean=renderExercisePrompt(q,{uiLanguage:'ko'});assert.match(korean,/밑줄 친 단어의 읽기를 선택하세요\./);assert.match(korean,/<span class="study-reading-target">学校<\/span>/);assert.equal(korean.split('学校').length-1,1);assert.ok(!korean.includes('［'));assert.ok(!korean.includes('<rt>'));
 const english=renderExercisePrompt({...q,locale:'ko'},{uiLanguage:'en'});assert.match(english,/Choose the reading of the underlined word\./);assert.ok(!english.includes('선택하세요'));
 const typing=renderExercisePrompt({...q,options:undefined},{uiLanguage:'ko'});assert.match(typing,/밑줄 친 단어의 읽기를 히라가나로 입력하세요\./);assert.equal(q.prompt,'学校\n弟は［学校］へ歩いて行く。');
});
test('reading text stays escaped and both Korean section labels are consistent',()=>{
 const html=renderExercisePrompt({category:'reading',word,prompt:'<img src=x>学校。',options:[{}]},{uiLanguage:'en'});assert.ok(!html.includes('<img'));assert.match(html,/&lt;img src=x&gt;/);
 assert.equal(exerciseLabel('reading','ko'),'한자 읽기');assert.equal(lexiconText('ko','Word Reading'),'한자 읽기');assert.equal(exerciseLabel('okurigana','ko'),'오쿠리가나');assert.equal(lexiconText('ko','Kanji and Okurigana'),'오쿠리가나');
});
