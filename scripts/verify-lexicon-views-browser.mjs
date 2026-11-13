import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer(),directory=join(tmpdir(),'lingonberry-lexicon-views');let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage(),errors=[];
 await context.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>['en-GB','ja-JP'].map(lang=>({lang,localService:true})),cancel(){},speak(utterance){window.viewSpokenText=utterance.text;setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});
 page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir(directory,{recursive:true});let scenarios=0;
 for(const language of ['en','ja'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  const sample=await page.evaluate(async({language,locale,theme})=>{
   window.viewCleanup?.();window.viewApp?.stop();window.viewSpokenText=null;document.querySelectorAll('.quiz-feedback-burst').forEach(node=>node.remove());
   const [{createPresentation},{assembleStudy},{createLexiconStore},{studyWords,studyProfiles}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js'),import('/js/shared/lexicon-store.js'),import('/js/presentation/study-profiles.js')]);
   window.viewStudies||=new Map();const key=language+'-'+locale;
   if(!window.viewStudies.has(key)){const catalog=await fetch('/catalog.json').then(r=>r.json()),pair=await fetch(catalog.find(row=>row.id===key).url).then(r=>r.json()),core=await fetch(catalog.find(row=>row.id===language+'-core'&&row.version===pair.studyVersion).url).then(r=>r.json());window.viewStudies.set(key,assembleStudy(core,pair));}
   const original=window.viewStudies.get(key),level=studyProfiles[language].levels[0],entries=original.entries.filter(row=>row.level===level&&!row.word.includes(' ')).slice(0,2),study={...original,entries},words=studyWords(study);
   if(entries.length!==2)throw new Error('Missing real dictionary view samples');
   localStorage.removeItem(`learn-language.${language}.lexicon.v1`);const store=createLexiconStore(localStorage,studyProfiles[language]);store.setWordStatus(words[0].id,'learning');
   store.record({mode:'vocabinput',id:'view-history-'+words[0].id,locale,contentVersion:study.studyVersion,word:words[0],prompt:words[0].studyMeaning,answer:words[0].lemma,acceptedAnswers:[words[0].lemma]},'view-wrong-answer',false);
   const host=document.querySelector('main');let route='wordlist',cleanup,app;
   const refresh=()=>{cleanup?.();cleanup=app.render(route,host);};app=createPresentation({language,navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app.setStudy(study);app.setPreferences({theme,uiLanguage:locale});app.settings.change('studyLevel',level);document.documentElement.dataset.theme=theme;document.querySelector('#style-de').disabled=false;document.querySelector('#style-zh').disabled=true;
   window.viewRoute=value=>{route=value;refresh();};window.viewApp=app;window.viewCleanup=()=>{cleanup?.();app.stop();};refresh();
   return {first:{id:words[0].id,word:words[0].lemma,meaning:words[0].studyMeaning},second:{id:words[1].id,word:words[1].lemma,meaning:words[1].studyMeaning}};
  },{language,locale,theme});
  const search=page.locator('#search-input');await search.fill(sample.first.word);const row=page.locator(`[data-word="${sample.first.id}"]`);await row.waitFor();assert.equal(await search.evaluate(node=>node===document.activeElement),true);
  await row.locator('[data-row-speak]').focus();await row.locator('[data-row-speak]').press('Enter');await page.waitForFunction(()=>!!window.viewSpokenText);assert.equal(await page.locator('[role=dialog]').count(),0,'Speaker keyboard activation must not open details');
  await row.locator('.wl-main').focus();await row.locator('.wl-main').press('Enter');await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-sheet-meaning').innerText(),sample.first.meaning);await page.keyboard.press('Escape');
  await page.locator('main').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}-wordlist.png`),fullPage:true});
  await page.evaluate(()=>window.viewRoute('flashcards'));assert.ok((await page.locator('#flashcard-count').innerText()).includes('2'));await page.locator('[data-flip]').press('Enter');assert.equal(await page.locator('.flashcard').getAttribute('class'),'flashcard flipped');assert.equal(await page.locator('.flashcard-front').getAttribute('aria-hidden'),'true');assert.equal(await page.locator('.flashcard-back').getAttribute('aria-hidden'),'false');
  await page.locator('main').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}-flashcards.png`),fullPage:true});
  if(language==='en'&&locale==='en')assert.equal(await page.locator('.flashcard-back .example-translation').count(),0);
  await page.locator('[data-next-card]').click();assert.equal(await page.locator('.flashcard').evaluate(node=>node.classList.contains('flipped')),false);await page.locator('[data-shuffle]').click();assert.ok((await page.locator('#flashcard-count').innerText()).includes('2'));
  await page.locator('.flashcard:not(.flipped) [data-card-status]').first().click();await page.locator('[role=dialog]').waitFor();await page.keyboard.press('Escape');
  await page.evaluate(()=>window.viewRoute('wrong'));await page.locator('.wrong-entry').waitFor();assert.equal(await page.locator('.wrong-word-meaning').innerText(),sample.first.meaning);assert.ok((await page.locator('.wrong-entry').innerText()).includes('view-wrong-answer'));
  await page.locator('main').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}-review.png`),fullPage:true});
  await page.locator('.wrong-entry').click();await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-sheet-meaning').innerText(),sample.first.meaning);await page.keyboard.press('Escape');
  await page.locator('[data-retest]').click();await page.locator('#vocab-answer').fill(sample.first.word);await page.locator('[data-submit]').click();await page.locator('.vocab-answer-cell.correct').waitFor();await page.locator('[data-next]').click();await page.locator('[data-finish]').click();assert.ok((await page.locator('.wrong-count').innerText()).includes('0'));
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-clear]').click();assert.equal(await page.locator('.wrong-entry').count(),1);page.once('dialog',dialog=>dialog.accept());await page.locator('[data-clear]').click();await page.locator('.empty-wrong').waitFor();
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await page.locator('main').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}.png`),fullPage:true});scenarios++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${scenarios} real-package Word List/Flashcards/Review scenarios: search focus, speaker/row keyboard actions, details, flip/shuffle/navigation, saved retest and confirmed deletion across EN/JA, EN/KO, phone/tablet and themes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
