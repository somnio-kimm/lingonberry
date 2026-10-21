import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
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
  const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1));
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();for(const locale of ['en','ko']){await page.locator(`[data-available="${language}-${locale}"] .download-package`).click();await page.locator(`[data-package="${language}-${locale}"] .remove-package`).waitFor();}
  for(const locale of ['en','ko']){
   await tab(page,'settings');await page.selectOption('#target',language);await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
   const pair=await read(catalog.find(row=>row.id===language+'-'+locale).url.slice(1)),study=assembleStudy(core,pair),prepared=prepareLanguageExercises(study,studyWords(study));
   await route(page,'vocabmeaning');assert.equal(await page.locator('[data-exercise],[data-answer-mode]').count(),0);assert.equal(await page.locator('[data-submit]').count(),0);assert.equal(await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'),'');await page.locator('[data-option]').first().click();await page.locator('[data-next]').waitFor();
   await route(page,'vocabinput');assert.equal(await page.locator('[data-exercise],[data-answer-mode]').count(),0);assert.equal(await page.locator('[data-submit]').count(),1);assert.equal(await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'),'');
   if(language==='en'){await tab(page,'home');assert.equal(await page.locator('[data-route=articles],[data-route=confusables]').count(),0);await page.locator('[data-route=roots]').click();await page.locator('[data-root-view=browse]').click();if(core.morphemes?.length)assert.ok((await page.locator('[data-root-count]').innerText()).includes(core.morphemes.length.toLocaleString()));else assert.equal(await page.locator('[data-root-scope=all]').getAttribute('aria-pressed'),'true');await page.locator('#root-search').fill('aud');assert.ok(await page.locator('[data-root-word]').count()>0);assert.ok((await page.locator('[data-root-list]').innerText()).includes('audience'));assert.ok((await page.locator('.root-origin').first().innerText()).length>0);assert.ok(!(await page.locator('[data-root-list]').innerText()).includes('*h'));await page.locator('#root-search').fill('');}
   for(const category of [...new Set(prepared.map(row=>row.category))].filter(category=>category!=='articles')){
    const seed=prepared.find(row=>row.category===category),entry=core.entries.find(row=>row.id===seed.entryId);await tab(page,'home');await page.locator(`[data-level="${entry.level}"]`).click();await page.locator(`[data-route=${category}]`).click();await ready(page);
    if(category==='roots')await page.locator('[data-root-view=quiz]').click();
    const mode=seed.options?'choice':'input';if(await page.locator(`[data-answer-mode=${mode}]`).count())await page.locator(`[data-answer-mode=${mode}]`).click();
    const id=await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'),row=prepared.find(row=>row.id===id);assert.ok(row);assert.equal(await page.locator('.reading-segments').count(),0);
    if(row.options){assert.equal(await page.locator('[data-submit]').count(),0);await page.locator(`[data-option="${row.options.indexOf(row.answer)}"]`).click();}else{if(row.gapFill){for(const [index,answer]of row.gapFill.answers.entries())await page.locator(`[data-phrase-gap="${index}"]`).fill(answer);}else await page.locator('#vocab-answer').fill(row.answer);await page.locator('[data-submit]').click();}
    await page.locator('.lexicon-question.correct').waitFor();assert.ok((await page.locator('.exercise-explanation').innerText()).includes(row.explanation));checked++;
   }
  }
 }
 await context.setOffline(true);await page.reload();await ready(page);await route(page,'collocations');await page.locator('[data-exercise-id]').waitFor();assert.deepEqual(errors,[]);console.log(`Passed ${checked} standalone feature/locale paths, isolated defaults, instant choices, grading and offline data.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
