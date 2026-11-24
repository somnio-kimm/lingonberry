import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function openSettings(page){await page.locator('[data-tab=settings]').click();await ready(page);}
async function selectLanguage(page,target,explanation){await openSettings(page);await page.selectOption('#target',target);await page.waitForFunction(explanation=>!!document.querySelector(`#explanation option[value="${explanation}"]`),explanation);await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready'&&document.querySelector('main').dataset.viewState==='ready');}
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(()=>{
  window.soundEvents=[];
  class AudioContext{
   constructor(){this.state='suspended';this.currentTime=1;this.destination={};window.soundEvents.push({kind:'context'});}
   resume(){this.state='running';window.soundEvents.push({kind:'resume'});return Promise.resolve();}
   close(){this.state='closed';window.soundEvents.push({kind:'close'});return Promise.resolve();}
   createOscillator(){let frequency;const oscillator={frequency:{setValueAtTime:value=>{frequency=value;}},connect(){},disconnect(){},start:()=>window.soundEvents.push({kind:'start',frequency}),stop(at){if(at!==undefined)setTimeout(()=>oscillator.onended?.(),0);},onended:null};return oscillator;}
   createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}};}
  }
  Object.defineProperty(window,'AudioContext',{value:AudioContext,configurable:true});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await openSettings(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'false');
 await page.evaluate(async()=>{const {showQuizBurst}=await import('/js/shared/ui.js');showQuizBurst(true);});assert.equal(await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').length),0);
 await page.evaluate(async()=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),storage=createPackageStorage(),catalog=await fetch('/catalog.json').then(r=>r.json()),loaded=new Map();
  const read=async descriptor=>{if(!loaded.has(descriptor.url))loaded.set(descriptor.url,await fetch(descriptor.url).then(r=>r.json()));return loaded.get(descriptor.url);};
  for(const target of ['de','zh','en','ja'])for(const locale of ['en','ko']){const pair=await read(catalog.find(row=>row.id===target+'-'+locale)),core=await read(catalog.find(row=>row.id===target+'-core'&&row.version===pair.studyVersion));await storage.put(core);await storage.put(pair);}
  localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'de',explanation:'en',theme:'system',uiLanguage:'en',hapticEnabled:false,soundEnabled:false,autoRemoveResolvedWrongs:false}));
  localStorage.setItem('learn-language.de.progress.v1',JSON.stringify({version:1,units:{},concepts:{},wordStatus:{'sound-progress-sentinel':'mastered'},preferences:{studyLevel:'A2',theme:'system',soundEnabled:false,hapticEnabled:false}}));
 });await page.reload();await ready(page);await openSettings(page);
 assert.equal(await page.locator('#set-answer-sounds-label').innerText(),'Answer Sounds');assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'false');
 await page.locator('#set-answer-sounds').click();await ready(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'true');
 await page.evaluate(async()=>{const {showQuizBurst}=await import('/js/shared/ui.js');showQuizBurst(true);});await page.waitForFunction(()=>window.soundEvents.filter(row=>row.kind==='start').length===2);const positive=await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').map(row=>row.frequency));assert.ok(positive[1]>positive[0]);
 await page.evaluate(async()=>{const {showQuizBurst}=await import('/js/shared/ui.js');showQuizBurst(false);});await page.waitForFunction(()=>window.soundEvents.filter(row=>row.kind==='start').length===4);const negative=await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').slice(-2).map(row=>row.frequency));assert.ok(negative[1]<negative[0]);
 let cases=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const target of ['de','zh','en','ja'])for(const locale of ['en','ko']){
  await page.setViewportSize({width,height:900});await selectLanguage(page,target,locale);await page.locator(`[data-theme-choice=${theme}]`).click();await ready(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'true');assert.equal(await page.locator('#set-answer-sounds-label').innerText(),locale==='ko'?'정답·오답 소리':'Answer Sounds');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.preferences.v1')).soundEnabled),true);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));cases++;
 }
 // A real answer in each language invokes the common feedback hook exactly once.
 for(const target of ['de','zh','en','ja']){
  await selectLanguage(page,target,'en');await page.locator('[data-tab=home]').click();await ready(page);await page.locator(target==='zh'?'[data-quiz=vocabmeaning]':'[data-route=vocabmeaning]').click();const options=page.locator(target==='en'||target==='ja'?'[data-option]':'[data-vocab-option]');await options.first().waitFor();
  const count=await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').length);await options.first().click();await page.locator('#vocab-next').waitFor();await page.waitForFunction(count=>window.soundEvents.filter(row=>row.kind==='start').length===count+2,count);await page.locator('[data-close-vocab-result]').click();
 }
 await openSettings(page);await page.locator('#set-answer-sounds').click();await ready(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'false');const count=await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').length);await page.evaluate(async()=>{const {showQuizBurst}=await import('/js/shared/ui.js');showQuizBurst(true);showQuizBurst(false);});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').length),count);
 await selectLanguage(page,'zh','ko');assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'false');await page.reload();await ready(page);await openSettings(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'false');
 await page.locator('#set-answer-sounds').click();await ready(page);await page.reload();await ready(page);assert.equal(await page.evaluate(()=>window.soundEvents.filter(row=>row.kind==='start').length),0,'Saved sound preference must not autoplay on launch');await openSettings(page);assert.equal(await page.locator('#set-answer-sounds').getAttribute('aria-checked'),'true');
 const preserved=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.de.progress.v1')));assert.equal(preserved.wordStatus['sound-progress-sentinel'],'mastered');assert.equal(preserved.preferences.studyLevel,'A2');assert.deepEqual(errors,[]);
 console.log(`Passed ${cases} shared sound settings cases and actual quiz feedback in all four languages: default off, EN/KO labels, global persistence, reload, mute/unmute, no autoplay and retained learner progress.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
