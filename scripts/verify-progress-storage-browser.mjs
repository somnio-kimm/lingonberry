import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
import {fixture,explanationFixture} from '../tests/package-fixture.js';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 const migrated=await page.evaluate(async()=>{
  const [{createLexiconStore},{createLexiconStorage},{studyProfiles}]=await Promise.all([import('/js/shared/lexicon-store.js'),import('/js/shared/lexicon-storage.js'),import('/js/presentation/study-profiles.js')]);
  window.progressFixture={createLexiconStore,createLexiconStorage,studyProfiles};
  const q={mode:'vocabinput',id:'house:ko',locale:'ko',word:{id:'house',lemma:'house',level:studyProfiles.en.levels[0],pronunciation:'haʊs',studyLanguage:'en',studyExplanationLanguage:'ko',studyMeaning:'집',aliases:['home'],search:'large search '.repeat(1000),examples:[{text:'Unselected example.'}]},prompt:'집',answer:'house',example:{text:'The house is small.',studyTranslation:'그 집은 작아요.'}};
  const old=createLexiconStore(localStorage,studyProfiles.en);old.record(q,'legacy-wrong',false);Object.values(old.state.wrongs)[0].question=structuredClone(q);old.setWordStatus('house','mastered');old.preference('theme','dark');const before=structuredClone(old.state);
  const backend=createLexiconStorage(indexedDB,'lingonberry-progress-browser'),store=createLexiconStore(localStorage,studyProfiles.en,{progressStorage:backend});await store.ready();if(JSON.stringify(store.state)!==JSON.stringify(before))throw new Error('Legacy history changed');
  store.record({...q,id:'new-question'},'new-wrong',false);await store.flush();window.progressStore=store;window.progressQuestion=q;
  const row=Object.values(store.state.wrongs).find(row=>row.question.id==='new-question');
  return {legacy:Object.values(store.state.wrongs).find(row=>row.question.id===q.id).question,newSnapshot:row.question,marker:JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1'))};
 });
 assert.ok(migrated.legacy.word.search);assert.equal(migrated.newSnapshot.word.search,undefined);assert.equal(migrated.newSnapshot.word.examples,undefined);assert.equal(migrated.newSnapshot.word.pronunciation,'haʊs');assert.equal(migrated.newSnapshot.example.text,'The house is small.');assert.equal(migrated.marker.version,2);
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 const recovered=await page.evaluate(async()=>{
  const [{createLexiconStore},{createLexiconStorage},{studyProfiles}]=await Promise.all([import('/js/shared/lexicon-store.js'),import('/js/shared/lexicon-storage.js'),import('/js/presentation/study-profiles.js')]);
  const backend=createLexiconStorage(indexedDB,'lingonberry-progress-browser'),store=createLexiconStore(localStorage,studyProfiles.en,{progressStorage:backend});await store.ready();const before=Object.keys(store.state.wrongs).length;
  const failing={...backend,apply:async()=>{throw new Error('Simulated interrupted commit');}},pending=createLexiconStore(localStorage,studyProfiles.en,{progressStorage:failing});await pending.ready();pending.setWordStatus('recovery','learning');pending.record({mode:'vocabinput',id:'recover',locale:'ko',word:{id:'recover'}},'pending-answer',false);await pending.flush();
  const resumed=createLexiconStore(localStorage,studyProfiles.en,{progressStorage:backend});await resumed.ready();
  const ja=createLexiconStore(localStorage,studyProfiles.ja,{progressStorage:backend});await ja.ready();ja.record({mode:'vocabinput',id:'ja',locale:'ko',word:{id:'ja'}},'ja-wrong',false);await ja.flush();
  const recovery={before,after:Object.keys(resumed.state.wrongs).length,status:resumed.wordStatus('recovery'),theme:resumed.state.preferences.theme};resumed.reset();await resumed.flush();const reloaded=createLexiconStore(localStorage,studyProfiles.en,{progressStorage:backend});await reloaded.ready();return {...recovery,afterReset:reloaded.state,ja:await backend.load('ja')};
 });
 assert.equal(recovered.before,2);assert.equal(recovered.after,3);assert.equal(recovered.status,'learning');assert.equal(recovered.theme,'dark');assert.deepEqual(recovered.afterReset.wrongs,{});assert.deepEqual(recovered.afterReset.wordStatus,{});assert.equal(recovered.afterReset.preferences.theme,'dark');assert.equal(Object.keys(recovered.ja.wrongs).length,1);
 await page.context().close();
 // Exercise the real shell's asynchronous hydration, including immediate reload after removal.
 const context=await browser.newContext(),app=await context.newPage();app.on('pageerror',error=>errors.push(error.message));
 const core=fixture({id:'en-core',targetLanguage:'en',entries:[{id:'house',word:'house',partOfSpeech:'noun',level:'IELTS 1.0–3.5',example:{text:'The house is small.'}}]}),pair=explanationFixture(core.data,'ko'),files=[core,pair],catalog=files.map(row=>row.descriptor);
 await context.route('**/catalog.json',route=>route.fulfill({json:catalog}));await context.route('**/language-packages/*',route=>{if(route.request().url().endsWith('/catalog.json'))return route.fulfill({json:catalog});const file=files.find(row=>route.request().url().endsWith(row.descriptor.url));return file?route.fulfill({body:Buffer.from(file.bytes),contentType:'application/json'}):route.abort();});
 await app.goto(`http://127.0.0.1:${server.address().port}`);await app.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await app.evaluate(async packs=>{
  const [{createPackageStorage},{createLexiconStore},{studyProfiles}]=await Promise.all([import('/js/packages/storage.js'),import('/js/shared/lexicon-store.js'),import('/js/presentation/study-profiles.js')]);for(const pack of packs)await createPackageStorage().put(pack);
  const old=createLexiconStore(localStorage,studyProfiles.en);old.record({mode:'vocabinput',id:'legacy-shell',locale:'ko',word:{id:'house',lemma:'house',level:studyProfiles.en.levels[0],studyMeaning:'집',studyLanguage:'en',studyExplanationLanguage:'ko'},prompt:'집',answer:'house'},'wrong-old',false);
  localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'en',explanation:'ko'}));
 },files.map(row=>row.data));
 await app.reload();await app.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');await app.locator('[data-tab=wrong]').click();await app.locator('.wrong-entry').waitFor();assert.ok((await app.locator('.wrong-entry').innerText()).includes('wrong-old'));
 await app.locator('[data-remove]').click();await app.reload();await app.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');await app.locator('[data-tab=wrong]').click();await app.locator('.empty-wrong').waitFor();assert.equal(await app.locator('.wrong-entry').count(),0);
 await app.evaluate(async()=>{const {createLexiconStorage}=await import('/js/shared/lexicon-storage.js');await createLexiconStorage().apply('en',{statuses:{house:{revision:1,value:'mastered'}},wrongs:{}});const {createStore}=await import('/languages/de/js/core/store.js');createStore(localStorage).setWordStatus('de-protected','mastered');localStorage.setItem('test-progress-unavailable','1');});
 await context.addInitScript(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='learn-language.progress.v2'&&localStorage.getItem('test-progress-unavailable')==='1')throw new DOMException('Test progress unavailable','InvalidStateError');return open.call(this,name,...args);};});
 await app.reload();await app.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');assert.equal(await app.locator('#retry').isVisible(),true);assert.ok((await app.locator('#status').innerText()).includes('기록'));
 assert.equal(await app.locator('#set-reset').isDisabled(),true);
 const germanBefore=await app.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1'));
 await app.locator('#set-reset').evaluate(node=>{node.disabled=false;});app.once('dialog',dialog=>dialog.accept());await app.locator('#set-reset').click();await app.locator('.settings-toast').waitFor();assert.ok((await app.locator('.settings-toast').innerText()).includes('못'));
 assert.equal(await app.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1')),germanBefore,'A failed English hydration cannot erase German fallback data');
 await app.evaluate(()=>localStorage.removeItem('test-progress-unavailable'));await app.locator('#retry').click();await app.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready'&&document.querySelector('main').dataset.viewState==='ready');
 const retained=await app.evaluate(async()=>{const {createLexiconStorage}=await import('/js/shared/lexicon-storage.js');return createLexiconStorage().load('en');});assert.equal(retained.wordStatus.house,'mastered');assert.deepEqual(retained.wrongs,{});
 assert.equal(await app.locator('#set-reset').isEnabled(),true);app.once('dialog',dialog=>dialog.accept());await app.locator('#set-reset').click();await app.locator('.settings-toast').waitFor();
 const erased=await app.evaluate(async()=>{const {createLexiconStorage}=await import('/js/shared/lexicon-storage.js');return createLexiconStorage().load('en');});assert.deepEqual(erased.wordStatus,{});assert.deepEqual(erased.wrongs,{});assert.equal(await app.evaluate(()=>localStorage.getItem('learn-language.de.progress.v1')),germanBefore);
 assert.deepEqual(errors,[]);console.log('Passed actual IndexedDB legacy migration, compact snapshots, reload, interrupted-write recovery, reset, language isolation, real-shell hydration/removal and failed-open retry without data loss.');await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
