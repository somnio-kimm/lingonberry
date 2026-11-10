import test from 'node:test';
import assert from 'node:assert/strict';
import {japaneseReadingPrompt} from '../web/js/shared/japanese-reading-prompt.js';
import {createJapaneseReadingExercises} from '../web/js/shared/japanese-reading.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
import {exerciseLabel} from '../web/js/shared/language-exercises.js';
import {lexiconText} from '../web/js/shared/lexicon-text.js';
const word={id:'school',lemma:'学校',pronunciation:'がっこう',language:'ja',studyMeaning:'school',examples:[{text:'弟は学校へ歩いて行く。',studyTranslation:'My younger brother walks to school.'}]};
test('new reading questions show the sentence once and locate its complete target',()=>{
 const question=createJapaneseReadingExercises([word],'en',{version:1,excludedSpellings:[],variants:[]}).find(row=>row.category==='reading');
 assert.equal(question.prompt,'弟は学校へ歩いて行く。');assert.deepEqual(question.readingFocus,{start:2,text:'学校'});assert.equal(question.answer,'がっこう');assert.equal(question.context,'My younger brother walks to school.');assert.equal(question.prompt.split('学校').length-1,1);
});
for(const prompt of ['学校\n弟は学校へ歩いて行く。','弟は［学校］へ歩いて行く。','弟は【学校】へ歩いて行く。','弟は[学校]へ歩いて行く。'])test(`legacy reading prompt normalises safely: ${prompt}`,()=>{
 assert.deepEqual(japaneseReadingPrompt(word,prompt),{prompt:'弟は学校へ歩いて行く。',readingFocus:{start:2,text:'学校'}});
});
test('missing, inflected and embedded-compound targets use a standalone word without guessing its reading',()=>{
 assert.equal(japaneseReadingPrompt({...word,lemma:'学'},'学校へ行く。').prompt,'学');
 assert.deepEqual(japaneseReadingPrompt({...word,lemma:'食べる'},'毎日食べます。'),{prompt:'食べる',readingFocus:{start:0,text:'食べる'}});
 assert.deepEqual(japaneseReadingPrompt(word),{prompt:'学校',readingFocus:{start:0,text:'学校'}});
});
test('reviewed example spans retain a sentence even when tokenisation differs',()=>{
 const body={id:'body',lemma:'体中',pronunciation:'たいちゅう',studyMeaning:'inside the body',examples:[{
  text:'医師は、体中に残った異物の位置を確かめました。',focus:{start:4,text:'体中'},studyTranslation:'The doctor confirmed the location of the object remaining inside the body.'}]};
 const question=createJapaneseReadingExercises([body],'en',{version:1,excludedSpellings:[],variants:[]}).find(row=>row.category==='reading');
 assert.equal(question.prompt,body.examples[0].text);assert.deepEqual(question.readingFocus,{start:4,text:'体中'});
 assert.equal(question.context,body.examples[0].studyTranslation);
});
test('an explicit reviewed span disambiguates repeated targets without guessing',()=>{
 const tree={lemma:'木',examples:[{text:'この木とあの木は同じ種類です。',focus:{start:6,text:'木'}}]};
 assert.deepEqual(japaneseReadingPrompt(tree,tree.examples[0].text),{prompt:tree.examples[0].text,readingFocus:{start:6,text:'木'}});
});
test('invalid or unrelated example spans are never applied to a reading prompt',()=>{
 const invalid={...word,examples:[{text:'学校へ行く。',focus:{start:99,text:'学校'}}]};
 assert.deepEqual(japaneseReadingPrompt(invalid,'学校へ行く。'),{prompt:'学校',readingFocus:{start:0,text:'学校'}});
 const unrelated={...word,examples:[{text:'別の学校へ行く。',focus:{start:2,text:'学校'}}]};
 assert.deepEqual(japaneseReadingPrompt(unrelated,'学校へ行く。'),{prompt:'学校へ行く。',readingFocus:{start:0,text:'学校'}});
});
test('reading prompt omits the instruction line in both display languages',()=>{
 const q={category:'reading',word,prompt:'学校\n弟は［学校］へ歩いて行く。',locale:'en',instruction:'An older instruction.',options:[{id:'0',text:'がっこう'}]};
 const korean=renderExercisePrompt(q,{uiLanguage:'ko'});assert.doesNotMatch(korean,/vocab-instruction/);assert.match(korean,/<span class="study-reading-target">学校<\/span>/);assert.equal(korean.split('学校').length-1,1);assert.ok(!korean.includes('［'));assert.ok(!korean.includes('<rt>'));
 const english=renderExercisePrompt({...q,locale:'ko'},{uiLanguage:'en'});assert.doesNotMatch(english,/vocab-instruction/);assert.match(english,/My younger brother walks to school\./);assert.doesNotMatch(english,/>school<\/p>/);assert.ok(!english.includes('선택하세요'));
 const typing=renderExercisePrompt({...q,options:undefined},{uiLanguage:'ko'});assert.doesNotMatch(typing,/vocab-instruction/);assert.equal(q.prompt,'学校\n弟は［学校］へ歩いて行く。');
});
test('reading text stays escaped and both Korean section labels are consistent',()=>{
 const html=renderExercisePrompt({category:'reading',word,prompt:'<img src=x>学校。',options:[{}]},{uiLanguage:'en'});assert.ok(!html.includes('<img'));assert.match(html,/&lt;img src=x&gt;/);
 assert.equal(exerciseLabel('reading','ko'),'한자 읽기');assert.equal(lexiconText('ko','Word Reading'),'한자 읽기');assert.equal(exerciseLabel('okurigana','ko'),'오쿠리가나');assert.equal(lexiconText('ko','Okurigana'),'오쿠리가나');
});
