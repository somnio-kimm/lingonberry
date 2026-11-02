import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';

const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir('/private/tmp/english-examples',{recursive:true});let checks=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const display of ['en','ko'])for(const explanation of ['en','ko']){
  await page.setViewportSize({width,height:1000});
  const samples=await page.evaluate(async({theme,display,explanation})=>{
   window.exampleCleanup?.();window.exampleApp?.stop();
   const [{assembleStudy},{studyWords,studyProfiles},{selectWordExample},{createSentenceEngine},{createPresentation},{presentationDefinitions}]=await Promise.all([import('/js/packages/study.js'),import('/js/presentation/study-profiles.js'),import('/js/shared/word-example.js'),import('/js/shared/lexicon-sentences.js'),import('/js/presentation/multilingual.js'),import('/js/presentation/index.js')]);
   window.examplePackages||=new Map();const read=async id=>{if(!window.examplePackages.has(id)){const catalog=await fetch('/catalog.json').then(r=>r.json()),descriptor=catalog.find(row=>row.id===id);window.examplePackages.set(id,await fetch(descriptor.url).then(r=>r.json()));}return window.examplePackages.get(id);};
   const core=await read('en-core'),pair=await read('en-'+explanation),study=assembleStudy(core,pair),words=studyWords(study);
   if(!core.contentReview?.completionReview?.fullCoverage)throw new Error('English completion is not released');
   const translations=new Map(pair.entries.map(row=>[row.id,row.exampleTranslation]));
   for(const word of words){const selected=selectWordExample(word,'en');if(!selected?.text||selected.text!==word.examples[0]?.text||(explanation==='ko'?selected.studyTranslation!==translations.get(word.id):selected.studyTranslation!==undefined))throw new Error('Missing or incorrect dictionary example '+word.id);}
   const engine=createSentenceEngine(studyProfiles.en),scramble=engine.createSentencePool('scramble',words,explanation).all(()=>.3),cloze=engine.createSentencePool('cloze',words,explanation).all(()=>.3);if(new Set(scramble.map(row=>row.word.id)).size!==words.length)throw new Error('Not every word has a usable sentence-scramble example');
   const host=document.querySelector('main'),definition=presentationDefinitions.en;host.parentElement.id=definition.layout.root;host.id=definition.layout.main;document.querySelector('nav').id=definition.layout.tabs;document.querySelector('#style-de').disabled=false;document.querySelector('#style-zh').disabled=true;document.documentElement.dataset.theme=theme;document.documentElement.lang=display==='ko'?'ko':'en-GB';
   let current='wordlist';const app=createPresentation({language:'en',navigate(){},refresh(){window.exampleCleanup?.();window.exampleCleanup=app.render(current,host);},onPreferences(){}});app.setStudy(study);app.setPreferences({uiLanguage:display,theme});window.exampleApp=app;window.exampleRender=(level,route)=>{window.exampleCleanup?.();current=route;app.settings.change('studyLevel',level);window.exampleCleanup=app.render(route,host);};
   return studyProfiles.en.levels.map(level=>{const word=words.find(row=>row.level===level&&row.examples[0]?.provenance?.editorialReview?.status==='checked');if(!word||!cloze.some(row=>row.word.id===word.id))throw new Error('New reviewed example unavailable in '+level);return {id:word.id,word:word.lemma,level,text:word.examples[0].text,translation:translations.get(word.id),entries:words.length};});
  },{theme,display,explanation});
  for(const sample of samples){
   await page.evaluate(level=>window.exampleRender(level,'wordlist'),sample.level);await page.locator('#search-input').fill(sample.word);await page.locator(`[data-word="${sample.id}"]`).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('.study-examples h3').innerText(),display==='ko'?'예문':'Examples');assert.equal(await dialog.locator('.example-sentence').innerText(),sample.text);assert.equal(await dialog.locator('[data-example]').count(),1);
   if(explanation==='ko')assert.equal(await dialog.locator('.study-example .muted').innerText(),sample.translation);else assert.equal(await dialog.locator('.study-example .muted').count(),0);
   assert.equal(await dialog.getByText('No Example Available',{exact:true}).count(),0);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await dialog.screenshot({path:`/private/tmp/english-examples/${width}-${theme}-${display}-${explanation}-${checks}.png`});await dialog.locator('[data-close]').click();
   await page.evaluate(level=>window.exampleRender(level,'flashcards'),sample.level);if(await page.locator('.flashcard-front').getAttribute('aria-hidden')==='false')await page.locator('[data-flip]').click();await page.locator('.flashcard-back[aria-hidden=false]').waitFor();assert.ok((await page.locator('.flashcard-back .example-sentence').innerText()).trim());assert.equal(await page.locator('.flashcard-back .example-translation').count(),explanation==='ko'?1:0);checks++;
  }
 }
 await page.evaluate(()=>{window.exampleCleanup?.();window.exampleApp?.stop();});assert.deepEqual(errors,[]);console.log(`Passed ${checks} English Word List/Flashcard example displays across all study levels, phone/tablet, light/dark and independent display/explanation languages; all entries have primary examples, Korean translations and usable scramble sentences.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
