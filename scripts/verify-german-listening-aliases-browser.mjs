import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'de-DE',localService:true}],cancel(){},speak(utterance){window.spokenAliasWord=utterance.text;setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='de';
   const {createPresentation}=await import('/js/presentation/german.js');const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const study={targetLanguage:'de',explanationLanguage:locale,studyVersion:'99.0.1',entries:[{id:'hurt',word:'weh tun',partOfSpeech:'verb',level:'A1',meaning:locale==='en'?'hurt':'아프다',aliases:['wehtun','schmerzen'],listeningAliases:['wehtun']}]};let app;
   const mount=()=>{app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','A1');app.setStudy(study);window.aliasApp=app;return app;};window.reopenAliasReview=()=>{app.stop();mount().render('wrong',host);};mount().render('listening',host);
  },{locale,theme});
  await page.locator('button[data-listening-mode=listenword]').click();await page.locator('#listening-answer').fill('wehtun');assert.equal(await page.locator('#listening-submit').isEnabled(),false);
  await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);assert.equal(await page.evaluate(()=>window.spokenAliasWord),'weh tun');await page.locator('#listening-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
  await page.locator('#listening-next').click();await page.locator('#listening-answer').fill('schmerzen');await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
  const record=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.listenword)[0]);assert.deepEqual(record.attempts.map(a=>a.correct),[true,false]);assert.deepEqual(record.questionSnapshot.acceptedAnswers,['weh tun','wehtun']);
  await page.evaluate(()=>window.reopenAliasReview());await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();await page.locator('#listening-answer').fill('wehtun');await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
  assert.ok(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.aliasApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German Word Dictation spelling cases: exact spoken word, heard-before-submit gate, curated alias acceptance, ordinary search synonym rejection and saved Review/retest in EN/KO, phone/tablet and light/dark.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
