import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
const language=process.argv.includes('--japanese')?'ja':'en',name=language==='ja'?'japanese':'english';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const oldCore=await json(`language-packages/${language}-core-3.0.0.json`),oldEnglish=await json(`language-packages/${language}-en-3.0.0.json`);
const core=await json(`language-packages/${language}-core-4.0.0.json`),english=await json(`language-packages/${language}-en-4.0.0.json`),korean=await json(`language-packages/${language}-ko-4.0.0.json`);
const descriptors=[];for(const id of [language+'-core',language+'-en',language+'-ko']){const path=`language-packages/${id}-3.0.0.json`,bytes=await readFile(new URL('../'+path,import.meta.url)),data=JSON.parse(bytes);descriptors.push({id:data.id,kind:data.kind,targetLanguage:language,version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url:'/'+path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const words=studyWords(assembleStudy(oldCore,oldEnglish)),engine=createLexiconQuestions(studyProfiles[language]),questions=engine.vocabularyQuestions('vocabinput',words,'en');
const search=language==='ja'?'どう':'spin',correctedEntry=oldCore.entries.find(row=>row.word===search&&(language==='ja'||row.partOfSpeech==='noun')),replacedEntry=oldCore.entries.find(row=>core.retiredEntries.some(retired=>retired.id===row.id&&retired.replacementId&&!retired.sameConcept)),unchanged=oldCore.entries.find(row=>!core.reviewInvalidations.some(change=>change.id===row.id));
assert.ok(correctedEntry&&replacedEntry&&unchanged,'changed, replaced and unchanged cases exist');
const correctedLevel=studyWords(core).find(word=>word.id===correctedEntry.id).level;
const selected=[correctedEntry.id,replacedEntry.id,unchanged.id],q=selected.map(id=>questions.find(row=>row.word.id===id));
const fakeStorage=new Map(),store=createLexiconStore({getItem:key=>fakeStorage.get(key),setItem:(key,value)=>fakeStorage.set(key,value)},studyProfiles[language]);
store.preference('studyLevel',studyProfiles[language].levels[0]);for(const question of q){store.setWordStatus(question.word.id,'mastered');store.record(question,'old incorrect answer',false);}
const mixed={...q[2],id:q[2].id+'-mixed',mode:'vocabmeaning',options:[{id:unchanged.id,text:words.find(word=>word.id===unchanged.id).studyMeaning},{id:correctedEntry.id,text:words.find(word=>word.id===correctedEntry.id).studyMeaning}]};store.record(mixed,correctedEntry.id,false);
const legacyState=structuredClone(store.state);legacyState.preferences.studyLevel='all';
const saved=JSON.stringify(legacyState),server=await startServer(),origin=`http://127.0.0.1:${server.address().port}`;
let browser;try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
 const tab=async name=>{await page.locator(`[data-tab=${name}]`).click();await ready();};
 const reviewCount=async()=>{let count=0;for(const level of studyProfiles[language].levels){await tab('home');await page.locator(`[data-level="${level}"]`).click();await tab('wrong');count+=await page.locator('.wrong-card').count();}return count;};
 await page.goto(origin);await ready();
 await page.evaluate(async({descriptors,saved,language})=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),{createPackageManager}=await import('/js/packages/manager.js');
  const manager=createPackageManager({storage:createPackageStorage(),baseUrl:location.href});
  for(const pair of descriptors.slice(1))await manager.installPair(descriptors[0],pair);
  localStorage.setItem(`learn-language.${language}.lexicon.v1`,saved);localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:language,explanation:'en',theme:'system',uiLanguage:'en'}));
 },{descriptors,saved,language});
 await page.reload();await ready();await tab('home');assert.equal(await page.locator('[data-level=all]').count(),0);assert.equal(await page.locator(`[data-level="${studyProfiles[language].levels[0]}"]`).getAttribute('aria-pressed'),'true');assert.equal(await reviewCount(),4,'old installation shows the seeded history');
 for(const locale of ['en','ko']){
  await tab('settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();
  const row=page.locator(`[data-explanation=${locale}]`);await row.locator('.download-package').click();await row.locator('.download-package').waitFor({state:'detached'});await row.locator('.remove-package').waitFor();
 }
 for(const [locale,pair] of [['en',english],['ko',korean]]){
  await tab('settings');await page.selectOption('#target',language);await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab('home');
  assert.deepEqual(await page.locator('[data-level]').evaluateAll(nodes=>nodes.map(node=>node.dataset.level)),studyProfiles[language].levels);
  await page.locator(`[data-level="${correctedLevel}"]`).click();await page.locator('[data-route=wordlist]').click();await ready();await page.locator('#search-input').fill(search);
  const row=page.locator(`[data-word="${correctedEntry.id}"]`);await row.waitFor();assert.equal(await row.locator('.wl-meaning').innerText(),pair.entries.find(entry=>entry.id===correctedEntry.id).meaning);
 }
 assert.equal(await reviewCount(),1,'corrected targets and distractors are excluded, unchanged history remains');
 const after=await page.evaluate(language=>JSON.parse(localStorage.getItem(`learn-language.${language}.lexicon.v1`)),language);assert.deepEqual(after.wrongs,JSON.parse(saved).wrongs);assert.deepEqual(after.wordStatus,JSON.parse(saved).wordStatus);
 const replacement=core.retiredEntries.find(row=>row.id===replacedEntry.id)?.replacementId;assert.ok(replacement);assert.equal(after.wordStatus[replacement],undefined,'new concept does not inherit mastery');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await ready();for(const [locale,pair] of [['en',english],['ko',korean]]){await tab('settings');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab('home');await page.locator(`[data-level="${correctedLevel}"]`).click();await page.locator('[data-route=wordlist]').click();await ready();await page.locator('#search-input').fill(search);assert.equal(await page.locator(`[data-word="${correctedEntry.id}"] .wl-meaning`).innerText(),pair.entries.find(entry=>entry.id===correctedEntry.id).meaning);}assert.deepEqual(errors,[]);
 const report={passed:true,updatedPairs:[language+'-en',language+'-ko'],sourceVersion:'3.0.0',version:'4.0.0',storedHistoryPreserved:true,staleTargetsAndDistractorsExcluded:true,replacementMasteryNotTransferred:true,bothMeaningDisplays:true,offline:true,errors};
 await mkdir('local-data/device-testing',{recursive:true});await writeFile(`local-data/device-testing/${name}-corrections-browser.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
