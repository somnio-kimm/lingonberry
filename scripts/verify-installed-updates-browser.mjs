import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8'),swift=await read('mobile/ios/App/App/NativePackageVerification.swift');
const script=swift.split('// BEGIN INSTALLED_PACKAGE_UPDATE_CHECK')[1].split('// END INSTALLED_PACKAGE_UPDATE_CHECK')[0];
const capture=swift.split('static let progressCaptureScript = """')[1].split('"""')[0];
const currentCatalog=JSON.parse(await read('language-packages/catalog.json'));
const currentJaCore=JSON.parse(await read(currentCatalog.find(row=>row.id==='ja-core').url.slice(1)));
const expectedPairs=new Map(currentCatalog.filter(row=>row.kind==='explanation'&&(row.targetLanguage==='ja'||row.id==='en-en')).map(row=>[row.id,row]));
const english={core:currentCatalog.find(row=>row.id==='en-core'),pair:currentCatalog.find(row=>row.id==='en-en')};
const descriptors=[];for(const id of ['ja-core','ja-en','ja-ko']){const url=`/language-packages/${id}-4.4.0.json`,text=await read(url.slice(1)),data=JSON.parse(text);descriptors.push({id,kind:data.kind,targetLanguage:'ja',version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});}
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],requests=[];await page.addInitScript(capture);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/language-packages/'))requests.push(request.url());});
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();
 await page.evaluate(async({descriptors,english})=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),{createPackageManager}=await import('/js/packages/manager.js');const manager=createPackageManager({storage:createPackageStorage(),baseUrl:location.href});for(const pair of descriptors.slice(1))await manager.installPair(descriptors[0],pair);await manager.installPair(english.core,english.pair);
  localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify({version:1,wordStatus:{'native-migration-fixture':'learning'},wrongs:{'fixture':{id:'fixture',input:'original answer',count:2,question:{id:'fixture',mode:'vocabinput',word:{id:'native-migration-fixture'},answer:'original word'}}},preferences:{uiLanguage:'en',studyLevel:'IELTS 1.0–3.5'}}));
  localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'ja',explanation:'ko',theme:'system',uiLanguage:'ko'}));
 },{descriptors,english});await page.reload();await ready();
 const beforeCanonical=await page.evaluate(async()=>{const {createLexiconStorage}=await import('/js/shared/lexicon-storage.js');const state=await createLexiconStorage().load('ja');return {wordStatus:state.wordStatus,wrongs:state.wrongs};});
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key!=='learn-language.preferences.v1')));requests.length=0;
 const run=(body=script)=>page.evaluate(async script=>{
  const wait=async predicate=>{const deadline=Date.now()+45000;while(!predicate()){if(Date.now()>deadline)throw new Error('Timed out in installed update browser check');await new Promise(resolve=>setTimeout(resolve,50));}};
  const select=(id,value)=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;return JSON.parse(await new AsyncFunction('wait','select','updateInstalled',script)(wait,select,true));
 },body);
 const first=await run();assert.equal(first.webVersion,JSON.parse(await read('package.json')).version);assert.equal(first.passed,true);assert.equal(first.progressMigration.find(row=>row.language==='en').preserved,true);assert.equal(first.progressMigration.find(row=>row.language==='en').statuses,1);assert.equal(first.progressMigration.find(row=>row.language==='en').wrongs,1);assert.equal(first.restored,'ja');assert.deepEqual(first.checks.map(row=>row.id).sort(),['en-en','ja-en','ja-ko']);assert.ok(first.checks.filter(row=>row.id.startsWith('ja-')).every(row=>row.to===expectedPairs.get(row.id).version&&row.studyVersion===expectedPairs.get(row.id).studyVersion&&row.updated&&row.words===currentJaCore.entries.length&&row.examples===currentJaCore.entries.length&&row.translations===currentJaCore.entries.length));assert.equal(requests.filter(url=>url.includes('/ja-core-')).length,currentJaCore.version===descriptors[0].version?0:1);
 const checkedEnglish=first.checks.find(row=>row.id==='en-en');assert.equal(checkedEnglish.to,english.pair.version);assert.equal(checkedEnglish.updated,false);assert.ok(checkedEnglish.groupedHeadwords.every(row=>row.word==='appeal'&&row.senses>0));assert.equal(checkedEnglish.vocabularyLearning.savedExample,true);
 requests.length=0;const again=await run();assert.ok(again.checks.every(row=>!row.updated));assert.deepEqual(requests,[],'Current pairs are not downloaded again and uninstalled languages are not installed');
 const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key!=='learn-language.preferences.v1')));const legacyKey='learn-language.en.lexicon.v1';assert.equal(JSON.parse(after[legacyKey]).version,2);const pending=JSON.parse(after[legacyKey+'.pending']);assert.deepEqual(pending.statuses,{});assert.deepEqual(pending.wrongs,{});delete after[legacyKey+'.pending'];delete before[legacyKey];delete after[legacyKey];for(const key of Object.keys(after).filter(key=>key.endsWith('.lexicon.v1.pending'))){const value=JSON.parse(after[key]);assert.equal(value.base,null);assert.deepEqual(value.statuses,{});assert.deepEqual(value.wrongs,{});delete before[key];delete after[key];}assert.deepEqual(after,before,'Non-journal progress is unchanged');const afterCanonical=await page.evaluate(async()=>{const {createLexiconStorage}=await import('/js/shared/lexicon-storage.js');const state=await createLexiconStorage().load('ja');return {wordStatus:state.wordStatus,wrongs:state.wrongs};});assert.deepEqual(afterCanonical,beforeCanonical,'Temporary preference checks never alter learner records');const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.preferences.v1')));assert.equal(preferences.target,'ja');assert.equal(preferences.explanation,'ko');assert.equal(preferences.uiLanguage,'ko');assert.equal(preferences.theme,'system');assert.deepEqual(errors,[]);
 const savedSettings=await page.evaluate(()=>Object.fromEntries(['learn-language.preferences.v1','learn-language.flashcards.setSize.v1'].map(key=>[key,localStorage.getItem(key)])));
 for(const stage of ['flashcards-restore','sound-restore']){
  const interrupted=script.replace("console.log('NATIVE_UX_STAGE '+stage);","console.log('NATIVE_UX_STAGE '+stage);if(stage.endsWith(':"+stage+"'))throw new Error('Injected interruption: "+stage+"');");
  await assert.rejects(run(interrupted),new RegExp('Injected interruption: '+stage));
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['learn-language.preferences.v1','learn-language.flashcards.setSize.v1'].map(key=>[key,localStorage.getItem(key)]))),savedSettings,'Interrupted verification restores temporary settings');
  assert.equal(await page.evaluate(async()=>{const {AnswerSounds}=await import('/js/shared/answer-sounds.js');return AnswerSounds.enabled;}),false,'Interrupted sound probe restores the feedback service');
  await page.reload();await ready();
 }
 const offline=swift.split('static let offlineScript = """')[1].split('"""')[0];
 assert.equal(await page.evaluate(async offline=>{const saved=window.fetch;new Function(offline)();let blocked=false;try{await fetch('https://example.com/native-qa');}catch(error){blocked=error.message==='Native offline test';}window.__lingonberryRestoreFetch();return blocked&&window.fetch===saved&&!window.__lingonberryRestoreFetch;},offline),true,'Offline verification restores the original fetch function');
 console.log('Passed real native DEBUG update-script browser checks: installed pairs only, independent explanation/core versions, complete Japanese examples/short meanings, real English grouped-word queries, restored selection, intact progress, no repeated downloads and interruption cleanup.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
