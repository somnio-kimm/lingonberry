import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');let checks=0;
 for(const language of ['de','zh','en','ja'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(async({language,locale,theme})=>{
   window.readingCleanup?.();const [{renderListeningView},{listeningLabels},{DeviceSpeech}]=await Promise.all([import('/js/shared/listening-view.js'),import('/js/shared/listening-text.js'),import('/js/shared/device-speech.js')]);document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=language==='zh';document.getElementById('style-zh').disabled=language!=='zh';
   const [answer,pronunciation]={de:['Auto','/ˈaʊ̯to/'],zh:['车','chē'],en:['car','/kɑː/'],ja:['車','くるま']}[language];window.readingAnswer=answer;const word={id:'test',pronunciation,studyExplanationLanguage:locale};DeviceSpeech.speak=()=>new Promise(resolve=>{
    window.readingPlayStarts++;
    window.finishReadingSpeech=(success=true)=>resolve(success);
   });DeviceSpeech.stop=()=>{};window.readingAttempts=[];window.readingPlayStarts=0;
   window.readingCleanup=renderListeningView(document.querySelector('main'),{labels:listeningLabels(locale),locale:()=>locale,questions:mode=>[{id:'test-'+mode,mode,kind:mode==='listenword'?'word':'sentence',language,word,locale,spokenText:answer,answer}],translation:()=>'',hint:()=>locale==='ko'?'차':'car',answerCorrect:(_q,input)=>input===answer,record:(_q,input,correct,attempt)=>window.readingAttempts.push({...attempt,input,correct})});
  },{language,locale,width,theme});
  assert.equal(await page.locator('.listening-reading').isVisible(),false);await page.locator('#listening-answer').fill(await page.evaluate(()=>window.readingAnswer));assert.equal(await page.locator('#listening-submit').isDisabled(),true);await page.locator('#listening-reading-hint').click();assert.ok(await page.locator('.listening-reading').isVisible());assert.equal(await page.locator('#listening-submit').isDisabled(),true);await page.locator('#listening-play').click();assert.equal(await page.locator('#listening-submit').isDisabled(),true);await page.evaluate(()=>window.finishReadingSpeech());await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-submit').click();assert.equal(await page.evaluate(()=>window.readingAttempts[0].hintUsed),true);await page.locator('#listening-next').click();assert.equal(await page.locator('.listening-reading').isVisible(),false);await page.locator('[data-listening-mode=listensentence]').click();assert.equal(await page.locator('#listening-reading-hint').count(),0);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
  const play=page.locator('#listening-play'),count=page.locator('[data-listening-play-count]');
  assert.equal(await count.innerText(),'0 / 3');
  assert.ok(await page.locator('.listening-question .vocab-answer-cell.active').evaluate(node=>node.getBoundingClientRect().height<=64));
  await play.click();
  await page.evaluate(()=>window.finishReadingSpeech(false));
  await play.waitFor();assert.equal(await count.innerText(),'0 / 3','An unsuccessful play does not consume a listen');
  for(let n=1;n<=3;n++){
   await play.click();await page.evaluate(()=>window.finishReadingSpeech());
   await page.waitForFunction(n=>document.querySelector('[data-listening-play-count]').textContent===n+' / 3',n);
  }
  assert.ok(await play.isDisabled());
  const playsBefore=await page.evaluate(()=>window.readingPlayStarts);
  await play.evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  assert.equal(await page.evaluate(()=>window.readingPlayStarts),playsBefore,'A fourth play is rejected');
  if(width===390){
   assert.equal(await page.locator('#listening-skip').innerText(),locale==='ko'?'포기':'Give Up');
   await page.locator('#listening-skip').click();
   assert.deepEqual(await page.evaluate(()=>window.readingAttempts.at(-1)),{heard:true,hintUsed:false,plays:3,input:'',correct:false});
   assert.equal(await page.locator('.listening-user-answer').innerText(),locale==='ko'?'미응답':'No answer');
  }else{
   await page.locator('#listening-answer').fill(await page.evaluate(()=>window.readingAnswer));
   await page.locator('#listening-submit').click();
   assert.equal(await page.locator('.vocab-answer-cell.correct').count(),1,'Submission remains possible after the third play');
  }
  await page.locator('#listening-next').click();
  assert.equal(await count.innerText(),'0 / 3');checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} Dictation checks: supplied readings, compact input, audio gate, three completed plays, Give Up grading, submission after the limit and reset.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
