import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,tab){await page.locator(`[data-tab=${tab}]`).click();await ready(page);}
async function route(page,name,language){await tab(page,'home');await page.locator(language==='zh'?`[data-quiz=${name}]`:`[data-route=${name}]`).click();}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];await page.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>['de-DE','zh-CN','ja-JP','ko-KR','en-GB','es-ES','fr-FR'].map(lang=>({lang,localService:true})),cancel(){},speak(utterance){window.testSpokenText=utterance.text;setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);
 const catalog=await read('web/catalog.json');let checks=0;
 for(const language of ['ja','en','ko','es','fr','de','zh']){
  const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1)),seed=core.entries.find(row=>row.collocations?.length),locale='en';assert.ok(seed);
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-${locale}"] .download-package`).click();await page.locator(`[data-package="${language}-${locale}"] .remove-package`).waitFor();
  await tab(page,'settings');await page.selectOption('#target',language);await page.selectOption('#explanation',locale);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab(page,'home');
  if(language==='de')await page.locator(`[data-level="${seed.level}"]`).click();else if(language==='zh'){const selected=page.locator(`.hsk-chip[data-lv="${seed.level}"]`);if(await selected.count())await selected.click();}else await page.locator(`[data-level="${seed.level}"]`).click();
  await route(page,'wordlist',language);await page.locator('#search-input').fill(seed.word);const row=page.locator(language==='de'||language==='zh'?`[data-id="${seed.id}"]`:`[data-word="${seed.id}"]`);
  await row.waitFor();assert.ok(await row.locator('.collocation-preview').count());await page.locator('#search-input').fill(seed.collocations[0].phrase);await row.waitFor();await row.locator('.wl-main').click();await page.locator('.study-collocations').waitFor();assert.ok((await page.locator('.study-collocations').innerText()).includes(seed.collocations[0].phrase));await page.locator('[data-collocation-audio]').first().click();await page.waitForFunction(text=>window.testSpokenText===text,seed.collocations[0].phrase);await page.locator('[data-collocation-example]').first().click();await page.waitForFunction(text=>window.testSpokenText===text,seed.collocations[0].example);await page.keyboard.press('Escape');
  // Chinese detail overlays handle Escape through their existing sheet policy; close explicitly if needed.
  if(await page.locator('.detail-overlay').count())await page.locator('.detail-overlay .close-btn,.detail-overlay [data-close],.detail-overlay .detail-sheet-close').first().click();
  for(const mode of ['vocabinput','vocabmeaning']){
   await route(page,mode,language);const picker=page.locator(language==='de'||language==='zh'?'[data-collocation-kind]':'[data-exercise]');await picker.selectOption('collocations');await page.locator('.vocab-question').waitFor();
   if(mode==='vocabinput'){
    const prompt=await page.locator('.vocab-prompt').innerText();const expected=core.entries.flatMap(row=>(row.collocations||[]).map(item=>({word:row.word,...item}))).find(item=>prompt.includes('('+item.word+')'));const exerciseId=await page.locator('[data-exercise-id]').getAttribute('data-exercise-id').catch(()=>null),legacy=core.exercises?.find(row=>row.id===exerciseId);assert.ok(expected||legacy,language+': no matching typing anchor');await page.locator('#vocab-answer').fill('wrong collocation');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();await tab(page,'wrong');await page.locator(language==='de'||language==='zh'?'#retest-filtered':'[data-retest]').click();await page.locator('#vocab-answer').fill(expected?.phrase||legacy.answer);await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
   }else{
    const button=page.locator(language==='de'||language==='zh'?'[data-vocab-option]':'[data-option]').first();await button.click();if(await page.locator('[data-submit]').count())await page.locator('[data-submit]').click();await page.locator('#vocab-next').waitFor();
   }
   checks++;
  }
  console.log('Verified collocations',language);
 }
 assert.deepEqual(errors,[]);await page.context().setOffline(true);await page.reload();await ready(page);console.log(`Passed ${checks} collocation practice paths, all seven word lists/detail sections/audio controls and offline reload.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
