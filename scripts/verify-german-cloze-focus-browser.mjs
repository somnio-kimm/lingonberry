import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let app;app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale});
   const text='Gut zu wissen: Das ist eine gute Idee.';
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[
    {id:'focus-good',word:'gut',partOfSpeech:'adjective',level:'A1',meaning:locale==='en'?'good':'좋다',example:{text,translation:locale==='en'?"Good to know: that's a good idea.":'알아 두면 좋네. 이건 좋은 생각이야.',focus:{start:text.indexOf('gute'),text:'gute'}}},
    {id:'focus-bad',word:'schlecht',partOfSpeech:'adjective',level:'A1',meaning:locale==='en'?'bad':'나쁘다'},
   ]});app.render('cloze',host);window.focusApp=app;window.focusHost=host;
  },{locale,theme});
  assert.equal(await page.locator('.sentence-quiz-text').innerText(),'Gut zu wissen: Das ist eine ______ Idee.');
  assert.deepEqual((await page.locator('.cloze-option-word').allTextContents()).sort(),['gute','schlechte']);
  await page.locator('.opt-btn').filter({hasText:'gute'}).click();assert.equal(await page.locator('.cloze-answer').innerText(),'gute');
  assert.equal(await page.locator('.sentence-quiz-text').innerText(),'Gut zu wissen: Das ist eine gute Idee.');
  await page.locator('#quiz-next').click();await page.locator('.opt-btn').filter({hasText:'schlecht'}).click();
  const saved=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.cloze)[0]);
  assert.equal(saved.answer,'gute');assert.equal(saved.questionContext.start,saved.example.de.indexOf('gute'));assert.equal(saved.example.focus.text,'gute');
  const history=await page.evaluate(()=>{const before=localStorage.getItem('learn-language.de.progress.v1');window.focusApp.render('wrong',window.focusHost);return before;});
  await page.locator('.wrong-entry').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1')),history);
  await page.locator('#retest-filtered').click();assert.equal(await page.locator('.sentence-quiz-text').innerText(),'Gut zu wissen: Das ist eine ______ Idee.');
  await page.locator('.opt-btn').filter({hasText:'gute'}).click();assert.equal(await page.locator('.cloze-answer').innerText(),'gute');checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} actual German explicit-focus checks: EN/KO, phone/tablet, light/dark, inflected question/feedback/saved-context/Review/retest; original history preserved.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
