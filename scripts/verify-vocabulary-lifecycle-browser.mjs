import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 for(const mode of ['vocabinput','vocabmeaning']){
  await page.evaluate(async mode=>{
   window.disposeVocabulary?.();const{renderVocabularyView}=await import('/js/shared/vocabulary-view.js');
   const word=id=>({id,lemma:id==='a'?'Auto':'Haus',pos:'noun',studyMeaning:id==='a'?'자동차':'집',studyExplanationLanguage:'ko',examples:[{text:id==='a'?'Das Auto ist neu.':'Das Haus ist neu.',studyTranslation:'새것이에요.'}]});
   const words=[word('a'),word('b')],questions=words.map(word=>({id:word.id,mode,word,locale:'ko',type:'noun',prompt:mode==='vocabinput'?word.studyMeaning:word.lemma,answer:mode==='vocabinput'?'das '+word.lemma:word.studyMeaning,options:words.map(option=>({id:option.id,text:option.studyMeaning,type:'noun'}))}));
   window.vocabularyRecords=[];window.vocabularyPoolBuilds=0;window.vocabularySpeech=[];window.vocabularyFeedback=[];
   const host=document.querySelector('main');window.disposeVocabulary=renderVocabularyView(host,{
    mode,language:'de',locale:()=> 'ko',labels:{title:'Quiz',listen:'Listen',answer:'Answer',correct:'Correct',incorrect:'Wrong',submit:'Submit',skip:'Skip',next:'Next',empty:'Empty',audioError:'Unavailable'},
    words:({pos})=>words.filter(word=>pos==='all'||word.id===pos),createPool:filtered=>{window.vocabularyPoolBuilds++;return{choose:previous=>questions.find(q=>filtered.includes(q.word)&&q.id!==previous)||questions.find(q=>filtered.includes(q.word))};},
    filters:()=>'<details class="filter-fold"><summary>Filters</summary><button data-tag="b">B</button><button data-tag="all">All</button></details>',
    answerCorrect:(q,value)=>value===(mode==='vocabinput'?q.answer:q.word.id),spokenWord:q=>q.word.lemma,
    speak:(text,onError)=>{window.vocabularySpeech.push(text);window.oldSpeechError=onError;},stopAudio(){},record:(q,input,correct,meta)=>window.vocabularyRecords.push({q,input,correct,meta}),feedback:correct=>window.vocabularyFeedback.push(correct),
   });
  },mode);
  if(mode==='vocabinput'){
   await page.locator('#vocab-answer').fill('das Auto');await page.locator('#vocab-answer').dispatchEvent('compositionstart');await page.locator('#vocab-submit').evaluate(button=>button.click());assert.equal(await page.evaluate(()=>window.vocabularyRecords.length),0,'IME cannot submit an unfinished composition');await page.locator('#vocab-answer').dispatchEvent('compositionend');await page.locator('#vocab-submit').click();
  }else await page.locator('[data-vocab-option=a]').dblclick();
  assert.equal(await page.evaluate(()=>window.vocabularyRecords.length),1);assert.deepEqual(await page.evaluate(()=>window.vocabularyFeedback),[true]);assert.equal(await page.evaluate(()=>window.vocabularyRecords[0].input),mode==='vocabinput'?'das Auto':'a');assert.equal(await page.evaluate(()=>window.vocabularyRecords[0].meta.displayInput),mode==='vocabinput'?'das Auto':'자동차');assert.equal(await page.evaluate(()=>window.vocabularyRecords[0].q.learningExample.text),'Das Auto ist neu.');
  if(mode==='vocabinput')await page.locator('#vocab-listen').click();
  else assert.equal(await page.locator('#vocab-listen').count(),0,'Meaning Quiz has no speaker after grading');
  await page.locator('#vocab-next').click();
  if(mode==='vocabinput')await page.evaluate(()=>window.oldSpeechError());
  assert.equal(await page.locator('.vocab-speech-status').isVisible(),false,'A previous audio error cannot affect the new question');assert.equal(await page.evaluate(()=>window.vocabularyPoolBuilds),1,'Same ordered word objects reuse pool preparation');
  await page.locator('.filter-fold summary').click();await page.locator('[data-tag=b]').click();assert.equal(await page.evaluate(()=>window.vocabularyPoolBuilds),2,'Filter membership rebuilds the prepared pool');
  await page.evaluate(()=>{window.savedVocabularyButton=document.querySelector('#vocab-listen');window.disposeVocabulary();window.disposeVocabulary();window.savedVocabularyButton?.click();document.querySelector('#vocab-answer')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});assert.equal(await page.evaluate(()=>window.vocabularySpeech.length),mode==='vocabinput'?1:0,'Unmounted controls cannot start speech');assert.equal(await page.evaluate(()=>window.vocabularyRecords.length),1,'Unmounted input cannot record an answer');
 }
 console.log('Passed shared vocabulary lifecycle checks: raw/display answers, exact saved examples, IME, duplicate submit, bounded pool reuse, filter changes, stale audio and idempotent cleanup.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
