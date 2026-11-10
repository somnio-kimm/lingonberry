import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale});
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[{id:'optional-fixture',word:'Deutsch',article:'das',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'German (language)':'독일어',grammar:{article_optional:true,gender:'neuter',number_restriction:'singular',declension:{nom:['Deutsch / das Deutsche',null],acc:['Deutsch / das Deutsche',null],dat:['Deutsch / dem Deutschen',null],gen:['Deutschs / des Deutsch / des Deutschen',null]}}}]});
   app.render('vocabinput',host);window.aliasPresentation=app;window.aliasHost=host;
  },{locale,theme});
  await page.locator('#vocab-answer').fill('Deutsch');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();assert.equal(await page.locator('.vocab-correction').innerText(),'Deutsch');
  assert.equal(await page.locator('.vocab-wrong').count(),0);
  await page.locator('#vocab-next').click();await page.locator('#vocab-answer').fill('die Deutsch');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
  const snapshot=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.vocabinput)[0].questionSnapshot);
  assert.deepEqual(snapshot.acceptedAnswers,['Deutsch','das Deutsch','das Deutsche']);assert.equal(snapshot.word.article_optional,true);assert.equal(snapshot.contentVersion,'4.0.0');
  await page.evaluate(()=>window.aliasPresentation.render('wrong',window.aliasHost));await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();
  await page.locator('#vocab-answer').fill('Deutsch');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
  await page.evaluate(()=>window.aliasPresentation.render('verbforms',window.aliasHost));await page.locator('[data-form-mode="cases"]').click();
  const id=await page.locator('.grammar-question').getAttribute('data-question-id');
  await page.locator('#form-answer').fill(id.includes(':gen:')?'Deutschs':'Deutsch');await page.locator('#grammar-submit').click();await page.locator('.verb-answer-cell.correct').waitFor();checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} actual German optional-article typing/saved-snapshot/case checks: EN/KO, phone/tablet, light/dark; bare reviewed language names accepted; wrong articles rejected.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
