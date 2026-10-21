import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await mkdir('/private/tmp/practice-design-shots',{recursive:true});let checks=0;
 for(const language of ['ja','en']){
  await page.evaluate(async language=>{
   const [{createPresentation},{assembleStudy}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js')]);
   const catalog=await fetch('/catalog.json').then(r=>r.json()),core=await fetch(catalog.find(r=>r.id===language+'-core').url).then(r=>r.json()),pair=await fetch(catalog.find(r=>r.id===language+'-ko').url).then(r=>r.json());
   localStorage.removeItem(`learn-language.${language}.lexicon.v1`);const host=document.createElement('main');host.id='app';document.body.replaceChildren(host);let route='vocabinput',app;
   const refresh=()=>app.render(route,host);app=createPresentation({language,navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app.setStudy(assembleStudy(core,pair));window.designRoute=value=>{route='home';refresh();host.querySelector(`[data-route=${value}]`).click();};window.designApp=app;refresh();
  },language);
  for(const width of [390,1024])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
   await page.evaluate(()=>window.designRoute('vocabinput'));await page.selectOption('[data-exercise]','vocabulary');
   const baseline=await page.locator('.lexicon-question').evaluate(node=>{const s=getComputedStyle(node),i=getComputedStyle(node.querySelector('input'));return {padding:s.padding,borderRadius:s.borderRadius,font:i.fontSize,align:i.textAlign};});
   await page.selectOption('[data-exercise]',language==='ja'?'okurigana':'collocations');
   const custom=await page.locator('.lexicon-question').evaluate(node=>{const s=getComputedStyle(node),i=getComputedStyle(node.querySelector('input'));return {padding:s.padding,borderRadius:s.borderRadius,font:i.fontSize,align:i.textAlign};});assert.deepEqual(custom,baseline);
   assert.equal(await page.locator('.exercise-picker.panel').count(),0);assert.equal(await page.locator('.vocab-question .vocab-prompt').count(),1);
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
   await page.screenshot({path:`/private/tmp/practice-design-shots/${language}-${width}-${theme}.png`,fullPage:true});checks++;
  }
  if(language==='en'){
   await page.evaluate(()=>window.designRoute('roots'));const row=page.locator('.root-member.wl-row').first();
   assert.ok(await row.evaluate(node=>parseFloat(getComputedStyle(node.querySelector('.wl-headword')).fontSize)>parseFloat(getComputedStyle(node.querySelector('.wl-meaning')).fontSize)));
   await row.locator('.wl-meaning').click();await page.locator('[role=dialog]').waitFor();await page.keyboard.press('Escape');checks++;
  }
  if(language==='ja'){
   await page.evaluate(()=>window.designRoute('vocabmeaning'));for(const category of ['reading','onyomi','kunyomi','okurigana']){await page.selectOption('[data-exercise]',category);assert.ok(await page.locator('[data-option]').count()>=3);checks++;}
   await page.evaluate(()=>window.designRoute('forms'));assert.equal(await page.locator('.form-original-word .grammar-word').count(),1);assert.equal(await page.locator('.form-problem .vocab-prompt,.form-problem .grammar-prompt').count(),1);checks++;
  }
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} real-package design/feature checks at phone/tablet widths in both themes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
