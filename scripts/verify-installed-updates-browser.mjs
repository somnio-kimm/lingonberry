import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8'),swift=await read('mobile/ios/App/App/AppViewController.swift');
const script=swift.split('// BEGIN INSTALLED_PACKAGE_UPDATE_CHECK')[1].split('// END INSTALLED_PACKAGE_UPDATE_CHECK')[0];
const descriptors=[];for(const id of ['ja-core','ja-en','ja-ko']){const url=`/language-packages/${id}-4.4.0.json`,text=await read(url.slice(1)),data=JSON.parse(text);descriptors.push({id,kind:data.kind,targetLanguage:'ja',version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});}
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/language-packages/'))requests.push(request.url());});
 const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();
 await page.evaluate(async descriptors=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),{createPackageManager}=await import('/js/packages/manager.js');const manager=createPackageManager({storage:createPackageStorage(),baseUrl:location.href});for(const pair of descriptors.slice(1))await manager.installPair(descriptors[0],pair);
  localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:'ja',explanation:'ko',theme:'system',uiLanguage:'ko'}));
 },descriptors);await page.reload();await ready();
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key!=='learn-language.preferences.v1')));requests.length=0;
 const run=()=>page.evaluate(async script=>{
  const wait=async predicate=>{const deadline=Date.now()+45000;while(!predicate()){if(Date.now()>deadline)throw new Error('Timed out in installed update browser check');await new Promise(resolve=>setTimeout(resolve,50));}};
  const select=(id,value)=>{const node=document.getElementById(id);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;return JSON.parse(await new AsyncFunction('wait','select','updateInstalled',script)(wait,select,true));
 },script);
 const first=await run();assert.equal(first.passed,true);assert.equal(first.restored,'ja');assert.deepEqual(first.checks.map(row=>row.id).sort(),['ja-en','ja-ko']);assert.ok(first.checks.every(row=>row.to==='4.5.0'&&row.studyVersion==='4.4.0'&&row.updated&&row.words===12027&&row.examples===12027&&row.translations===12027));assert.equal(requests.filter(url=>url.includes('/ja-core-')).length,0);
 requests.length=0;const again=await run();assert.ok(again.checks.every(row=>!row.updated));assert.deepEqual(requests,[],'Current pairs are not downloaded again and uninstalled languages are not installed');
 const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key!=='learn-language.preferences.v1')));assert.deepEqual(after,before,'Progress is unchanged');const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.preferences.v1')));assert.equal(preferences.target,'ja');assert.equal(preferences.explanation,'ko');assert.equal(preferences.uiLanguage,'ko');assert.equal(preferences.theme,'system');assert.deepEqual(errors,[]);
 console.log('Passed real native DEBUG update-script browser checks: installed pairs only, independent explanation/core versions, complete Japanese examples/short meanings, restored selection, intact progress and no repeated downloads.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
