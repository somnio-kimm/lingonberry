import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';

const server=await startServer();
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await mkdir('/private/tmp/merged-expressions',{recursive:true});
 let scenarios=0;
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  const gap=await page.evaluate(async({locale,theme})=>{
   const [{createPresentation},{assembleStudy}]=await Promise.all([
    import('/js/presentation/multilingual.js'),import('/js/packages/study.js'),
   ]);
   const catalog=await fetch('/catalog.json').then(response=>response.json());
   const pairDescriptor=catalog.find(row=>row.id==='en-'+locale);
   const coreDescriptor=catalog.find(row=>row.id==='en-core'&&row.version===pairDescriptor.studyVersion);
   const [core,pair]=await Promise.all([coreDescriptor,pairDescriptor].map(row=>fetch(row.url).then(response=>response.json())));
   const original=assembleStudy(core,pair);
   const selected=original.exercises.find(row=>row.gapFill?.answers.length===2&&row.category==='phrasal');
   const anchor=original.entries.find(row=>row.id===selected.entryId);
   const host=document.querySelector('main');
   localStorage.removeItem('learn-language.en.lexicon.v1');
   let route='home',cleanup;
   const refresh=()=>{cleanup?.();cleanup=app.render(route,host);};
   const app=createPresentation({language:'en',navigate:next=>{route=next;refresh();},refresh,onPreferences(){}});
   app.setPreferences({uiLanguage:locale,theme});
   app.setStudy({...original,
    entries:original.entries.map(row=>({...row,example:undefined,additionalExamples:[],referenceExamples:[],
     tags:row.tags?.filter(tag=>!tag.startsWith('practice:phrase:'))})),
    exercises:original.exercises.filter(row=>row.id.replace(/-(input|choice)$/u,'')===selected.id.replace(/-(input|choice)$/u,'')),
   });
   document.documentElement.dataset.theme=theme;
   refresh();
   host.querySelector(`[data-level="${anchor.level}"]`).click();
   window.mergedRoute=next=>{route=next;refresh();};
   window.mergedRows=original.entries.filter(row=>row.level===anchor.level&&row.word.includes(' '));
   return selected.gapFill;
  },{locale,theme});
  assert.equal(await page.locator('[data-route=collocations],[data-route=phrasal],[data-route=idioms]').count(),0);
  await page.locator('[data-route=cloze]').click();
  assert.deepEqual(await page.locator('[data-answer-mode]').evaluateAll(nodes=>nodes.map(node=>node.dataset.answerMode)),['choice','input']);
  assert.equal(await page.locator('[data-sentence-submit]').count(),0);
  assert.equal(await page.locator('.vocab-instruction').count(),0);
  await page.locator('[data-cloze-option]').filter({hasText:gap.answers.join(' … ')}).click();
  await page.locator('.lexicon-question.correct').waitFor();
  await page.locator('[data-sentence-next]').click();
  await page.locator('[data-answer-mode=input]').click();
  const fields=page.locator('[data-phrase-gap]');
  assert.equal(await fields.count(),2);
  await fields.nth(0).fill(gap.answers[0]);
  assert.equal(await page.locator('[data-sentence-submit]').isDisabled(),true);
  await fields.nth(1).fill('wrong');
  await page.locator('[data-sentence-submit]').click();
  await page.locator('.lexicon-question.wrong').waitFor();
  assert.deepEqual(await page.locator('.cloze-answer').allTextContents(),gap.answers);
  assert.equal(await page.locator('.cloze-tools .speak-btn').count(),1);
  assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);
  await page.screenshot({path:`/private/tmp/merged-expressions/${locale}-${width}-${theme}.png`,fullPage:true});
  await page.evaluate(()=>window.mergedRoute('wrong'));
  assert.match(await page.locator('.wrong-card').innerText(),locale==='ko'?/빈칸 채우기/u:/Cloze/u);
  await page.locator('[data-retest]').click();
  assert.equal(await fields.count(),2);
  for(const [i,answer]of gap.answers.entries())await fields.nth(i).fill(answer);
  await page.locator('[data-sentence-submit]').click();
  await page.locator('.lexicon-question.correct').waitFor();
  scenarios++;
 }
 assert.deepEqual(errors,[]);
 console.log(`Passed ${scenarios} merged expression scenarios across locales, themes and phone/tablet widths.`);
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
