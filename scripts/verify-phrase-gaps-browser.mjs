import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await mkdir('/private/tmp/phrase-gap-design',{recursive:true});let checks=0;
 for(const locale of ['en','ko']){
  await page.evaluate(async locale=>{
   const [{createPresentation},{assembleStudy}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js')]);
   const catalog=await fetch('/catalog.json').then(r=>r.json()),read=id=>fetch(catalog.find(row=>row.id===id).url).then(r=>r.json());
   const study=assembleStudy(await read('en-core'),await read('en-'+locale));
   localStorage.removeItem('learn-language.en.lexicon.v1');let route='home',app;const host=document.querySelector('main'),refresh=()=>app.render(route,host);
   const create=()=>createPresentation({language:'en',navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app=create();app.setPreferences({theme:'system',uiLanguage:locale});
   window.gapRoute=value=>{if(value==='wrong'){route=value;refresh();return;}route='home';refresh();host.querySelector(`[data-route=${value}]`).click();};
   window.gapReloadHistory=()=>{app.stop();const saved=JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1'));for(const [id,row]of Object.entries(saved.wrongs))if(row.question.category==='phrasal'){delete saved.wrongs[id];row.question.mode='phrasal';row.id=id.replace(/^collocations:/u,'phrasal:');saved.wrongs[row.id]=row;}localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify(saved));app=create();app.setStudy(study);route='wrong';refresh();};
   window.gapScenario=category=>{
    const row=study.exercises.find(row=>row.category===category&&row.gapFill),entry=study.entries.find(entry=>entry.id===row.entryId);
    app.setStudy({...study,exercises:study.exercises.filter(item=>!item.gapFill||item.id.replace(/-(input|choice)$/u,'')===row.id.replace(/-(input|choice)$/u,''))});
    route='home';refresh();if(host.querySelector('[data-route=phrasal],[data-route=patterns]')||host.querySelectorAll('[data-route=collocations]').length!==1)throw new Error('Incorrect English Study sections');host.querySelector(`[data-level="${entry.level}"]`).click();window.gapRoute('collocations');host.querySelector('[data-phrase-category]').value=category;host.querySelector('[data-phrase-category]').dispatchEvent(new Event('change'));return row.gapFill;
   };
  },locale);
  for(const width of [390,1024])for(const theme of ['light','dark'])for(const category of ['phrasal','collocations']){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
   const gap=await page.evaluate(category=>window.gapScenario(category),category);assert.equal(await page.locator('[data-route=phrasal]').count(),0);assert.equal(await page.locator('[data-phrase-category]').inputValue(),category);
   await page.selectOption('[data-question-type]','gaps');await page.locator('[data-answer-mode=input]').click();
   const fields=page.locator('[data-phrase-gap]');assert.equal(await fields.count(),2);assert.equal(await page.locator('#vocab-answer').count(),0);assert.ok(await page.locator('[data-submit]').isDisabled());
   await fields.nth(0).fill(gap.answers[0]);assert.ok(await page.locator('[data-submit]').isDisabled());await fields.nth(0).press('Enter');assert.equal(await fields.nth(1).evaluate(node=>document.activeElement===node),true);
   await fields.nth(1).fill('wrong');assert.ok(await page.locator('[data-submit]').isEnabled());
   const baseline=await page.locator('.lexicon-question').evaluate(node=>{const s=getComputedStyle(node);return {padding:s.padding,radius:s.borderRadius};});assert.deepEqual(baseline,{padding:'16px',radius:'16px'});
   assert.ok(await fields.evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44&&getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)')));
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
   await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await page.screenshot({path:`/private/tmp/phrase-gap-design/${locale}-${category}-${width}-${theme}.png`,fullPage:true});
   await page.locator('[data-submit]').click();await page.locator('.lexicon-question.wrong').waitFor();assert.equal(await page.locator('.phrase-gap-result.correct').count(),1);assert.equal(await page.locator('.phrase-gap-result.wrong').count(),1);assert.equal(await page.locator('.input-wrong').innerText(),'wrong');assert.equal(await page.locator('[data-submit]').count(),0);assert.equal(await page.locator('[data-next]').count(),1);
   await page.locator('[data-next]').click();assert.equal(await fields.count(),2);assert.equal(await fields.nth(0).inputValue(),'');
   const answers=gap.alternatives?.[0]||gap.answers;for(const [index,answer]of answers.entries())await fields.nth(index).fill(answer);await fields.nth(1).press('Enter');await page.locator('.lexicon-question.correct').waitFor();assert.equal(await page.locator('.phrase-gap-result.wrong').count(),0);
   await page.locator('[data-next]').click();await page.locator('[data-answer-mode=choice]').click();assert.equal(await fields.count(),0);assert.equal(await page.locator('[data-submit]').count(),0);
   await page.locator('[data-option]').filter({hasText:gap.answers.join(' … ')}).click();await page.locator('.lexicon-question.correct').waitFor();assert.equal(await page.locator('.phrase-gap-result.correct').count(),2);checks++;
  }
  await page.evaluate(()=>window.gapReloadHistory());await page.selectOption('[data-mode]','collocations');assert.equal(await page.locator('.wrong-card').count(),2);await page.selectOption('[data-review-category]','phrasal');assert.ok((await page.locator('.wrong-card').first().innerText()).includes('wrong'));assert.equal(await page.locator('.wrong-card .form-question-blank').count(),2);
  const before=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')).wrongs).find(row=>row.question.mode==='phrasal').count);await page.locator('[data-retest]').click();assert.equal(await page.locator('[data-phrase-gap]').count(),2);await page.locator('[data-phrase-gap="0"]').fill('write');await page.locator('[data-phrase-gap="1"]').fill('down');await page.locator('[data-submit]').click();await page.locator('.lexicon-question.correct').waitFor();assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')).wrongs).find(row=>row.question.mode==='phrasal').count),before-1);
  for(const route of ['vocabmeaning','vocabinput']){await page.evaluate(route=>window.gapRoute(route),route);assert.equal(await page.locator('[data-phrase-gap],[data-question-type]').count(),0);assert.equal(await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'),'');}
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} real-package gap design/interaction paths: EN/KO, phone/tablet, light/dark, separate inputs, IME binder, instant selection, alternatives, corrections, Review/retest and isolated defaults.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
