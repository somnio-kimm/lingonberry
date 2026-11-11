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
   const entry=(id,word,level,grammar)=>({id,word,level,partOfSpeech:'verb',meaning:locale==='en'?'happen':'일어나다',grammar});
   const study={targetLanguage:'de',explanationLanguage:locale,studyVersion:'99.0.2',entries:[
    entry('event','geschehen','B1',{verb_persons:['er','sie'],infinitive:'geschehen',forms:{praesens:{er:'geschieht',sie:'geschehen'},praeteritum:{er:'geschah',sie:'geschahen'},konjunktiv_ii:{er:'geschähe',sie:'geschähen'},perfekt:'ist geschehen'}}),
    entry('have','haben','A1',{forms:{praesens:forms(['habe','hast','hat','haben','habt','haben']),praeteritum:forms(['hatte','hattest','hatte','hatten','hattet','hatten'])}}),
    entry('be','sein','A1',{forms:{praesens:forms(['bin','bist','ist','sind','seid','sind']),praeteritum:forms(['war','warst','war','waren','wart','waren'])}}),
   ]};let app;const mount=()=>{app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','B1');app.setStudy(study);window.personApp=app;return app;};window.personHost=host;window.reopenPersons=()=>{app.stop();mount().render('wrong',host);};mount().render('verbforms',host);
  },{locale,theme});
  await page.locator('#grammar-tense').waitFor();
  for(const tense of ['praesens','praeteritum','perfekt','plusquamperfekt','futur_i','futur_ii','konjunktiv_ii']){
   await page.locator('#grammar-tense').selectOption(tense);
   for(const person of ['er','sie']){await page.locator('#grammar-person').selectOption(person);assert.equal(await page.locator('.grammar-question').getAttribute('data-question-id'),`event:${tense}:${person}`);}
   for(const person of ['ich','du','wir','ihr']){await page.locator('#grammar-person').selectOption(person);assert.equal(await page.locator('.grammar-question').count(),0);assert.equal(await page.locator('#form-answer').count(),0);}
  }
  await page.locator('#grammar-person').selectOption('er');await page.locator('#grammar-tense').selectOption('praesens');await page.locator('#form-answer').fill('deliberately wrong');await page.locator('#grammar-submit').click();await page.locator('#grammar-next').waitFor();
  const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.verbforms['event:praesens:er'].questionSnapshot);assert.deepEqual(snapshot.word.verb_persons,['er','sie']);
  await page.evaluate(()=>window.reopenPersons());await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();await page.locator('#form-answer').waitFor();assert.equal(await page.locator('.grammar-question').getAttribute('data-question-id'),'event:praesens:er');await page.locator('#form-answer').fill('geschieht');await page.locator('#grammar-submit').click();await page.locator('#grammar-next').waitFor();assert.ok(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.personApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} restricted German verb-person browser cases: all seven tenses, two allowed/four withheld persons, EN/KO, phone/tablet, light/dark, persisted Review/retest and unchanged controls.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
