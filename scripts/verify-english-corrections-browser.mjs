import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const oldCore=await json('language-packages/en-core-3.0.0.json'),oldEnglish=await json('language-packages/en-en-3.0.0.json');
const core=await json('language-packages/en-core-4.0.0.json'),english=await json('language-packages/en-en-4.0.0.json'),korean=await json('language-packages/en-ko-4.0.0.json');
const descriptors=[];for(const id of ['en-core','en-en','en-ko']){const path=`language-packages/${id}-3.0.0.json`,bytes=await readFile(new URL('../'+path,import.meta.url)),data=JSON.parse(bytes);descriptors.push({id:data.id,kind:data.kind,targetLanguage:'en',version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url:'/'+path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const words=studyWords(assembleStudy(oldCore,oldEnglish)),engine=createLexiconQuestions(studyProfiles.en),questions=engine.vocabularyQuestions('vocabinput',words,'en');
const spin=oldCore.entries.find(row=>row.word==='spin'&&row.partOfSpeech==='noun'),blacksmith=oldCore.entries.find(row=>row.word==='blacksmith'),unchanged=oldCore.entries[0];
const selected=[spin.id,blacksmith.id,unchanged.id],q=selected.map(id=>questions.find(row=>row.word.id===id));
const fakeStorage=new Map(),store=createLexiconStore({getItem:key=>fakeStorage.get(key),setItem:(key,value)=>fakeStorage.set(key,value)},studyProfiles.en);
store.preference('studyLevel','all');for(const question of q){store.setWordStatus(question.word.id,'mastered');store.record(question,'old incorrect answer',false);}
const mixed={...q[2],id:q[2].id+'-mixed',mode:'vocabmeaning',options:[{id:unchanged.id,text:words.find(word=>word.id===unchanged.id).studyMeaning},{id:spin.id,text:words.find(word=>word.id===spin.id).studyMeaning}]};store.record(mixed,spin.id,false);
const saved=JSON.stringify(store.state),server=await startServer(),origin=`http://127.0.0.1:${server.address().port}`;
let browser;try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
 const tab=async name=>{await page.locator(`[data-tab=${name}]`).click();await ready();};
 await page.goto(origin);await ready();
 await page.evaluate(async({descriptors,saved})=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),{createPackageManager}=await import('/js/packages/manager.js');
  const manager=createPackageManager({storage:createPackageStorage(),baseUrl:location.href});
  for(const pair of descriptors.slice(1))await manager.installPair(descriptors[0],pair);
  localStorage.setItem('learn-language.en.lexicon.v1',saved);localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'en',explanation:'en',theme:'system',uiLanguage:'en'}));
 },{descriptors,saved});
 await page.reload();await ready();await tab('wrong');assert.equal(await page.locator('.wrong-card').count(),4,'old installation shows the seeded history');
 for(const locale of ['en','ko']){
  await tab('settings');await page.locator('#manage-packages').click();await page.locator('[data-language=en]').click();
  const row=page.locator(`[data-explanation=${locale}]`);await row.locator('.download-package').click();await row.locator('.download-package').waitFor({state:'detached'});await row.locator('.remove-package').waitFor();
 }
 for(const [locale,pair] of [['en',english],['ko',korean]]){
  await tab('settings');await page.selectOption('#target','en');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab('home');
  assert.deepEqual(await page.locator('[data-level]').evaluateAll(nodes=>nodes.map(node=>node.dataset.level)),['all',...studyProfiles.en.levels]);
  await page.locator('[data-level=all]').click();await page.locator('[data-route=wordlist]').click();await ready();await page.locator('#search-input').fill('spin');
  const row=page.locator(`[data-word="${spin.id}"]`);await row.waitFor();assert.equal(await row.locator('.wl-meaning').innerText(),pair.entries.find(entry=>entry.id===spin.id).meaning);
 }
 await tab('wrong');assert.equal(await page.locator('.wrong-card').count(),1,'corrected targets and distractors are excluded, unchanged history remains');
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')));assert.deepEqual(after.wrongs,JSON.parse(saved).wrongs);assert.deepEqual(after.wordStatus,JSON.parse(saved).wordStatus);
 const replacement=core.retiredEntries.find(row=>row.id===blacksmith.id)?.replacementId;assert.ok(replacement);assert.equal(after.wordStatus[replacement],undefined,'new concept does not inherit mastery');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await ready();for(const [locale,pair] of [['en',english],['ko',korean]]){await tab('settings');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab('home');await page.locator('[data-route=wordlist]').click();await ready();await page.locator('#search-input').fill('spin');assert.equal(await page.locator(`[data-word="${spin.id}"] .wl-meaning`).innerText(),pair.entries.find(entry=>entry.id===spin.id).meaning);}assert.deepEqual(errors,[]);
 const report={passed:true,updatedPairs:['en-en','en-ko'],sourceVersion:'3.0.0',version:'4.0.0',storedHistoryPreserved:true,staleTargetsAndDistractorsExcluded:true,replacementMasteryNotTransferred:true,bothMeaningDisplays:true,offline:true,errors};
 await mkdir('local-data/device-testing',{recursive:true});await writeFile('local-data/device-testing/english-corrections-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
