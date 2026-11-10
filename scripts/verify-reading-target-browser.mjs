import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,id){await page.locator(`[data-tab=${id}]`).click();await ready(page);}
async function route(page,id){await tab(page,'home');await page.locator(`[data-route=${id}]`).click();await ready(page);}
async function mark(page,entry,status){await tab(page,'home');await page.locator(`[data-level="${entry.level}"]`).click();await route(page,'wordlist');await page.locator('#search-input').fill(entry.word);await page.locator(`[data-word="${entry.id}"] .wl-main`).click();await page.locator(`[data-status=${status}]`).click();await ready(page);}
async function learned(page){const fold=page.locator('.filter-fold');if(!await fold.evaluate(node=>node.open))await fold.locator('summary').click();await page.locator('[data-f=learning]').click();await fold.evaluate(node=>{node.open=false;});}
try{
 const catalog=await read('web/catalog.json'),core=await read(catalog.find(row=>row.id==='ja-core').url.slice(1)),targets=['学校','大きい','久しい','体中'].map(word=>core.entries.find(row=>row.word===word));assert.ok(targets.every(Boolean));
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{let state=123456789;Math.random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};});await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/japanese-reading-target',{recursive:true});
 await page.locator('#manage-packages').click();await page.locator('[data-language=ja]').click();for(const locale of ['en','ko']){await page.locator(`[data-available="ja-${locale}"] .download-package`).click();await page.locator(`[data-package="ja-${locale}"] .remove-package`).waitFor();}
 const curatedTranslations=await read('language-packages/sources/exercises/japanese-reading-context.json');
 const pairs=Object.fromEntries(await Promise.all(['en','ko'].map(async locale=>[locale,new Map((await read(catalog.find(row=>row.id==='ja-'+locale).url.slice(1))).entries.map(row=>[row.id,row]))])));
 const fold=value=>value.normalize('NFKC').trim().replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60)),readingPools=new Map();for(const entry of core.entries){if(!readingPools.has(entry.partOfSpeech))readingPools.set(entry.partOfSpeech,new Set());if(entry.pronunciation)readingPools.get(entry.partOfSpeech).add(fold(entry.pronunciation));}
 let checks=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const ui of ['en','ko']){
  const explanation=ui;await page.setViewportSize({width,height:900});await tab(page,'settings');await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target','ja');await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  await tab(page,'home');assert.equal(await page.locator('[data-route=reading] .menu-label').innerText(),ui==='ko'?'한자 읽기':'Word Reading');assert.equal(await page.locator('[data-route=okurigana] .menu-label').innerText(),ui==='ko'?'오쿠리가나':'Okurigana');
  for(const entry of targets){
   await mark(page,entry,'learning');await route(page,'reading');await learned(page);await page.locator('[data-answer-mode=choice]').click();
   assert.equal(await page.locator('#header-title').innerText(),ui==='ko'?'한자 읽기':'Word Reading');assert.equal(await page.locator('.vocab-instruction').count(),0);
   const target=page.locator('.vocab-prompt .study-reading-target');assert.equal(await target.innerText(),entry.word);const prompt=await page.locator('.vocab-prompt').innerText();assert.equal(prompt.split(entry.word).length-1,1);assert.ok(!/[［］【】]/u.test(prompt));assert.equal(await page.locator('.vocab-prompt rt').count(),0);
   if(entry.word==='体中')assert.equal(prompt,entry.example.text,'Reviewed target keeps the whole example sentence');
   const entryText=pairs[explanation].get(entry.id);
   const expected=prompt===entry.word?entryText.meaning:entry.word==='学校'?curatedTranslations['ja-ex-reading-school'][explanation]:entryText.exampleTranslation;
   assert.equal(await page.locator('.exercise-context').innerText(),expected);

   assert.ok(await target.evaluate(node=>{const s=getComputedStyle(node),title=getComputedStyle(document.querySelector('.section-title'));return s.textDecorationLine.includes('underline')&&s.textDecorationThickness==='2px'&&s.textDecorationColor===title.color;}));assert.equal(await page.locator('[data-submit]').count(),0);
   if(['学校','体中'].includes(entry.word))await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});
   if(entry.word==='学校')await page.screenshot({path:`/private/tmp/japanese-reading-target/selection-${width}-${theme}-${ui}.png`,fullPage:true});
   if(entry.word==='体中')await page.screenshot({path:`/private/tmp/japanese-reading-target/reviewed-focus-${width}-${theme}-${ui}.png`,fullPage:true});
   const options=()=>page.locator('[data-option]').allTextContents();
   assert.ok((await options()).every(value=>readingPools.get(entry.partOfSpeech).has(fold(value))),'Every option is a verified same-POS reading');
   if(entry.word==='学校'){
    const sets=new Set();
    for(let attempt=0;attempt<4;attempt++){
     const before=await options();sets.add([...before].sort().join('|'));assert.equal(new Set(before.map(fold)).size,before.length);assert.ok(before.every(value=>readingPools.get('noun').has(fold(value))));
     const selected=attempt===0&&width===390&&theme==='light'&&ui==='en'?page.locator('[data-option]').filter({hasNotText:/^がっこう$/u}).first():page.locator('[data-option]').filter({hasText:/^がっこう$/u});await selected.click();await page.locator('[data-next]').waitFor();assert.deepEqual(await options(),before,'Feedback keeps this question’s original choices');await page.locator('[data-next]').click();assert.equal(await page.locator('.study-reading-target').innerText(),'学校');
    }
    assert.ok(sets.size>1,'The same target receives fresh distractors, not just a new order');
   }
   const correct=page.locator('[data-option]').filter({hasText:new RegExp('^'+entry.pronunciation+'$','u')});assert.equal(await correct.count(),1);await correct.click();await page.locator('.lexicon-question.correct').waitFor();assert.equal(await page.locator('.vocab-question .exercise-explanation').count(),0);await page.locator('[data-next]').click();
   await page.locator('[data-answer-mode=input]').click();assert.equal(await page.locator('.vocab-instruction').count(),0);await page.locator('#vocab-answer').fill(entry.pronunciation);await page.locator('[data-submit]').click();await page.locator('.vocab-answer-cell.correct').waitFor();assert.equal(await page.locator('.vocab-question .exercise-explanation').count(),0);await page.locator('[data-next]').click();await page.locator('#vocab-answer').fill('wrong');await page.locator('[data-submit]').click();await page.locator('.vocab-answer-cell.wrong').waitFor();assert.equal(await page.locator('.vocab-question .exercise-explanation').count(),0);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));checks+=2;
   await mark(page,entry,'new');
  }
 }
 const savedChoice=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.ja.lexicon.v1')).wrongs).find(row=>row.question.options&&row.question.word.lemma==='学校'));assert.ok(savedChoice);
 await tab(page,'home');await page.locator('[data-level=N5]').click();await tab(page,'wrong');
 const readingReview=page.locator(`[data-review-word="${savedChoice.question.word.id}"]`).filter({has:page.locator('.study-reading-target')}).first();
 assert.equal(await readingReview.locator('.wrong-question').innerText(),savedChoice.question.prompt);
 assert.equal(await readingReview.locator('.wrong-translation').innerText(),savedChoice.question.context);
 assert.equal(await readingReview.locator('.study-reading-target').innerText(),'学校');
 await page.screenshot({path:'/private/tmp/japanese-reading-target/review-sentence.png',fullPage:true});
 await page.locator('[data-retest]').click();await page.locator('[data-option]').first().waitFor();assert.deepEqual(await page.locator('[data-option]').allTextContents(),savedChoice.question.options.map(option=>option.text),'Saved retest keeps its recorded choices');await page.locator(`[data-option="${savedChoice.question.correctOption}"]`).click();await page.locator('[data-next]').waitFor();assert.deepEqual(await page.locator('[data-option]').allTextContents(),savedChoice.question.options.map(option=>option.text));await tab(page,'home');await page.locator('[data-level=N1]').click();
 await tab(page,'wrong');await page.locator('.wrong-card').first().waitFor();assert.equal(await page.locator('.wrong-card .vocab-prompt,.wrong-card .vocab-instruction,.wrong-card .wrong-correct-line').count(),0);assert.ok(await page.locator('.wrong-card .wrong-user-line').count());await page.locator('[data-retest]').click();await page.locator('.study-reading-target').waitFor();assert.equal(await page.locator('.vocab-instruction').count(),0);
 const retestPrompt=await page.locator('.vocab-prompt').innerText();
 const savedRetest=await page.evaluate(prompt=>Object.values(JSON.parse(localStorage.getItem('learn-language.ja.lexicon.v1')).wrongs).find(row=>!row.question.options&&row.question.prompt===prompt),retestPrompt);assert.ok(savedRetest);
 await page.locator('#vocab-answer').fill(savedRetest.question.answer);await page.locator('[data-submit]').click();await page.locator('.vocab-answer-cell.correct').waitFor();assert.equal(await page.locator('.vocab-question .exercise-explanation').count(),0);await page.context().setOffline(true);await page.reload();await ready(page);await route(page,'reading');await page.locator('.study-reading-target').waitFor();assert.deepEqual(errors,[]);console.log(`Passed ${checks} reading-target cases: curated and generated sentences, standalone fallback, reviewed focus spans, single blue underline, display-language labels and no instruction line, full same-POS readings, fresh distractors for repeated targets, stable feedback, Selection/Typing, frozen Review/retest choices and offline use; phone/tablet and light/dark.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
