import test from 'node:test';
import assert from 'node:assert/strict';
import {renderExerciseReview} from '../web/js/shared/exercise-review-view.js';
import {lexiconText} from '../web/js/shared/lexicon-text.js';
import {createOkuriganaSpellingQuestion} from '../web/js/shared/japanese-reading.js';
function render(question,input,{display='en',language='ja',word=question.word}={}){
 return renderExerciseReview({question,input},{word,headword:word.article?word.article+' '+word.lemma:word.lemma,language,displayLanguage:display,t:text=>lexiconText(display,text)});
}
const school={id:'school',lemma:'学校',pronunciation:'がっこう',studyMeaning:'school'};
test('Word Reading Review retains its question sentence, translation and stored wrong reading',()=>{
 const question={exercise:true,category:'reading',word:school,locale:'en',answer:'がっこう',prompt:'弟は学校へ行く。',context:'My younger brother goes to school.',options:[{id:'0',text:'がっこう'},{id:'1',text:'がこう'}],explanation:'Extra teaching text.'},before=structuredClone(question),html=render(question,'1',{display:'ko'});
 assert.match(html,/오답:/);assert.match(html,/<del>がこう<\/del>/);assert.match(html,/弟は<span class="study-reading-target">学校<\/span>へ行く。/);assert.match(html,/lang="en">My younger brother goes to school\./);
 assert.ok(html.indexOf('wrong-question-block')<html.indexOf('wrong-user-line'));
 assert.doesNotMatch(html,/Correct Answer|정답:|vocab-instruction|vocab-prompt|Extra teaching/);assert.deepEqual(question,before);
});
test('reading Review uses the saved sentence and translation when current dictionary content differs',()=>{
 const saved={...school,examples:[{text:'学校へ行く。',studyTranslation:'Go to school.'}]};
 const question={exercise:true,category:'reading',word:saved,locale:'en',answer:'がっこう',prompt:'学校\n［学校］へ行く。'};
 const html=render(question,'がこう',{word:{...school,examples:[{text:'学校は休みです。',studyTranslation:'School is closed.'}]}});
 assert.match(html,/>学校<\/span>へ行く。/);assert.match(html,/Go to school\./);assert.doesNotMatch(html,/School is closed/);
 const standalone=render({...question,prompt:'学校'},'がこう');
 assert.doesNotMatch(standalone,/wrong-question-block|Go to school/);
});
test('a missing heading reading does not suppress the only available correct reading',()=>{
 const word={...school,pronunciation:undefined},html=render({exercise:true,category:'reading',word,answer:'がっこう'},'がこう');assert.match(html,/Correct Answer:/);assert.match(html,/がっこう/);
});
test('Okurigana shows the wrong spelling without duplicating the answer or reading breakdown',()=>{
 const word={id:'long',lemma:'久しい',pronunciation:'ひさしい',studyMeaning:'long-standing'},question={...createOkuriganaSpellingQuestion(word,'en'),word,exercise:true,locale:'en'},html=render(question,'久い');
 assert.doesNotMatch(html,/reading-segment/);assert.match(html,/<del>久い<\/del>/);assert.doesNotMatch(html,/Correct Answer:|wrong-question|vocab-instruction|<p lang=/);
});
test('Root Review keeps a compact origin clue, once-only meaning and the wrong written word',()=>{
 const word={id:'audience',lemma:'audience',studyMeaning:'listeners'},question={exercise:true,category:'roots',rootFamilyId:'aud',word,locale:'en',answer:'audience',prompt:'Latin · aud — hear\nlisteners',context:'listeners',instruction:'Type the word.',explanation:'Long list of related words.'},before=structuredClone(question),html=render(question,'audition',{display:'ko',language:'en'});
 assert.match(html,/라틴어 · aud — hear/);assert.match(html,/<del>audition<\/del>/);assert.doesNotMatch(html,/listeners|Type the word|Long list|Correct Answer:|정답:|vocab-prompt|grammar-word/);assert.deepEqual(question,before);
});
test('separated phrase gaps use baseline single-line Review blanks and cross out only incorrect parts',()=>{
 const word={id:'write',lemma:'write',studyMeaning:'record'},question={exercise:true,category:'phrasal',word,locale:'en',answer:'write … down',prompt:'Please ___ it ___.',gapFill:{parts:['Please ',' it ','.'],answers:['write','down']},explanation:'Extra explanation.'},html=render(question,'write … up',{display:'ko',language:'en'});
 assert.equal((html.match(/wrong-test-slot wrong-test-blank/g)||[]).length,2);assert.match(html,/aria-label="빈칸 1"/);assert.match(html,/정답:/);assert.match(html,/<span class="correct-answer">write<\/span>/);assert.match(html,/<del class="wrong-token">up<\/del>/);assert.doesNotMatch(html,/<del[^>]*>write|phrase-gap-input|vocab-prompt|Extra explanation/);
});
test('phrase questions show compact context and equal answer rows, resolving saved selection IDs',()=>{
 const word={id:'decision',lemma:'decision',studyMeaning:'decision'},question={exercise:true,category:'collocations',word,locale:'en',answer:'make',prompt:'I ___ a decision.',context:'decision',options:[{id:'0',text:'make'},{id:'1',text:'do'}]},html=render(question,'1',{language:'en'});
 assert.match(html,/class="wrong-question"/);assert.match(html,/wrong-correct-line/);assert.match(html,/wrong-user-line/);assert.match(html,/>make<\/span>/);assert.match(html,/<del>do<\/del>/);assert.doesNotMatch(html,/wrong-translation|vocab-instruction|vocab-prompt/);
});
test('a phrase meaning already shown below the heading is not repeated as a correct answer',()=>{
 const word={id:'decide',lemma:'decide',studyMeaning:'결정하다'},question={exercise:true,category:'collocations',collocationId:'phrase',word,locale:'ko',answer:'결정하다',prompt:'make a decision',options:[{id:'0',text:'결정하다'},{id:'1',text:'차를 마시다'}]},html=render(question,'1',{language:'en',display:'en'});
 assert.match(html,/make a decision/);assert.match(html,/lang="ko"><del>차를 마시다/);assert.doesNotMatch(html,/Correct Answer:/);
});
test('historical forms retain the established conditions/base/question/correct/wrong layout, including base-form answers',()=>{
 const word={id:'eat',lemma:'食べる',pronunciation:'たべる',studyMeaning:'eat'},question={exercise:true,category:'forms',mode:'forms',word,locale:'en',condition:'Te Form',answer:'食べる',prompt:'食べる（たべる）\nTe Form'},html=render(question,'食べた',{display:'ko'});
 assert.deepEqual([...html.matchAll(/data-form-detail="([^"]+)"/gu)].map(match=>match[1]),['conditions','base','question','correct','wrong']);assert.match(html,/て형/);assert.match(html,/정답/);assert.match(html,/wrong-test-slot wrong-test-blank/);assert.doesNotMatch(html,/form-original-word|vocab-instruction/);
});
test('Review escapes untrusted text and never rewrites stored questions or input',()=>{
 const word={id:'x',lemma:'word',studyMeaning:'meaning'},record={question:{exercise:true,category:'collocations',word,answer:'answer',prompt:'<script>bad()</script> ___'},input:'<img src=x onerror=bad()>'},before=structuredClone(record),html=render(record.question,record.input,{language:'en'});
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img/);assert.deepEqual(record,before);
});

test('historical forms without condition metadata retain their original task constraint compactly',()=>{
 const word={id:'eat',lemma:'食べる'},question={exercise:true,category:'forms',mode:'forms',word,locale:'en',answer:'食べて',instruction:'Write the complete て-form.',prompt:'食べる → ___'},html=render(question,'食べた',{display:'ko'});assert.match(html,/て형 전체를 입력하세요/);assert.match(html,/data-form-detail="conditions"/);assert.doesNotMatch(html,/vocab-instruction/);
});
