import test from 'node:test';
import assert from 'node:assert/strict';
import {findTranslationFocus} from '../web/js/shared/translation-focus.js';
import {renderTranslationTarget} from '../web/js/shared/translation-target-view.js';
const locateTranslation=(text,meaning,pos='verb',locale='ko',extra={})=>findTranslationFocus({text,word:{studyMeaning:meaning,studyExplanationLanguage:locale,pos},locale,studyLanguage:locale==='ko'?'en':'de',...extra});

for(const [text,meaning]of [
 ['해 뜨는 날에 만나요.','하다'],['그가 한기를 느꼈다.','하다'],['한자를 써요.','하다'],['주요 결과를 발표했다.','주다'],['둘은 친구다.','두다'],['그는 보고서를 읽었다.','보다'],
])test(`an unrelated Korean lexical word is not a predicate match: ${text}`,()=>assert.deepEqual(locateTranslation(text,meaning),[]));
for(const [text,meaning,expected]of [
 ['그는 그 일을 해요.','하다','해요'],['물 한 잔 주세요.','주다','주세요'],['그는 책을 선반에 뒀다.','두다','뒀다'],
])test(`the corresponding actual Korean predicate remains available: ${expected}`,()=>assert.deepEqual(locateTranslation(text,meaning).map(row=>row.text),[expected]));
test('a Korean noun inside a different compound is not confused with its particle-bearing form',()=>{
 assert.deepEqual(locateTranslation('은행나무가 자랐다.','은행','noun'),[]);assert.deepEqual(locateTranslation('은행에서 돈을 찾았다.','은행','noun').map(row=>row.text),['은행']);
});
test('source-language false friends are not used when the translated gloss is absent',()=>{
 for(const [lemma,meaning,text]of [['Gift','poison','I received a gift.'],['Chef','boss','The chef prepared lunch.']])assert.deepEqual(findTranslationFocus({text,word:{lemma,studyMeaning:meaning,studyExplanationLanguage:'en',pos:'noun'},locale:'en',studyLanguage:'de'}),[]);
});
test('repeated or distinct candidate translations do not silently choose the first occurrence',()=>{
 assert.deepEqual(locateTranslation('The glass stood beside the glass.','glass','noun','en'),[]);assert.deepEqual(locateTranslation('His coat and jacket were missing.','coat; jacket','noun','en'),[]);
});
test('English inflection matching retains the translated word and does not swallow neighbouring text',()=>{
 for(const [text,meaning,expected]of [['She had written the letter.','write','written'],['They went home yesterday.','go','went'],['The children waited outside.','child','children']])assert.deepEqual(locateTranslation(text,meaning,meaning==='child'?'noun':'verb','en').map(row=>row.text),[expected]);
});
test('explicit focus cannot split a composed grapheme or make raw text executable',()=>{
 const options={word:{studyMeaning:'car',studyExplanationLanguage:'en',pos:'noun'},locale:'en',studyLanguage:'de'};
 assert.deepEqual(findTranslationFocus({...options,text:'👨‍👩‍👧‍👦 car',focus:{start:0,text:'👨'}}),[]);assert.deepEqual(findTranslationFocus({...options,text:'A\u0301 car',focus:{start:1,text:'\u0301'}}),[]);
 const text='<i>car</i> & "outside"',focus={start:3,text:'car'},before=structuredClone(focus),html=renderTranslationTarget(text,{...options,focus});assert.equal(html,'&lt;i&gt;<span class="translation-target" data-translation-target>car</span>&lt;/i&gt; &amp; &quot;outside&quot;');assert.deepEqual(focus,before);
});
test('capitalised English verb homographs do not impersonate a place name, while real sentence starts and named adjectives remain usable',()=>{
 assert.deepEqual(locateTranslation('I sent the parcel to Reading yesterday.','read','verb','en'),[]);
 assert.deepEqual(locateTranslation('Reading helps me relax.','read','verb','en').map(row=>row.text),['Reading']);
 assert.deepEqual(locateTranslation('She studies French.','French','adjective','en').map(row=>row.text),['French']);
});
