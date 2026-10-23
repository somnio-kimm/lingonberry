import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,page;
const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(id){await page.locator(`[data-tab=${id}]`).click();await ready();}
async function route(id){await tab('home');await page.locator(`[data-route=${id}]`).click();await ready();}
async function metrics(selector){return page.locator(selector).first().evaluate(node=>{
 const rect=n=>{const b=n.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
 const canvas=document.createElement('canvas').getContext('2d');
 const ink=(text,node,box)=>{const style=getComputedStyle(node);canvas.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const m=canvas.measureText(text),baseline=box.bottom-m.fontBoundingBoxDescent;return {inkTop:baseline-m.actualBoundingBoxAscent,inkBottom:baseline+m.actualBoundingBoxDescent};};
 const glyphs=[],walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text;
 while(text=walker.nextNode()){
  if(text.parentElement.closest('rt,button'))continue;let at=0;
  for(const character of text.textContent){const end=at+character.length;if(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)){const range=document.createRange();range.setStart(text,at);range.setEnd(text,end);const box=rect(range);glyphs.push({character,...box,...ink(character,text.parentElement,box)});}at=end;}
 }
 const readings=[...node.querySelectorAll('rt')].map(rt=>{const base=rt.parentElement.firstChild,range=document.createRange();range.selectNodeContents(base);return {text:rt.textContent,display:getComputedStyle(rt).display,...rect(rt),...ink(rt.textContent,rt,rect(rt)),baseInkTop:ink(base.textContent,rt.parentElement,rect(range)).inkTop,rubyDisplay:getComputedStyle(rt.parentElement).display};});
 const copy=node.cloneNode(true);copy.querySelectorAll('rt,button').forEach(child=>child.remove());const style=getComputedStyle(node);
 return {text:copy.textContent.trim(),glyphs,readings,box:rect(node),font:parseFloat(style.fontSize),line:parseFloat(style.lineHeight)};
 });}
function check(result,{singleLine=false}={}){
 assert.ok(result.glyphs.length);assert.ok(result.readings.length);assert.ok(result.line>=result.font*2.2,'reserve a separate reading row');
 const rows=[];for(const glyph of result.glyphs){let row=rows.find(row=>Math.abs(row[0].top-glyph.top)<result.line/2);if(!row){row=[];rows.push(row);}row.push(glyph);}
 if(singleLine)assert.equal(rows.length,1,'short original sentence remains one line');
 for(const row of rows)assert.ok(Math.max(...row.map(glyph=>glyph.top))-Math.min(...row.map(glyph=>glyph.top))<1,'kanji and kana share the sentence baseline');
 for(const reading of result.readings){
  assert.ok(!reading.rubyDisplay.includes('flex'),'use the browser’s native ruby layout');assert.ok(reading.inkBottom<=reading.baseInkTop+.5,'furigana stays above its original text');assert.ok(reading.top>=result.box.top-1,'first reading is inside reserved sentence space');
  assert.ok(!result.glyphs.some(glyph=>Math.min(glyph.inkBottom,reading.inkBottom)-Math.max(glyph.inkTop,reading.inkTop)>.5),'reading glyphs do not overlap the original sentence or wrapped rows');
 }
}
try{
 await mkdir('/private/tmp/japanese-furigana-layout',{recursive:true});browser=await chromium.launch({headless:true});page=await browser.newPage();const errors=[],results=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();await tab('settings');await page.locator('#manage-packages').click();await page.locator('[data-language=ja]').click();
 for(const locale of ['en','ko']){await page.locator(`[data-available="ja-${locale}"] .download-package`).click();await page.locator(`[data-package="ja-${locale}"] .remove-package`).waitFor();}
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const explanation of ['en','ko']){
  await page.setViewportSize({width,height:900});await tab('settings');await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target','ja');await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  await route('wordlist');await page.locator('#search-input').fill('食べる');await page.locator('.wl-row').first().click();await page.locator('.study-example .example-sentence').waitFor();await page.evaluate(()=>document.fonts.ready);
  const detail=await metrics('.study-example .example-sentence');check(detail);assert.equal(await page.locator('.example-sentence .example-speak').count(),0,'audio button has a separate layout column');assert.equal(await page.locator('.example-with-audio>.example-speak').count(),1);await page.screenshot({path:`/private/tmp/japanese-furigana-layout/detail-${width}-${theme}-${explanation}.png`,fullPage:true});await page.locator('[data-status=learning]').click();
  await route('flashcards');if(!await page.locator('[data-filter-status=learning]').isVisible())await page.locator('.filter-fold summary').click();await page.locator('[data-filter-status=learning]').click();await page.locator('.filter-fold').evaluate(node=>{node.open=false;});if(!await page.locator('.flashcard').evaluate(node=>node.classList.contains('flipped')))await page.locator('.fc-card-main[data-flip]').click();await page.locator('.flashcard.flipped').waitFor();await page.waitForTimeout(450);const card=await metrics('.flashcard-back .example-sentence');check(card);await page.screenshot({path:`/private/tmp/japanese-furigana-layout/card-${width}-${theme}-${explanation}.png`,fullPage:true});
  await page.evaluate(async()=>{const {renderJapaneseRuby}=await import('/js/shared/japanese-furigana.js');const host=document.createElement('div');host.id='furigana-probe';host.className='lexicon-detail';host.style.cssText='position:absolute;left:-2000px;top:0;width:280px';host.innerHTML=`<p class="example-sentence" lang="ja">あ${renderJapaneseRuby('食べる','たべる')}い</p><p class="example-sentence" lang="ja">${('あ'+renderJapaneseRuby('取り扱う','とりあつかう')+'い。').repeat(8)}</p>`;document.body.append(host);await document.fonts.ready;});
  const short=await metrics('#furigana-probe p:first-child');check(short,{singleLine:true});assert.equal(short.text,'あ食べるい');const wrapped=await metrics('#furigana-probe p:last-child');check(wrapped);assert.equal(wrapped.text,'あ取り扱うい。'.repeat(8));await page.locator('#furigana-probe').evaluate(node=>node.remove());
  results.push({width,theme,explanation,detail,card,short,wrapped});
 }
 await writeFile('/private/tmp/japanese-furigana-layout/measurements.json',JSON.stringify(results,null,2));assert.deepEqual(errors,[]);console.log(`Passed ${results.length*4} Japanese example layout cases: Word List, Flashcards, mixed kanji/kana baselines and wrapped reading clearance; phone/tablet, light/dark and EN/KO explanations.`);
}catch(error){if(page)await page.screenshot({path:'/private/tmp/japanese-furigana-layout/failure.png',fullPage:true});throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
