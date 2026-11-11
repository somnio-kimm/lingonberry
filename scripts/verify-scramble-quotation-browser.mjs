import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  const data=await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');
   const {sentenceTokens,joinSentenceTokens}=await import('/languages/de/js/core/sentence-quizzes.js');
   const text='Die Nachricht lautet: „Ja, ich komme.“ Danach wartet sie.',tokens=sentenceTokens(text);
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let app;app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[
    {id:'quote-message',word:'Nachricht',article:'die',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'message':'메시지',example:{text,translation:locale==='en'?'The message says, “Yes, I am coming.” Then she waits.':'메시지에는 ‘네, 갈게요.’라고 쓰여 있다. 그런 다음 그녀는 기다린다.'}},
   ]});window.quoteApp=app;window.quoteHost=host;window.quoteJoin=joinSentenceTokens;app.render('scramble',host);
   return {text,tokens,joined:joinSentenceTokens(tokens)};
  },{locale,theme});
  assert.equal(data.joined,data.text);await page.locator('[data-pool]').first().waitFor();
  const wrong=[data.tokens[1],data.tokens[0],...data.tokens.slice(2)];
  async function choose(tokens){for(const token of tokens){await page.locator('[data-pool]').filter({hasText:new RegExp('^'+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first().click();}await page.locator('#quiz-submit').click();}
  await choose(wrong);
  const saved=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.scramble)[0]);
  assert.equal(saved.correct,false);assert.equal(saved.answer,data.text);
  assert.equal(saved.attempts.at(-1).input,await page.evaluate(tokens=>window.quoteJoin(tokens),wrong));assert.doesNotMatch(saved.attempts.at(-1).input,/komme\. “/);
  await page.evaluate(()=>window.quoteApp.render('wrong',window.quoteHost));await page.locator('.wrong-entry').first().waitFor();
  const history=await page.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1'));
  await page.locator('#retest-filtered').click();await page.locator('[data-pool]').first().waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1')),history);
  await choose(data.tokens);assert.equal(await page.locator('.sentence-quiz-text').innerText(),data.text);await page.locator('#quiz-next').waitFor();checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German quotation reconstruction checks: EN/KO, phone/tablet, light/dark, actual Scramble submit, stored wrong answer, Review and corrected saved retest.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
