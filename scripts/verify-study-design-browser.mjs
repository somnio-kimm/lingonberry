import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const properties=['fontSize','fontWeight','color','backgroundColor','padding','borderRadius','borderWidth'];
const measure=(page,selector,keys=properties)=>page.locator(selector).first().evaluate((node,keys)=>{const style=getComputedStyle(node);return Object.fromEntries(keys.map(key=>[key,style[key]]));},keys);
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir('/private/tmp/study-design-contract',{recursive:true});let checks=0;const selectorMeasurements=new Map();
 for(const language of ['de','zh'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async({language,theme})=>{
   document.querySelector('#style-de').disabled=language!=='de';document.querySelector('#style-zh').disabled=language!=='zh';document.documentElement.dataset.theme=theme;
   const [{renderMorphemeInventory},{renderStudyTabs}]=await Promise.all([import('/js/shared/morpheme-view.js'),import('/js/shared/study-components.js')]);
   const host=document.querySelector('main');host.innerHTML='<div id="baseline"><section class="panel"><h2 class="section-title">Reference</h2></section><div class="card study-search"><input class="input-field" type="search" placeholder="Search"></div><div class="wl-list wl-list--wordlist"><div class="word-row-window"><div class="wl-row"><div class="wl-main"><span class="wl-headword">audience</span><div class="wl-meaning">listeners</div></div></div></div></div></div><div id="feature"></div>';
   const words=[{id:'audience',lemma:'audience',studyMeaning:'listeners'}],rows=[{id:'aud',form:'aud-',variants:[],kind:'root',origin:'Latin',examples:['audience','audition'],senses:[{id:'aud-0',meaning:'hear',tags:[]}],source:'https://en.wiktionary.org/wiki/aud-'}];
   renderMorphemeInventory(document.querySelector('#feature'),{rows,words,state:{},t:x=>x,locale:'en',tabs:renderStudyTabs({label:'Answer Mode',options:[{value:'choice',label:'Selection'},{value:'input',label:'Typing'}],selected:'choice',attribute:'data-answer-mode'}),bindTabs(){},openWord(){},tags:()=>''});
  },{language,theme});
  assert.deepEqual(await measure(page,'[data-morpheme]', ['padding','borderRadius','borderWidth','backgroundColor']),await measure(page,'#baseline .panel',['padding','borderRadius','borderWidth','backgroundColor']));
  assert.deepEqual(await measure(page,'.study-reference-heading',['fontSize','fontWeight','color']),await measure(page,'#baseline .wl-headword',['fontSize','fontWeight','color']));
  assert.deepEqual(await measure(page,'.study-reference-origin',['fontSize','color']),await measure(page,'#baseline .wl-meaning',['fontSize','color']));
  assert.deepEqual(await measure(page,'#feature .wl-row'),await measure(page,'#baseline .wl-row'));
  assert.deepEqual(await measure(page,'#feature .study-search .input-field'),await measure(page,'#baseline .study-search .input-field'));
  assert.equal((await measure(page,'.study-reference-heading')).fontSize,'24px');assert.equal((await measure(page,'[data-morpheme]')).padding,'16px');
  assert.equal((await measure(page,'[data-related-list]',['gap'])).gap,'2px');assert.equal((await measure(page,'[data-root-list]>.word-row-window',['gap'])).gap,'16px');
  const buttons=await page.locator('[data-answer-mode]').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize})));assert.ok(Math.abs(buttons[0].width-buttons[1].width)<=.5);assert.ok(buttons.every(b=>b.height>=44&&b.font==='14px'),JSON.stringify({language,width,theme,buttons}));
  const select=await measure(page,'.grammar-selectors select'),key=width+'-'+theme;if(language==='de'){selectorMeasurements.set(key,select);selectorMeasurements.set(key+'-search',await measure(page,'#feature .study-search .input-field'));}else{assert.deepEqual(select,selectorMeasurements.get(key),'Chinese selectors follow German geometry');assert.deepEqual(await measure(page,'#feature .study-search .input-field'),selectorMeasurements.get(key+'-search'),'Search fields match between languages');}assert.equal((await measure(page,'[data-morpheme]',['marginBottom'])).marginBottom,'0px');
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await page.locator('main').screenshot({path:`/private/tmp/study-design-contract/${language}-${width}-${theme}.png`,fullPage:true});checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} shared design contracts against German/Chinese styles: typography, cards, rows, nested gaps, search, equal controls, themes and responsive widths.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
