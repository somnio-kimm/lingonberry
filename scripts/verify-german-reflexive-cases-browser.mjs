import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='de';
   const {createPresentation}=await import('/js/presentation/german.js');const host=document.createElement('section');document.querySelector('main').replaceChildren(host);const persons=['ich','du','er','wir','ihr','sie'],forms=values=>Object.fromEntries(persons.map((person,i)=>[person,values[i]]));
   const entry=(id,word,level,grammar)=>({id,word,level,partOfSpeech:'verb',meaning:locale==='en'?'introduce; imagine':'소개하다; 상상하다',grammar});
   const study={targetLanguage:'de',explanationLanguage:locale,studyVersion:'99.0.2',entries:[
    entry('introduce','vorstellen','B1',{reflexive_case:'accusative / dative',infinitive:'vorstellen / sich vorstellen',forms:{perfekt:'hat vorgestellt / hat sich vorgestellt'}}),
    entry('have','haben','A1',{forms:{praesens:forms(['habe','hast','hat','haben','habt','haben']),praeteritum:forms(['hatte','hattest','hatte','hatten','hattet','hatten'])}}),
    entry('be','sein','A1',{forms:{praesens:forms(['bin','bist','ist','sind','seid','sind']),praeteritum:forms(['war','warst','war','waren','wart','waren'])}}),
   ]};let app;const mount=()=>{app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','B1');app.setStudy(study);window.personApp=app;return app;};window.personHost=host;window.reopenPersons=()=>{app.stop();mount().render('wrong',host);};mount().render('verbforms',host);
  },{locale,theme});
  await page.locator('#grammar-tense').waitFor();
  for(const [tense,answer]of [['perfekt','habe mir vorgestellt'],['plusquamperfekt','hatte mich vorgestellt'],['futur_i','werde mir vorstellen'],['futur_ii','werde mich vorgestellt haben']]){
   await page.locator('#grammar-tense').selectOption(tense);await page.locator('#grammar-person').selectOption('ich');
   assert.equal(await page.locator('.grammar-question').getAttribute('data-question-id'),`introduce:${tense}:ich`);
   await page.locator('#form-answer').fill(answer);await page.locator('#grammar-submit').click();await page.locator('#grammar-next').waitFor();
   const record=await page.evaluate(id=>JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.verbforms[id],`introduce:${tense}:ich`);assert.equal(record.attempts.at(-1).correct,true);await page.locator('#grammar-next').click();
  }
  await page.locator('#grammar-tense').selectOption('perfekt');await page.locator('#grammar-person').selectOption('ich');await page.locator('#form-answer').fill('habe sich vorgestellt');await page.locator('#grammar-submit').click();await page.locator('#grammar-next').waitFor();
  const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.verbforms['introduce:perfekt:ich'].questionSnapshot);assert.deepEqual(snapshot.acceptedAnswers,['habe vorgestellt','habe mich vorgestellt','habe mir vorgestellt']);
  await page.evaluate(()=>window.reopenPersons());await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();await page.locator('#form-answer').waitFor();assert.equal(await page.locator('.grammar-question').getAttribute('data-question-id'),'introduce:perfekt:ich');await page.locator('#form-answer').fill('habe mich vorgestellt');await page.locator('#grammar-submit').click();await page.locator('#grammar-next').waitFor();assert.ok(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.personApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German reflexive-case browser cases: valid accusative/dative answers in four derived tenses, EN/KO, phone/tablet, light/dark and persisted Review/retest.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
