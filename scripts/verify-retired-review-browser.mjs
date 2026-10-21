import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 for(const locale of ['en','ko']){
  await page.evaluate(async locale=>{
   const {createPresentation}=await import('/js/presentation/multilingual.js');
   const level='IELTS 1.0–3.5',word={id:'en-review',lemma:'example',pos:'noun',level,studyMeaning:'a sample'};
   const question={id:'retired',mode:'confusables',category:'confusables',exercise:true,locale:'en',word,answer:'sample',prompt:'Choose the word.',instruction:'Choose.',explanation:'A retained question.',options:[{id:'0',text:'sample'},{id:'1',text:'wrong'}],correctOption:'0'};
   const id='confusables:retired:en';
   localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify({version:1,wordStatus:{},wrongs:{[id]:{id,question,input:'1',count:1}},preferences:{uiLanguage:locale,studyLevel:level}}));
   const host=document.createElement('main');document.body.replaceChildren(host);let route='wrong',app;
   const refresh=()=>app.render(route,host);app=createPresentation({language:'en',navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});
   app.setStudy({targetLanguage:'en',explanationLanguage:'en',studyVersion:'4.6.0',entries:[{id:word.id,word:'example',partOfSpeech:'noun',level,meaning:'a sample',tags:[]}]});refresh();window.retiredReviewApp=app;window.openRetiredStudy=()=>{route='home';refresh();};
  },locale);
  await page.locator('.wrong-card').waitFor();assert.ok((await page.locator('.wrong-card').innerText()).includes(locale==='ko'?'헷갈리는 단어':'Confusable Words'));
  await page.locator('[data-retest]').click();await page.locator('[data-option="0"]').click();await page.locator('.lexicon-question.correct').waitFor();await page.locator('[data-next]').click();await page.locator('[data-finish]').waitFor();
  await page.evaluate(()=>window.openRetiredStudy());assert.equal(await page.locator('[data-route=confusables]').count(),0);console.log('Retired question Review/retest preserved without a Study section:',locale);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
