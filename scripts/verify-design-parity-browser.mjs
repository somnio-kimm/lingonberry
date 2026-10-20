import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,id){await page.locator(`[data-tab=${id}]`).click();await ready(page);}
async function route(page,id){await tab(page,'home');await page.locator(`[data-route=${id}]`).click();await ready(page);}
const measure=(page,selector)=>page.locator(selector).first().evaluate(node=>{const s=getComputedStyle(node),b=node.getBoundingClientRect();return {width:b.width,font:s.fontSize,padding:s.padding,radius:s.borderRadius};});
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/lingonberry-design',{recursive:true});
 const measurements={};
 for(const language of ['de','ja','en']){
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-en"] .download-package`).click();await page.locator(`[data-package="${language}-en"] .remove-package`).waitFor();await tab(page,'settings');await page.selectOption('#target',language);await page.selectOption('#explanation','en');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  measurements[language]={};
  await tab(page,'home');measurements[language].home=await measure(page,'.menu-card');await page.screenshot({path:`/private/tmp/lingonberry-design/${language}-home.png`});
  await route(page,'wordlist');measurements[language].filter=await measure(page,'.filter-fold-sum');measurements[language].row=await measure(page,'.wl-row');await page.locator('.wl-main').first().click();measurements[language].sheet=await measure(page,'.detail-sheet');await page.screenshot({path:`/private/tmp/lingonberry-design/${language}-detail.png`});await page.keyboard.press('Escape');
  await route(page,'flashcards');measurements[language].card=await measure(page,'.flashcard');measurements[language].word=await measure(page,'.flashcard-word');await page.screenshot({path:`/private/tmp/lingonberry-design/${language}-flashcards.png`});
  await tab(page,'wrong');measurements[language].empty=await measure(page,'.empty-wrong');
 }
 for(const value of Object.values(measurements))delete value.word.width;
 for(const language of ['ja','en'])for(const part of ['home','filter','row','sheet','card','word','empty'])assert.deepEqual(measurements[language][part],measurements.de[part],`${language} ${part} matches German geometry`);
 assert.deepEqual(errors,[]);console.log('Passed German/Japanese/English shared card, filter, row, sheet, flashcard, typography and empty Review geometry.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
