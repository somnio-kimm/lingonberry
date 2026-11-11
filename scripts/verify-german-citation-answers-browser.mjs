import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const kind of ['noun','verb']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  const expected=await page.evaluate(async({locale,theme,kind})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});
   const entry=kind==='noun'?{id:'citation',word:'Arabisch',article:'das',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'Arabic':'아랍어',grammar:{declension:{nom:['das Arabisch / Arabische',null]}}}
    :{id:'citation',word:'kümmern',partOfSpeech:'verb',level:'A1',meaning:locale==='en'?'to take care of':'돌보다',grammar:{infinitive:'sich kümmern',source_related_forms:['kümmert']}};
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[entry]});app.render('vocabinput',host);window.citationApp=app;window.citationHost=host;
   return {canonical:kind==='noun'?'das Arabisch':'kümmern',accepted:kind==='noun'?'das Arabische':'sich kümmern',wrong:kind==='noun'?'Arabische':'mich kümmern'};
  },{locale,theme,kind});
  await page.locator('#vocab-answer').fill(expected.accepted);await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
  assert.equal(await page.locator('.vocab-correction').innerText(),expected.canonical);assert.equal(await page.locator('.vocab-wrong').count(),0);
  await page.locator('#vocab-next').click();await page.locator('#vocab-answer').fill(expected.wrong);await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
  const snapshot=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.vocabinput)[0].questionSnapshot);
  assert.ok(snapshot.acceptedAnswers.includes(expected.accepted));assert.ok(snapshot.acceptedAnswers.includes(expected.canonical));
  await page.evaluate(()=>window.citationApp.render('wrong',window.citationHost));await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();
  await page.locator('#vocab-answer').fill(expected.accepted);await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.citationApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German citation-answer browser checks: noun/verb, EN/KO, phone/tablet, light/dark and actual saved Review/retest; article and infinitive boundaries preserved.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
