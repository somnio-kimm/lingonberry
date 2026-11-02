import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url))),catalog=await json('web/catalog.json');
const pairs=new Map(await Promise.all(['ja-en','ja-ko','en-en','en-ko'].map(async id=>[id,await json(catalog.find(row=>row.id===id).url.slice(1))])));
const old=[];for(const id of ['ja-core','ja-en','ja-ko']){const url=`/language-packages/${id}-4.4.0.json`,bytes=await readFile(new URL('..'+url,import.meta.url)),data=JSON.parse(bytes);old.push({id,kind:data.kind,targetLanguage:'ja',version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const core=await json(catalog.find(row=>row.id==='ja-core').url.slice(1)),car=core.entries.find(row=>row.word==='車'),server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,id){await page.locator(`[data-tab=${id}]`).click();await ready(page);}
async function route(page,id){await tab(page,'home');await page.locator(`[data-route=${id}]`).click();await ready(page);}
async function learning(page){const fold=page.locator('.filter-fold');await fold.evaluate(node=>{node.open=true;});await page.locator('[data-filter-status=learning]').click();await fold.evaluate(node=>{node.open=false;});}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],downloads=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/language-packages/'))downloads.push(request.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/concise-meanings',{recursive:true});
 const before=await page.evaluate(async({old,carId})=>{
  const [{createPackageStorage},{createPackageManager},{createLexiconStore},{studyProfiles,studyWords},{assembleStudy},{createLexiconQuestions}]=await Promise.all([import('/js/packages/storage.js'),import('/js/packages/manager.js'),import('/js/shared/lexicon-store.js'),import('/js/presentation/study-profiles.js'),import('/js/packages/study.js'),import('/js/shared/lexicon-questions.js')]);
  const storage=createPackageStorage(),manager=createPackageManager({storage,baseUrl:location.href});for(const pair of old.slice(1))await manager.installPair(old[0],pair);
  const core=await manager.get('ja-core','4.4.0'),pair=await manager.get('ja-en','4.4.0'),words=studyWords(assembleStudy(core,pair)),question=createLexiconQuestions(studyProfiles.ja).vocabularyQuestions('vocabinput',words,'en').find(row=>row.word.id===carId);question.contentVersion=core.version;
  const store=createLexiconStore(localStorage,studyProfiles.ja);store.preference('studyLevel','N5');store.setWordStatus(carId,'learning');store.record(question,'old wrong answer',false);
  localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'ja',explanation:'en',theme:'system',uiLanguage:'en'}));return {wordStatus:store.state.wordStatus,wrongs:store.state.wrongs};
 },{old,carId:car.id});
 await page.reload();await ready(page);downloads.length=0;
 for(const locale of ['en','ko']){await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator('[data-language=ja]').click();const row=page.locator(`[data-explanation=${locale}]`);await row.locator('.download-package').click();await row.locator('.download-package').waitFor({state:'detached'});await row.locator('.remove-package').waitFor();}
 assert.equal(downloads.filter(url=>url.includes('/ja-core-')).length,0,'Explanation-only updates reuse the installed core');
 let cases=0;
 for(const [width,theme]of [[390,'light'],[1024,'dark']])for(const explanation of ['en','ko'])for(const display of ['en','ko']){
  await page.setViewportSize({width,height:900});await tab(page,'settings');await page.selectOption('#display-language',display);await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target','ja');await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  const meaning=pairs.get('ja-'+explanation).entries.find(row=>row.id===car.id).meaning;assert.equal(meaning,explanation==='ko'?'자동차':'car');
  await route(page,'wordlist');await page.locator('#search-input').fill('車');const row=page.locator(`[data-word="${car.id}"]`);assert.equal(await row.locator('.wl-meaning').innerText(),meaning);await row.locator('.wl-main').click();assert.equal(await page.locator('.study-sheet-meaning').innerText(),meaning);await page.locator('[data-close]').click();
  await route(page,'flashcards');await learning(page);assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),car.id);if(!await page.locator('.flashcard').evaluate(node=>node.classList.contains('flipped')))await page.locator('[data-flip]').click();assert.equal(await page.locator('.flashcard-back .fc-meaning').innerText(),meaning);
  await route(page,'vocabinput');await learning(page);assert.equal(await page.locator('.vocab-prompt').innerText(),meaning);assert.equal(await page.locator('#vocab-answer').getAttribute('placeholder'),null);
  await page.screenshot({path:`/private/tmp/concise-meanings/input-${width}-${explanation}-${display}.png`,fullPage:true});
  await route(page,'vocabmeaning');const id=await page.locator('[data-question-word]').getAttribute('data-question-word'),expected=pairs.get('ja-'+explanation).entries.find(row=>row.id===id).meaning;assert.equal(await page.locator(`[data-option="${id}"]`).innerText(),expected);assert.equal(await page.locator('[data-submit]').count(),0);
  await tab(page,'wrong');assert.equal(await page.locator('.wrong-word-meaning').first().innerText(),meaning);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));cases++;
 }
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.ja.lexicon.v1')));assert.deepEqual(after.wordStatus,before.wordStatus);assert.deepEqual(after.wrongs,before.wrongs,'Explanation style updates do not rewrite stored question history');
 for(const locale of ['en','ko']){
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator('[data-language=en]').click();await page.locator(`[data-explanation=${locale}] .download-package`).click();await page.locator(`[data-package="en-${locale}"] .remove-package`).waitFor();await tab(page,'settings');await page.selectOption('#target','en');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await route(page,'wordlist');
  const row=page.locator('.wl-row').first(),id=await row.getAttribute('data-word');assert.equal(await row.locator('.wl-meaning').innerText(),pairs.get('en-'+locale).entries.find(entry=>entry.id===id).meaning);
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await page.context().setOffline(true);await page.reload();await ready(page);await tab(page,'settings');await page.selectOption('#target','ja');await page.selectOption('#explanation','ko');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await route(page,'wordlist');await page.locator('#search-input').fill('車');assert.equal(await page.locator(`[data-word="${car.id}"] .wl-meaning`).innerText(),'자동차');assert.deepEqual(errors,[]);
 console.log(`Passed ${cases} concise Japanese display scenarios: Word List/details, Flashcards, Meaning Quiz, Word Input and Review; EN/KO display independently of Explanation, phone/tablet, themes, explanation-only update without core re-download, intact progress/history, English self-definitions and offline use.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
