import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,value){await page.locator(`[data-tab=${value}]`).click();await ready(page);}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>['de-DE','zh-CN','ja-JP','ko-KR','en-GB','es-ES','fr-FR'].map(lang=>({lang,localService:true})),cancel(){},speak(utterance){setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/dictation-design',{recursive:true});const baseline=new Map();let checks=0;
 for(const language of ['de','zh','en','ja','ko','es','fr']){
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-en"] .download-package`).click();await page.locator(`[data-package="${language}-en"] .remove-package`).waitFor();
  for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:1000});await tab(page,'settings');await page.selectOption('#display-language',locale);await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target',language);await page.selectOption('#explanation','en');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await tab(page,'home');await page.locator(language==='zh'?'[data-quiz=listening]':'[data-route=listening]').click();await ready(page);
   const selector=page.locator('.listening-mode-controls'),buttons=selector.locator('button');await selector.waitFor();assert.deepEqual(await buttons.allTextContents(),locale==='ko'?['단어','문장']:['Word','Sentence']);assert.equal(await page.locator('.lexicon-switch').count(),0);
   const geometry=await selector.evaluate(node=>{const box=node.getBoundingClientRect(),main=document.querySelector('main').getBoundingClientRect(),header=document.querySelector('.vocab-quiz-header,.sentence-quiz-header').getBoundingClientRect(),filter=document.querySelector('.filter-fold').getBoundingClientRect(),style=getComputedStyle(node),buttons=[...node.querySelectorAll('button')].map(button=>{const b=button.getBoundingClientRect(),s=getComputedStyle(button);return {width:b.width,height:b.height,font:s.fontSize,weight:s.fontWeight,padding:s.padding,radius:s.borderRadius,colour:s.color,background:s.backgroundColor};});return {top:box.top-main.top,left:box.left-main.left,width:box.width,height:box.height,headerBottom:header.bottom-main.top,filterTop:filter.top-main.top,gap:style.gap,buttons};});
   assert.ok(geometry.top>=geometry.headerBottom&&geometry.filterTop>=geometry.top+geometry.height,JSON.stringify({language,geometry}));assert.ok(Math.abs(geometry.buttons[0].width-geometry.buttons[1].width)<=.5);assert.ok(geometry.buttons.every(button=>button.height>=44));
   const key=[locale,width,theme].join('-');if(language==='de')baseline.set(key,geometry);else assert.deepEqual(geometry,baseline.get(key),language+' Dictation follows German '+key);
   const sentence=buttons.nth(1);await sentence.click();assert.equal(await buttons.nth(1).getAttribute('aria-pressed'),'true');await page.locator('#listening-answer').fill('answer');assert.equal(await page.locator('#listening-submit').isEnabled(),false);await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);
   await buttons.nth(0).click();assert.equal(await buttons.nth(0).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#listening-answer').inputValue(),'');assert.equal(await page.locator('#listening-submit').isEnabled(),false);
   if(!await page.locator('.filter-fold').evaluate(node=>node.open))await page.locator('.filter-fold>summary').click();assert.ok(await page.locator('.filter-fold').evaluate(node=>node.open));const bounds=await selector.boundingBox(),filter=await page.locator('.filter-fold').boundingBox();assert.ok(bounds.y+bounds.height<=filter.y);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
   if(locale==='en')await page.screenshot({path:`/private/tmp/dictation-design/${language}-${width}-${theme}.png`,fullPage:true});checks++;
  }
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} seven-language Dictation contracts: German/Chinese geometry, title→mode→filters order, EN/KO labels, phone/tablet, light/dark, equal controls, mode switching and audio-before-submit.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
