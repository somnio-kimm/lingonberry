import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,name){await page.locator(`[data-tab=${name}]`).click();await ready(page);}
async function route(page,name){await tab(page,'home');await page.locator(`[data-route=${name}]`).click();await ready(page);}
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);const catalog=await read('web/catalog.json');let checked=0;
 for(const language of ['ja','en']){
  const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1));if(!core.exercises?.length)continue;
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();for(const locale of ['en','ko']){await page.locator(`[data-available="${language}-${locale}"] .download-package`).click();await page.locator(`[data-package="${language}-${locale}"] .remove-package`).waitFor();}
  for(const locale of ['en','ko']){
   await tab(page,'settings');await page.selectOption('#target',language);await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
   const pair=await read(catalog.find(row=>row.id===language+'-'+locale).url.slice(1));
   for(const category of [...new Set(core.exercises.map(row=>row.category))]){
    const seed=core.exercises.find(row=>row.category===category),entry=core.entries.find(row=>row.id===seed.entryId);await route(page,seed.route);if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();await page.selectOption('[data-level-filter]',entry.level);await page.selectOption('[data-exercise]',category);
    const prompt=await page.locator('.lexicon-prompt').innerText(),row=core.exercises.find(row=>row.category===category&&row.prompt===prompt),translated=pair.exercises.find(item=>item.id===row.id);assert.ok(row);assert.match(await page.locator('.lexicon-question').innerText(),new RegExp(translated.instruction.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(await page.locator('.reading-segments').count(),0);
    if(row.options)await page.locator(`[data-option="${row.options.indexOf(row.answer)}"]`).click();else await page.locator('#vocab-answer').fill(row.answer);
    await page.locator('[data-submit]').click();await page.locator('.lexicon-question.correct').waitFor();assert.ok((await page.locator('.exercise-explanation').innerText()).includes(translated.explanation));checked++;
   }
  }
 }
 await context.setOffline(true);await page.reload();await ready(page);await route(page,'vocabinput');if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();assert.ok(await page.locator('[data-exercise] option').count()>2);assert.deepEqual(errors,[]);console.log(`Passed ${checked} package-backed category/locale paths, answer grading, concealed segments and offline exercise data.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
