import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLexiconSentence} from '../web/js/shared/lexicon-sentence-view.js';
// Capture the view's public HTML and handlers without a browser or persisted progress.
function render(mode,feedback){
 const handlers=new Map(),host={innerHTML:'',querySelector:selector=>({addEventListener:(event,fn)=>handlers.set(selector,fn),set onclick(fn){handlers.set(selector,fn);}}),querySelectorAll:()=>[]};
 const calls=[],q={mode,word:{id:'book',lemma:'本',pronunciation:'ほん'},locale:'en',sentence:'本です。',focus:{start:0,text:'本'},answer:mode==='cloze'?'本':'本です。',tokens:['本','です','。'],pool:[2,1,0],example:{studyTranslation:'It is a book.'},options:[{id:'book',text:'本',meaning:'book'}]};
 renderLexiconSentence(host,{question:q,feedback,chosenTokens:[],showReading:true,t:x=>x},{language:'ja',renderSentence:text=>text,renderOption:option=>option.text,toggleReading:value=>calls.push(value),reset:()=>calls.push('reset')});
 return {html:host.innerHTML,handlers,calls};
}
test('Cloze offers immediate choices and only Next after checking',()=>{
 const front=render('cloze');assert.match(front.html,/data-cloze-option="book"/);assert.doesNotMatch(front.html,/data-sentence-submit/);assert.match(front.html,/<ruby>______<rt>ほん<\/rt>/);assert.doesNotMatch(front.html,/\[\]/);
 const checked=render('cloze','wrong');assert.match(checked.html,/data-sentence-next/);assert.doesNotMatch(checked.html,/data-sentence-skip/);assert.match(checked.html,/cloze-option-meaning/);
});
test('Scramble separates the three cards, keeps Reset and toggles Japanese readings',()=>{
 const front=render('scramble');assert.equal((front.html.match(/<section class="panel/g)||[]).length,3);assert.match(front.html,/scramble-answer/);assert.match(front.html,/scramble-pool/);assert.match(front.html,/data-sentence-reset/);
 front.handlers.get('[data-sentence-reset]')();front.handlers.get('[data-show-reading]')();assert.deepEqual(front.calls,['reset',false]);
 const checked=render('scramble','correct');assert.match(checked.html,/scramble-answer/);assert.match(checked.html,/scramble-pool/);assert.doesNotMatch(checked.html,/data-sentence-reset/);assert.match(checked.html,/data-sentence-next/);
});

test('Scramble does not require a Cloze focus record',()=>{
 const host={innerHTML:'',querySelector:()=>({addEventListener(){}}),querySelectorAll:()=>[]};
 assert.doesNotThrow(()=>renderLexiconSentence(host,{question:{mode:'scramble',word:{id:'book'},locale:'en',sentence:'本です。',answer:'本です。',tokens:['本','です','。'],pool:[0,1,2],example:{studyTranslation:'It is a book.'}},chosenTokens:[],showReading:true,t:x=>x},{language:'ja',renderSentence:text=>text}));
});
