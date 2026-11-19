import test from 'node:test';
import assert from 'node:assert/strict';
import {findTranslationFocus,collectTranslationTerms,readQuestionTranslationFocus} from '../web/js/shared/translation-focus.js';
import {renderTranslationTarget} from '../web/js/shared/translation-target-view.js';
const match=(text,meaning,locale='ko',pos='noun',extra={})=>findTranslationFocus({text,word:{studyMeaning:meaning,studyExplanationLanguage:locale,pos},locale,studyLanguage:locale==='ko'?'en':'de',...extra});
for(const [text,meaning,expected]of [
 ['아빠는 부엌에서 요리하고 있다.','아빠; 아버지','아빠'],
 ['그 비평가는 그 탑을 흉물이라고 불렀다.','흉물; 끔찍한 것','흉물'],
 ['학교에서도 공부해요.','학교','학교'],
 ['우리 반에는 학생 여덟 명이 있다.','여덟; 8','여덟'],
])test(`Korean noun focus retains the exact translated term: ${expected}`,()=>assert.deepEqual(match(text,meaning).map(row=>row.text),[expected]));
for(const [text,meaning,expected]of [
 ['나는 가족을 사랑한다.','사랑하다; 좋아하다','사랑한다'],
 ['매일 아침 빵을 먹어요.','먹다','먹어요'],
 ['물을 마셔 주세요.','마시다','마셔'],
 ['그 회원국들은 탈퇴할지 토론했다.','탈퇴하다; 분리 독립하다','탈퇴할지'],
 ['그 설명은 적절하다.','적합한; 적절한','적절하다'],
 ['아이들은 노래를 불렀다.','노래를 부르다',null],
])test(`Korean predicate focus is conservative for ${meaning}`,()=>assert.deepEqual(match(text,meaning,'ko',meaning.includes('적절')?'adjective':'verb').map(row=>row.text),expected?[expected]:[]));
for(const [text,meaning,pos,expected]of [
 ['She ate bread this morning.','eat','verb','ate'],
 ['The children are outside.','child','noun','children'],
 ['She works from home.','to work','verb','works'],
 ['It is a better choice.','good','adjective','better'],
 ['She took part in the meeting.','take part in','verb','took part in'],
])test(`English inflected focus matches ${expected}`,()=>assert.deepEqual(match(text,meaning,'en',pos).map(row=>row.text),[expected]));
test('paraphrases, substring collisions and ambiguous occurrences stay unmarked',()=>{
 for(const [text,meaning,locale,pos]of [['가게에 들렀다.','가다','ko','verb'],['자기 방으로 들어갔다.','자다','ko','verb'],['보고서를 확인했다.','보다','ko','verb'],['해고를 당했다.','하다','ko','verb'],['사고 후에 쉬었다.','사다','ko','verb'],['돼지가 커졌다.','되다','ko','verb'],['자동차는 빠르다.','차','ko','noun'],['The party is crowded.','art','en','noun'],['A bank stands beside another bank.','bank','en','noun'],['He enjoyed the meal.','eat','en','verb']])assert.deepEqual(match(text,meaning,locale,pos),[]);
});
test('source spelling is never used as a translation fallback for false friends',()=>{
 assert.deepEqual(findTranslationFocus({text:'I received a gift.',word:{lemma:'Gift',studyMeaning:'poison',pos:'noun'},locale:'en',studyLanguage:'de'}),[]);
});
test('English self-study definition hints are not treated as sentence translations',()=>{
 assert.deepEqual(match('To make a serious request.','request','en','noun',{studyLanguage:'en',focus:{start:18,text:'request'}}),[]);
});
test('selected explanation language excludes meanings from another content language',()=>{
 assert.deepEqual(findTranslationFocus({text:'차가 왔다.',word:{studyMeaning:'car',studyExplanationLanguage:'en',meaningKo:'자동차'},locale:'ko',studyLanguage:'ja'}),[]);
 assert.deepEqual(collectTranslationTerms({studyMeaning:'car',studyExplanationLanguage:'en',meaning_ko:['차','자동차']},'ko'),['차','자동차']);
});
test('normalised matching preserves original UTF-16 offsets and combining marks',()=>{
 const text='🙂 The cafe\u0301 is open.',focus=match(text,'café','en');assert.equal(focus.length,1);assert.equal(focus[0].text,'cafe\u0301');assert.equal(text.slice(focus[0].start,focus[0].start+focus[0].text.length),focus[0].text);
});
test('validated explicit spans support reordered or separated translations without guessing',()=>{
 const text='Please write it down.',focus=[{start:7,text:'write'},{start:16,text:'down'}];assert.deepEqual(match(text,'record','en','verb',{focus}),focus);
});
test('malformed explicit alignment never silently falls back to a lexical guess',()=>{
 const text='A car is outside.';
 for(const focus of [null,{}, {start:3,text:'car'},{start:-1,text:'car'},{start:2,text:''},{start:2,text:'car',locale:'ko'},[{start:2,text:'car'},{start:3,text:'ar'}]])assert.deepEqual(match(text,'car','en','noun',{focus}),[]);
 assert.deepEqual(match('🙂 car','car','en','noun',{focus:{start:1,text:'\ude42'}}),[]);
});
test('rendering escapes text, adds only a target span and never mutates a saved question',()=>{
 const options={word:{studyMeaning:'car',pos:'noun'},locale:'en',studyLanguage:'de',focus:{start:3,text:'car'}},before=structuredClone(options),text='<b>car</b> & more';
 const html=renderTranslationTarget(text,options);assert.equal(html,'&lt;b&gt;<span class="translation-target" data-translation-target>car</span>&lt;/b&gt; &amp; more');assert.deepEqual(options,before);
});

test('light-verb and bare short-form homographs are not guessed without explicit alignment',()=>{
 for(const [text,meaning]of [['해 뜨는 날에 만나요.','하다'],['그가 한기를 느꼈다.','하다'],['그는 한 명을 골랐다.','하다'],['함이 부두에 도착했다.','하다'],['된장을 넣었다.','되다'],['주민이 모였다.','주다'],['준비를 마쳤다.','주다'],['주요 결과를 발표했다.','주다'],['둘은 친구다.','두다'],['산을 바라보았다.','사다'],['와, 정말 멋져요.','오다'],['그가 할 일은 많다.','하다']])assert.deepEqual(match(text,meaning,'ko','verb'),[],text);
 assert.deepEqual(match('해가 떴어요.','해','ko','noun').map(row=>row.text),['해']);
 assert.deepEqual(match('지금 공부해.','공부하다','ko','verb').map(row=>row.text),['공부해']);
 assert.deepEqual(match('그는 일한다.','일하다','ko','verb').map(row=>row.text),['일한다']);
});

test('a capitalised inflection inside a sentence is not assumed to be a lowercase verb',()=>{
 assert.deepEqual(match('I sent the parcel to Reading yesterday.','read','en','verb'),[]);
 assert.deepEqual(match('Reading helps me relax.','read','en','verb').map(row=>row.text),['Reading']);
 assert.deepEqual(match('It is French food.','French','en','adjective').map(row=>row.text),['French']);
});

test('the reported school-by-bus sentence keeps the actual Korean go predicate',()=>{
 for(const studyLanguage of ['de','zh','ja','en'])assert.deepEqual(match('저는 버스로 학교에 가요.','가다','ko','verb',{studyLanguage}),[{start:11,text:'가요'}]);
});
for(const [text,meaning,expected]of [['지역 사업자들이 모였다.','사업자','사업자들'],['그녀는 전문가다.','전문가','전문가'],['이 화면은 십오 인치예요.','인치','인치'],['그는 학생이에요.','학생','학생'],['그는 전문가였습니다.','전문가','전문가']])test(`Korean nominal endings preserve the lexical noun in ${text}`,()=>assert.deepEqual(match(text,meaning).map(row=>row.text),expected?[expected]:[]));
test('placeholder notation can expose a lexical clue without guessing its argument',()=>{
 assert.deepEqual(match('우리는 보통 버스를 타고 학교에 간다.','~을 타다; ~길로 가다','ko','verb').map(row=>row.text),['타고']);
 assert.deepEqual(match('주말 동안 집에 있었다.','~동안; ~에 걸쳐','ko','preposition').map(row=>row.text),['동안']);
 assert.deepEqual(match('학교에서 책을 읽었다.','~의','ko','particle'),[]);
 assert.deepEqual(match('그녀는 다른 길을 택했다.','~길로 가다','ko','verb'),[]);
});
test('an empty selected meaning can use its declared-language legacy terms',()=>{
 assert.deepEqual(findTranslationFocus({text:'저는 버스로 학교에 가요.',word:{studyMeaning:'',studyExplanationLanguage:'ko',meaning_ko:['가다'],pos:'verb'},locale:'ko',studyLanguage:'en'}).map(row=>row.text),['가요']);
});
test('new noun suffixes do not accept arbitrary compounds or a one-letter noun inside a verb',()=>{
 assert.deepEqual(match('사업자들판은 존재하지 않는다.','사업자'),[]);assert.deepEqual(match('그는 집에 가다.','가','ko','noun'),[]);
});

test('Korean case endings do not turn common compounds into pronoun or noun matches',()=>{
 for(const [text,meaning]of [['나이가 많다.','나'],['차이가 크다.','차'],['주가가 올랐다.','주'],['주가는 올랐다.','주'],['나이에요.','나'],['그것은 사이다.','사이']])assert.deepEqual(match(text,meaning),[],text);
 for(const [text,meaning,expected]of [['저는 학생이에요.','저','저'],['학교에서부터도 알 수 있다.','학교','학교'],['사업자들에게는 공지했다.','사업자','사업자들']])assert.deepEqual(match(text,meaning).map(row=>row.text),[expected]);
});

test('explicit question focus has consistent precedence over its selected example in every renderer',()=>{
 const selected={translationFocus:{start:11,text:'가요'}},question={example:selected},before=structuredClone(question);
 assert.deepEqual(readQuestionTranslationFocus(question),selected.translationFocus);
 assert.equal(readQuestionTranslationFocus({...question,translationFocus:null}),null);
 assert.deepEqual(readQuestionTranslationFocus({...question,translationFocus:undefined}),selected.translationFocus);
 assert.deepEqual(readQuestionTranslationFocus({translationFocus:{start:0,text:'다른'}},selected),{start:0,text:'다른'});
 assert.deepEqual(readQuestionTranslationFocus(undefined,selected),selected.translationFocus);assert.deepEqual(question,before);
});

test('a legacy question can use explicit word language metadata when its own locale is missing',()=>{
 const word={studyMeaning:'가다',studyExplanationLanguage:'ko',studyLanguage:'en',pos:'verb'},text='저는 버스로 학교에 가요.';assert.deepEqual(findTranslationFocus({text,word}),[{start:11,text:'가요'}]);
 assert.deepEqual(findTranslationFocus({text,word,locale:'en'}),[]);
 assert.deepEqual(findTranslationFocus({text:'To go somewhere.',word:{studyMeaning:'go',studyExplanationLanguage:'en',studyLanguage:'en',pos:'verb'}}),[]);
});
