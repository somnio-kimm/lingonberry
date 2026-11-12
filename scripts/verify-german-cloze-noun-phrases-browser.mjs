import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const kind of ['genitive','initial','indefinite']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
  const expected=await page.evaluate(async({locale,theme,kind})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='de';
   const {createPresentation}=await import('/js/presentation/german.js');const host=document.createElement('section');document.querySelector('main').replaceChildren(host);const noun=(id,word,gen)=>({id,word,article:'der',partOfSpeech:'noun',level:'B2',meaning:word,grammar:{gender:'masculine',declension:{nom:['der '+word,null],gen:[gen,null]}}});
   const sentence=kind==='initial'?'Der Heilige Synod tagt heute.':kind==='indefinite'?'Das ist die Aussage eines Angeschuldigten.':'Der Bericht beschreibt die Aufgaben des Heiligen Synods.',answer=kind==='initial'?'Der Heilige Synod':kind==='indefinite'?'eines Angeschuldigten':'des Heiligen Synods',word=kind==='indefinite'?'Angeschuldigte':'Heilige Synod';
   const target={...noun('target',word,kind==='indefinite'?'des Angeschuldigten / eines Angeschuldigten':'des Heiligen Synods'),example:{text:sentence,focus:{start:sentence.indexOf(answer),text:answer},translation:locale==='en'?'A report about the named institution or person.':'해당 기관이나 인물에 관한 보고서.'}},foils=[noun('man','Mann','des Mannes / eines Mannes'),noun('friend','Freund','des Freundes / eines Freundes'),noun('teacher','Lehrer','des Lehrers / eines Lehrers')],study={targetLanguage:'de',explanationLanguage:locale,studyVersion:'1.0.0',entries:[target,...foils]};let app;
   const mount=()=>{app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','B2');app.setStudy(study);window.nounPhraseApp=app;return app;};window.reopenNounPhraseReview=()=>{app.stop();mount().render('wrong',host);};mount().render('cloze',host);
   const prefix=kind==='initial'?'Der ':kind==='indefinite'?'eines ':'des ',endings=kind==='initial'?['Mann','Freund','Lehrer']:['Mannes','Freundes','Lehrers'];return {sentence,answer,options:[answer,...endings.map(n=>prefix+n)]};
  },{locale,theme,kind});
  await page.locator('.cloze-option-word').first().waitFor();assert.deepEqual((await page.locator('.cloze-option-word').allTextContents()).sort(),expected.options.slice().sort());
  const choose=text=>page.locator('.opt-btn').filter({has:page.locator('.cloze-option-word').filter({hasText:new RegExp('^'+text+'$')})}).click();
  await choose(expected.options[1]);await page.locator('#quiz-next').waitFor();assert.equal(await page.locator('.sentence-quiz-text').innerText(),expected.sentence);
  await page.evaluate(()=>window.reopenNounPhraseReview());await page.locator('.wrong-entry').waitFor();await page.locator('#retest-filtered').click();await page.locator('.cloze-option-word').first().waitFor();assert.deepEqual((await page.locator('.cloze-option-word').allTextContents()).sort(),expected.options.slice().sort());await choose(expected.answer);await page.locator('#quiz-next').waitFor();assert.equal(await page.locator('.sentence-quiz-text').innerText(),expected.sentence);
  assert.ok(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.nounPhraseApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German whole noun-phrase Cloze cases: genitive, sentence-initial and indefinite articles, exact original sentence feedback, persisted Review/retest, EN/KO, phone/tablet and light/dark.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
