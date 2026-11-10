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
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[{id:'alias-fixture',word:'Joghurt',aliases:['Jogurt'],article:'der',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'yoghurt':'요구르트'}]});
   app.render('vocabinput',host);window.aliasPresentation=app;window.aliasHost=host;
  },{locale,theme});
  await page.locator('#vocab-answer').fill('der Jogurt');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();assert.equal(await page.locator('.vocab-correction').innerText(),'der Joghurt');
  assert.equal(await page.locator('.vocab-wrong').count(),0);
  await page.locator('#vocab-next').click();await page.locator('#vocab-answer').fill('Jogurt');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
  const snapshot=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.vocabinput)[0].questionSnapshot);
  assert.deepEqual(snapshot.acceptedAnswers,['der Joghurt','der Jogurt']);assert.equal(snapshot.contentVersion,'4.0.0');
  await page.evaluate(()=>window.aliasPresentation.render('wrong',window.aliasHost));await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();
  await page.locator('#vocab-answer').fill('der Jogurt');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} actual German alias typing/saved-snapshot checks: EN/KO, phone/tablet, light/dark; bare nouns still rejected.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
