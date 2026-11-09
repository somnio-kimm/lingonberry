import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const folder=new URL('../local-data/coverage/four-language-review/',import.meta.url);
const lines=raw=>raw.split('\n').filter(line=>line.trim()).map(JSON.parse);
const inputs=lines(await readFile(new URL('zh-input.jsonl',folder),'utf8'));
const decisions=lines(await readFile(new URL('zh-decisions.jsonl',folder),'utf8'));
const original=inputs[0].coreEntry;
const proposed=decisions.map(row=>row.proposedCoreEntry).filter(Boolean);
const hanOnly=text=>/^[\p{Script=Han}\p{P}]+$/u.test(text);
const ordinary=proposed.find(row=>hanOnly(row.example?.text||'')&&row.example?.pronunciation&&!/\p{P}/u.test(row.example.pronunciation));
const erhua=proposed.find(row=>hanOnly(row.example?.text||'')&&row.example.text.includes('点儿')&&/\bdianr[1-5]\b/u.test(row.example.pronunciation||''));
assert.ok(ordinary,'A reviewed punctuation-free example is required');
assert.ok(erhua,'A reviewed joined-erhua example is required');
const samples=[{id:original.id,...original.example},{id:ordinary.id,...ordinary.example},
 {id:erhua.id,...erhua.example,blank:'点儿'}];
const server=await startServer();let browser;let checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await mkdir('/private/tmp/chinese-reading-review-ui',{recursive:true});
 for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});
  const result=await page.evaluate(async({samples,theme})=>{
   const {Pinyin}=await import('/languages/zh/js/services/pinyin.js');
   document.getElementById('style-zh').disabled=false;document.documentElement.dataset.theme=theme;
   document.getElementById('reading-review-qa')?.remove();
   const host=document.createElement('section');host.id='reading-review-qa';host.className='panel';
   document.querySelector('main').replaceChildren(host);
   return samples.map(sample=>{
    const sentence={hanzi:sample.text,pinyin:sample.pronunciation};
    const columns=Pinyin.sentenceColumns(sentence);
    if(!columns)throw new Error('Reviewed sentence failed alignment: '+sample.id);
    const node=document.createElement('div');node.dataset.sample=sample.id;
    node.innerHTML=Pinyin.htmlSentence(sentence,{blank:sample.blank||''});host.append(node);
    return {id:sample.id,hanzi:columns.map(column=>column.hanzi).join(''),text:sample.text,
     fallback:!!node.querySelector('.example-pinyin'),readings:[...node.querySelectorAll('rt')].map(rt=>rt.textContent),
     blank:node.querySelector('.cloze-blank')?.textContent};
   });
  },{samples,theme});
  for(const row of result){
   assert.equal(row.hanzi,row.text);assert.equal(row.fallback,false);
   assert.ok(row.readings.every(text=>!/[。，？！「」]/u.test(text)));
   if(row.id===erhua.id){assert.equal(row.blank,'______');assert.ok(row.readings.some(text=>text.includes('diǎnr')));}
   checks++;
  }
  await page.locator('#reading-review-qa').screenshot({path:`/private/tmp/chinese-reading-review-ui/${width}-${theme}.png`});
 }
 console.log(JSON.stringify({passed:true,checks,samples:samples.map(row=>row.id),screenshots:'/private/tmp/chinese-reading-review-ui'}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
