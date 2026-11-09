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
   const catalog=await fetch('/catalog.json').then(r=>r.json()),read=(id,version)=>fetch(catalog.find(row=>row.id===id&&(!version||row.version===version)).url).then(r=>r.json());
   const pair=await read('en-'+locale),study=assembleStudy(await read('en-core',pair.studyVersion),pair);
   localStorage.removeItem('learn-language.en.lexicon.v1');let route='home',app;const host=document.querySelector('main'),refresh=()=>app.render(route,host);
   const create=()=>createPresentation({language:'en',navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app=create();app.setPreferences({theme:'system',uiLanguage:locale==='en'?'ko':'en'});
   window.gapRoute=value=>{if(value==='wrong'){route=value;refresh();return;}route='home';refresh();const button=host.querySelector(`[data-route=${value}]`);if(button)button.click();else{route=value;refresh();}};
   window.gapReloadHistory=()=>{app.stop();const saved=JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1'));for(const [id,row]of Object.entries(saved.wrongs))if(row.question.category==='phrasal'){delete saved.wrongs[id];row.question.mode='phrasal';row.id=id.replace(/^collocations:/u,'phrasal:');saved.wrongs[row.id]=row;}localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify(saved));app=create();app.setStudy(study);route='wrong';refresh();};
   window.bulkPhraseScenario=()=>{
    app.setStudy(study);
    window.gapRoute('collocations');
   };
   window.gapScenario=({category,level})=>{
    const row=study.exercises.find(row=>row.category===category&&row.gapFill&&(!level||study.entries.some(entry=>entry.id===row.entryId&&entry.level===level))),entry=study.entries.find(entry=>entry.id===row.entryId);
    app.setStudy({...study,entries:study.entries.map(entry=>({...entry,tags:entry.tags?.filter(tag=>!tag.startsWith('practice:phrase:'))})),exercises:study.exercises.filter(item=>!item.gapFill||(category==='idioms'?item.entryId===row.entryId:item.id.replace(/-(input|choice)$/u,'')===row.id.replace(/-(input|choice)$/u,'')))});
    route='home';refresh();if(host.querySelector('[data-route=phrasal],[data-route=patterns]')||host.querySelectorAll('[data-route=collocations]').length!==0)throw new Error('Incorrect English Study sections');host.querySelector(`[data-level="${entry.level}"]`).click();window.gapRoute('collocations');host.querySelector('[data-phrase-category]').value=category;host.querySelector('[data-phrase-category]').dispatchEvent(new Event('change'));return row.gapFill;
   };
  },locale);
  for(const width of [390,1024])for(const theme of ['light','dark'])for(const category of ['phrasal','collocations']){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
   const gap=await page.evaluate(category=>window.gapScenario({category}),category);assert.equal(await page.locator('[data-route=phrasal]').count(),0);assert.equal(await page.locator('[data-phrase-category]').inputValue(),category);
   await page.selectOption('[data-question-type]','gaps');await page.locator('[data-answer-mode=input]').click();
   const fields=page.locator('[data-phrase-gap]');assert.equal(await fields.count(),2);assert.equal(await page.locator('.vocab-instruction').count(),0);assert.equal(await fields.first().getAttribute('aria-label'),locale==='en'?'빈칸 1':'Blank 1');assert.equal(await page.locator('#vocab-answer').count(),0);assert.ok(await page.locator('[data-submit]').isDisabled());
   await fields.nth(0).fill(gap.answers[0]);assert.ok(await page.locator('[data-submit]').isDisabled());await fields.nth(0).press('Enter');assert.equal(await fields.nth(1).evaluate(node=>document.activeElement===node),true);
   await fields.nth(1).fill('wrong');assert.ok(await page.locator('[data-submit]').isEnabled());
   const baseline=await page.locator('.lexicon-question').evaluate(node=>{const s=getComputedStyle(node);return {padding:s.padding,radius:s.borderRadius};});assert.deepEqual(baseline,{padding:'16px',radius:'16px'});
   assert.ok(await fields.evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44&&getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)')));
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
   await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await page.screenshot({path:`/private/tmp/phrase-gap-design/${locale}-${category}-${width}-${theme}.png`,fullPage:true});
   await page.locator('[data-submit]').click();await page.locator('.lexicon-question.wrong').waitFor();assert.deepEqual(await page.locator('.phrase-gap-sentence .cloze-answer').allTextContents(),gap.answers);assert.equal(await page.locator('.vocab-question .input-wrong,.vocab-question .vocab-wrong').count(),0);assert.equal(await page.locator('[data-submit]').count(),0);assert.equal(await page.locator('[data-next]').count(),1);
   await page.locator('[data-next]').click();assert.equal(await fields.count(),2);assert.equal(await fields.nth(0).inputValue(),'');
   const answers=gap.alternatives?.[0]||gap.answers;for(const [index,answer]of answers.entries())await fields.nth(index).fill(answer);await fields.nth(1).press('Enter');await page.locator('.lexicon-question.correct').waitFor();assert.deepEqual(await page.locator('.phrase-gap-sentence .cloze-answer').allTextContents(),answers);
   await page.locator('[data-next]').click();await page.locator('[data-answer-mode=choice]').click();assert.equal(await fields.count(),0);assert.equal(await page.locator('[data-submit]').count(),0);
   await page.locator('[data-option]').filter({hasText:gap.answers.join(' … ')}).click();await page.locator('.lexicon-question.correct').waitFor();assert.deepEqual(await page.locator('.phrase-gap-sentence .cloze-answer').allTextContents(),gap.answers);checks++;
  }
  await page.evaluate(()=>window.gapReloadHistory());await page.locator('.wrong-filter-panel').evaluate(node=>{node.open=true;});assert.equal(await page.locator('[data-review-filter=category]').count(),0);await page.locator('[data-review-filter=mode][data-value=collocations]').click();assert.equal(await page.locator('.wrong-card').count(),1);await page.locator('[data-review-filter=mode][data-value=phrasal]').click();assert.equal(await page.locator('.wrong-card').count(),1);assert.ok((await page.locator('.wrong-card').first().innerText()).includes('wrong'));assert.equal(await page.locator('.wrong-card .wrong-test-blank').count(),2);
  const before=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')).wrongs).find(row=>row.question.mode==='phrasal').count);await page.locator('[data-retest]').click();assert.equal(await page.locator('[data-phrase-gap]').count(),2);await page.locator('[data-phrase-gap="0"]').fill('write');await page.locator('[data-phrase-gap="1"]').fill('down');await page.locator('[data-submit]').click();await page.locator('.lexicon-question.correct').waitFor();assert.equal(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')).wrongs).find(row=>row.question.mode==='phrasal').count),before-1);
  for(const route of ['vocabmeaning','vocabinput']){await page.evaluate(route=>window.gapRoute(route),route);assert.equal(await page.locator('[data-phrase-gap],[data-question-type]').count(),0);assert.equal(await page.locator('[data-exercise-id]').getAttribute('data-exercise-id'),'');}
  if(locale==='en')for(const level of ['IELTS 1.0–3.5','IELTS 4.0–6.5','IELTS 7.0–8.0','IELTS 8.5–9.0']){
   const gap=await page.evaluate(level=>window.gapScenario({category:'idioms',level}),level);
   await page.selectOption('[data-question-type]','gaps');
   await page.locator('[data-answer-mode=input]').click();
   const field=page.locator('[data-phrase-gap]');
   assert.equal(await field.count(),1);
   await field.fill(gap.answers[0]);
   await page.locator('[data-submit]').click();
   await page.locator('.lexicon-question.correct').waitFor();
   await page.locator('[data-next]').click();
   await page.locator('[data-answer-mode=choice]').click();
   await page.locator('[data-option]').filter({hasText:gap.answers[0]}).click();
   await page.locator('.lexicon-question.correct').waitFor();
   checks+=2;
  }
  if(locale==='en'){
   await page.evaluate(()=>window.bulkPhraseScenario());
   await page.selectOption('[data-phrase-category]','idioms');
   await page.selectOption('[data-question-type]','phrase');
   await page.locator('[data-answer-mode=choice]').click();
   assert.match(await page.locator('.vocab-question').getAttribute('data-exercise-id'),/^en-phrase-ref-/u);
   assert.equal(await page.locator('[data-option]').count(),4);
   assert.ok((await page.locator('.vocab-prompt').innerText()).trim());
   await page.selectOption('[data-question-type]','gaps');
   await page.locator('[data-answer-mode=input]').click();
   assert.equal(await page.locator('[data-phrase-gap]').count(),1);
   checks+=2;
  }
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} real-package gap design/interaction paths: independent EN/KO display/explanation, phone/tablet, light/dark, separate inputs, IME binder, instant selection, alternatives, corrections, Review/retest and isolated defaults.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
