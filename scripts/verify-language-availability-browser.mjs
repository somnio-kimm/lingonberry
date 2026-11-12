import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {fixture,explanationFixture} from '../tests/package-fixture.js';
import {startServer} from './dev-server.mjs';

const targets=['de','en','es','fr','ja','ko','zh'],visible=['de','en','ja','zh'],screenshots=join(tmpdir(),'lingonberry-language-availability');
const files=targets.flatMap(language=>{
 const core=fixture({id:language+'-core',targetLanguage:language,entries:[{id:language+'-word',word:'word',level:language==='ja'?'N5':language==='en'?'IELTS 1.0–3.5':'A1',partOfSpeech:'noun',example:{text:'An original fixture sentence.'}}]});
 return [core,...['en','ko'].filter(explanation=>language!==explanation||language==='en').map(explanation=>explanationFixture(core.data,explanation))];
});
const catalog=files.map(file=>file.descriptor),server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function settings(page){await page.locator('[data-tab=settings]').click();await ready(page);}
async function packages(page){await settings(page);await page.locator('#manage-packages').click();await ready(page);assert.deepEqual((await page.locator('[data-language]').evaluateAll(rows=>rows.map(row=>row.dataset.language))).sort(),visible);}
try{
 browser=await chromium.launch({headless:true});await mkdir(screenshots,{recursive:true});let checks=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const locale of ['en','ko']){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/catalog.json',route=>route.fulfill({json:catalog}));
  await context.route('**/language-packages/*',route=>{const file=files.find(file=>route.request().url().endsWith(file.descriptor.url));return file?route.fulfill({body:Buffer.from(file.bytes),contentType:'application/json'}):route.abort();});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await packages(page);
  await page.locator('[data-language=de]').click();await page.locator('[data-available=de-ko] .download-package').click();await page.locator('[data-package=de-ko]').waitFor();
  await page.locator('[data-available=de-en] .download-package').click();await page.locator('[data-package=de-en]').waitFor();
  const before=await page.evaluate(async({packs})=>{
   const {createPackageStorage}=await import('/js/packages/storage.js');const storage=createPackageStorage();for(const pack of packs)await storage.put(pack);
   for(const target of ['fr','es','ko'])localStorage.setItem(`learn-language.${target}.lexicon.v1`,JSON.stringify({preservedProgress:target}));
   return JSON.stringify((await storage.list()).sort((a,b)=>a.id.localeCompare(b.id)));
  },{packs:files.map(file=>file.data)});
  for(const hidden of ['fr','es','ko']){
   await page.evaluate(({hidden,theme})=>localStorage.setItem('learn-language.preferences.v1',JSON.stringify({target:hidden,explanation:'ko',theme})),{hidden,theme});
   await page.reload();await ready(page);
   assert.equal(await page.locator('#target').inputValue(),'');
   assert.deepEqual((await page.locator('#target option[value]').evaluateAll(rows=>rows.map(row=>row.value).filter(Boolean))).sort(),visible);
   await page.selectOption('#target','de');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
   assert.equal(await page.locator('#explanation option[value=ko]').count(),1);
   assert.equal(await page.locator('html').getAttribute('lang'),locale==='ko'?'ko':'en-GB');
   await packages(page);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
   const after=await page.evaluate(async()=>{const {createPackageStorage}=await import('/js/packages/storage.js');return JSON.stringify((await createPackageStorage().list()).sort((a,b)=>a.id.localeCompare(b.id)));});
   assert.equal(after,before,'Hiding previews preserves all installed package records');
   for(const target of ['fr','es','ko'])assert.equal(await page.evaluate(target=>JSON.parse(localStorage.getItem(`learn-language.${target}.lexicon.v1`)).preservedProgress,target),target);
   checks++;
  }
  await page.locator('main').screenshot({path:join(screenshots,`${width}-${theme}-${locale}.png`),fullPage:true});
  await page.context().setOffline(true);await page.reload();await ready(page);await packages(page);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(`Passed ${checks} saved-preview visibility cases, fresh downloads, Korean explanations, preserved packages/progress and offline reloads across phone/tablet, themes and English/Korean.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
