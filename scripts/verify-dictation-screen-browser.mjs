import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,id){await page.locator(`[data-tab=${id}]`).click();await ready(page);}
async function open(page,language){await tab(page,'home');await page.locator(language==='zh'?'[data-quiz=listening]':'[data-route=listening]').click();await ready(page);await page.locator('.listening-question').waitFor();}
async function front(page){return page.evaluate(()=>{
 const q=document.querySelector('.listening-question'),box=q.getBoundingClientRect(),filter=document.querySelector('.filter-fold').getBoundingClientRect();
 const element=(node,origin=box)=>{const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:b.left-origin.left,y:b.top-origin.top,width:b.width,height:b.height,padding:s.padding,radius:s.borderRadius,border:s.borderWidth,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,background:s.backgroundColor,colour:s.color};};
 return {card:{width:box.width,height:box.height,gap:box.top-filter.bottom,padding:getComputedStyle(q).padding,radius:getComputedStyle(q).borderRadius,border:getComputedStyle(q).borderWidth,background:getComputedStyle(q).backgroundColor},speaker:element(q.querySelector('#listening-play')),answer:element(q.querySelector('.vocab-answer-cell')),field:{...element(q.querySelector('#listening-answer')),tag:q.querySelector('#listening-answer').tagName,rows:q.querySelector('#listening-answer').rows},hint:element(q.querySelector('#listening-hint')),submit:element(document.querySelector('#listening-submit')),skip:element(document.querySelector('#listening-skip'))};
 });}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>['de-DE','zh-CN','en-GB','ja-JP','ko-KR','es-ES','fr-FR'].map(lang=>({lang,localService:true})),cancel(){},speak(utterance){setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/dictation-screen',{recursive:true});const references=new Map();let checks=0;
 for(const language of ['de','zh','en','ja','ko','es','fr']){
  await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-en"] .download-package`).click();await page.locator(`[data-package="${language}-en"] .remove-package`).waitFor();
  for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:1000});await tab(page,'settings');await page.selectOption('#display-language',locale);await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target',language);await page.selectOption('#explanation','en');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await open(page,language);
   if(await page.locator('.filter-fold').evaluate(node=>node.open))await page.locator('.filter-fold>summary').click();
   for(const mode of ['listenword','listensentence']){
    await page.locator(`button[data-listening-mode=${mode}]`).click();await page.locator('.listening-question').waitFor();const geometry=await front(page),key=[locale,width,theme,mode].join('-');
    if(['de','zh'].includes(language))references.set(language+'-'+key,geometry);else assert.deepEqual(geometry,references.get((language==='ja'?'zh':'de')+'-'+key),language+' full Dictation '+key);
    assert.equal(await page.locator('.listening-transcript ruby,.listening-transcript rt').count(),0);assert.equal(await page.locator('#listening-answer').getAttribute('placeholder'),null);
    await page.locator('#listening-hint').click();assert.ok((await page.locator('.listening-hint-text').innerText()).trim(),JSON.stringify({language,locale,mode}));assert.ok(!(await page.locator('.listening-hint-text').innerText()).includes('Translation not available'));assert.equal(await page.locator('.listening-hint-text').getAttribute('lang'),'en',JSON.stringify({language,locale,mode}));await page.locator('#listening-hint').click();
    if(locale==='en')await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});if(locale==='en')await page.screenshot({path:`/private/tmp/dictation-screen/${language}-${width}-${theme}-${mode}.png`,fullPage:true});
    await page.locator('#listening-answer').fill('definitely incorrect');assert.equal(await page.locator('#listening-submit').isEnabled(),false);await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
    assert.equal(await page.locator('.listening-user-answer del').innerText(),'definitely incorrect');assert.equal(await page.locator('#listening-submit').count(),0);assert.equal(await page.locator('#listening-next').count(),1);assert.ok((await page.locator('.listening-transcript').innerText()).trim());
    if(language==='en'&&mode==='listensentence')assert.equal(await page.locator('.listening-translation').count(),0);
    if(locale==='en'&&width===390&&theme==='dark'){await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await page.screenshot({path:`/private/tmp/dictation-screen/${language}-${mode}-checked.png`,fullPage:true});}
    await page.locator('#listening-next').click();assert.equal(await page.locator('#listening-answer').inputValue(),'');assert.equal(await page.locator('#listening-submit').isEnabled(),false);checks++;
   }
  }
  if(['en','ja','ko','es','fr'].includes(language)){
   await page.locator('button[data-listening-mode=listensentence]').click();if(!await page.locator('.filter-fold').evaluate(node=>node.open))await page.locator('.filter-fold>summary').click();await page.locator('[data-filter-pos=all]').click();assert.equal(await page.locator('button[data-listening-mode=listensentence]').getAttribute('aria-pressed'),'true');const level=await page.locator('[data-level-filter]').inputValue(),other=await page.locator('[data-level-filter] option').nth(1).getAttribute('value');await page.selectOption('[data-level-filter]',other);assert.equal(await page.locator('button[data-listening-mode=listensentence]').getAttribute('aria-pressed'),'true');await page.selectOption('[data-level-filter]',level);

   await tab(page,'wrong');await page.locator('.wrong-filter-panel').evaluate(node=>{node.open=true;});await page.locator(`[data-review-filter=mode][data-value=${'listenword'}]`).click();await page.locator('[data-retest]').click();await page.locator('#listening-answer').waitFor();assert.equal(await page.locator('.listening-mode-controls').count(),0);
   const id=await page.locator('.listening-test').getAttribute('data-question-id'),saved=await page.evaluate(({language,id})=>Object.values(JSON.parse(localStorage.getItem(`learn-language.${language}.lexicon.v1`)).wrongs).find(row=>row.question.id===id),{language,id});
   await page.locator('#listening-answer').fill(saved.question.answer);await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();await page.locator('.vocab-answer-cell.correct').waitFor();
   const count=await page.evaluate(({language,key})=>JSON.parse(localStorage.getItem(`learn-language.${language}.lexicon.v1`)).wrongs[key]?.count,{language,key:saved.id});assert.equal(count,saved.count-1);await tab(page,'home');
  }
 }
 await tab(page,'settings');await page.selectOption('#display-language','en');await page.locator('[data-theme-choice=dark]').click();await page.selectOption('#target','ja');await page.selectOption('#explanation','en');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');await open(page,'ja');
 const sentence=await page.evaluate(async()=>{
  const [{createPresentation},{assembleStudy}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js')]),catalog=await fetch('/catalog.json').then(r=>r.json()),read=id=>fetch(catalog.find(row=>row.id===id).url).then(r=>r.json()),study=assembleStudy(await read('ja-core'),await read('ja-en')),entry=study.entries.find(row=>row.word==='食べる'),host=document.querySelector('main');let app;
  app=createPresentation({language:'ja',navigate(){},refresh:()=>app.render('listening',host),onPreferences(){}});app.setStudy({...study,entries:[entry]});app.setPreferences({theme:'dark',uiLanguage:'en'});app.render('listening',host);window.stopFuriganaFixture=()=>app.stop();return entry.example.text;
 });
 for(const mode of ['listenword','listensentence']){
  await page.locator(`button[data-listening-mode=${mode}]`).click();assert.equal(await page.locator('.listening-transcript rt').count(),0);await page.locator('#listening-answer').fill(mode==='listenword'?'食べる':'wrong');await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();await page.locator(mode==='listenword'?'.vocab-answer-cell.correct':'.vocab-answer-cell.wrong').waitFor();
  assert.equal(await page.locator('.listening-transcript rt').innerText(),'た');assert.equal(await page.locator('.listening-transcript rt').evaluate(node=>getComputedStyle(node).fontSize),'13px');const text=await page.locator('.listening-transcript').evaluate(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('rt').forEach(rt=>rt.remove());return copy.textContent;});assert.equal(text,mode==='listenword'?'食べる':sentence);assert.ok((await page.locator('.listening-transcript').innerHTML()).includes('</ruby>べ'));
  await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await page.screenshot({path:`/private/tmp/dictation-screen/ja-known-${mode}-feedback.png`,fullPage:true});
 }
 await page.evaluate(()=>window.stopFuriganaFixture());
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} full Dictation screens: English/German and Japanese/Chinese card/speaker/textarea/hint/action geometry; both modes, EN/KO, phone/tablet, themes, feedback, audio gating, five-language Review/retest balances and cleanup.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
