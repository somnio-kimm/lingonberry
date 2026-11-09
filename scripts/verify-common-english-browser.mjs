import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,value){await page.locator(`[data-tab=${value}]`).click();await ready(page);}
async function openWordListAt(page,level){await tab(page,'home');await page.locator(`[data-level="${level}"]`).click();await page.locator('[data-route=wordlist]').click();await ready(page);}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);
 const catalog=await read('web/catalog.json'),core=await read(catalog.find(row=>row.id==='en-core').url.slice(1));assert.ok(core.contentReview.commonCoverage);
 await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator('[data-language=en]').click();
 for(const locale of ['en','ko']){await page.locator(`[data-available=en-${locale}] .download-package`).click();await page.locator(`[data-package=en-${locale}] .remove-package`).waitFor();}
 let checks=0;
 for(const locale of ['en','ko']){
  const pair=await read(catalog.find(row=>row.id==='en-'+locale).url.slice(1)),meanings=new Map(pair.entries.map(row=>[row.id,row.meaning]));await tab(page,'settings');await page.selectOption('#target','en');await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  for(const spelling of ['address','the','and','email','Monday','March','May','trousers','parent','these','must','neighbour','an','species','criteria','analyse','quintillion','login','username','headphone','earphones','postcode','worksheet','sunscreen','raincoat','bookshop','petrol','takeaway','takeout','abnormal','anagram','megaphone','panthea','pantheon','aberrant','aversion']){
   const entry=core.entries.find(row=>row.word===spelling||row.aliases?.includes(spelling));assert.ok(entry,spelling);
   await openWordListAt(page,entry.level);await page.locator('#search-input').fill(spelling);
   if(spelling==='address'){
    const otherLevels=core.entries.filter(row=>row.word==='address'&&row.level!==entry.level);
    for(const other of otherLevels)assert.equal(await page.locator(`[data-word="${other.id}"]`).count(),0);
   }
   const row=page.locator(`[data-word="${entry.id}"]`);await row.waitFor();assert.ok((await row.innerText()).includes(meanings.get(entry.id)),locale+': '+spelling);await row.locator('.wl-meaning').click();await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-sheet-meaning').innerText(),meanings.get(entry.id));await page.keyboard.press('Escape');checks++;
  }
  if(locale==='en'&&core.contentReview.vocabularyExpansion){
   for(const spelling of ['photography','administrative','insightful','sustainable']){
    const entry=core.entries.find(row=>row.word===spelling);
    assert.ok(entry?.id.startsWith('en-expanded-'),spelling);
    await openWordListAt(page,entry.level);await page.locator('#search-input').fill(spelling);
    const row=page.locator(`[data-word="${entry.id}"]`);
    await row.waitFor();
    assert.equal(await row.locator('.wl-meaning').innerText(),meanings.get(entry.id));
    checks++;
   }
  }
  if(locale==='en'&&core.contentReview.phraseExpansion){
   for(const phrase of ['break the ice','look up','make a decision',...(core.contentReview.phraseExpansion.collocationSourcePath?['make the bed','make a booking','raise a concern','command a premium']:[]),...(core.contentReview.phraseExpansion.legacyDictionarySourcePath?['heavy rain','conduct research','take a photo']:[])]){
    const id='en-phrase-'+phrase.replaceAll(' ','-');
    await openWordListAt(page,core.entries.find(entry=>entry.id===id).level);await page.locator('#search-input').fill(phrase);
    const row=page.locator(`[data-word="${id}"]`);
    await row.waitFor();
    await row.locator('.wl-main').click();
    await page.getByRole('dialog').waitFor();
    assert.ok(await page.locator('.example-sentence').innerText().then(text=>text.includes(phrase)));
    await page.keyboard.press('Escape');
    checks++;
   }
  }
  await tab(page,'home');await page.locator('[data-route=roots]').click();await page.locator('[data-root-view=browse]').click();await page.locator('#root-search').fill('address');
  await page.locator('#root-search').fill('megaphone');await page.locator('[data-root-entry=en-coverage-megaphone]').first().waitFor();await page.locator('#root-search').fill('address');
  for(const entry of core.entries.filter(row=>row.word==='address')){await page.locator(`[data-root-entry="${entry.id}"]`).first().waitFor();}
  await tab(page,'settings');await page.locator('#set-license').click();await page.locator('.lic-sheet').waitFor();assert.ok((await page.locator('.lic-scroll').innerText()).includes('Browne, C., Culligan, B., and Phillips, J.'));assert.ok(await page.locator('.lic-scroll a[href="https://charliebrownecompany.squarespace.com/new-general-service-list"]').count());await page.locator('.lic-x').click();
 }
 await page.context().setOffline(true);await page.reload();await ready(page);await tab(page,'home');await page.locator('[data-level="IELTS 1.0–3.5"]').click();await page.locator('[data-route=wordlist]').click();await page.locator('#search-input').fill('email');await page.locator('[data-word="'+core.entries.find(row=>row.word==='email').id+'"]').waitFor();assert.deepEqual(errors,[]);
 console.log(`Passed ${checks} fresh-package Word List/detail paths in English/Korean: basic grammar, days/months, British variants, beginner address/parent, intermediate words, root sense links and offline reload.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
