import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const legacy of [false,true]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');
   const {sentenceTokens}=await import('/languages/de/js/core/sentence-quizzes.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const makeApp=()=>createPresentation({navigate:route=>window.reviewApp.render(route,host),refresh(){},onPreferences(){}});
   window.reviewHost=host;window.makeReviewApp=makeApp;window.reviewApp=makeApp();window.reviewApp.setPreferences({uiLanguage:locale,hapticEnabled:false});
   window.oldReviewSentence='Das Buch liegt hier.';window.oldReviewTokens=sentenceTokens(window.oldReviewSentence);
   window.reviewStudy=(version,text)=>({targetLanguage:'de',explanationLanguage:locale,studyVersion:version,entries:[
    {id:'book',word:'Buch',article:'das',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'book':'책',example:{text,translation:locale==='en'?'A book example.':'책에 관한 예문.'}},
    {id:'water',word:'Wasser',article:'das',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'water':'물'},
   ]});window.reviewApp.setStudy(window.reviewStudy('1.0.0',window.oldReviewSentence));window.reviewApp.render('cloze',host);
  },{locale,theme});
  await page.locator('.opt-btn').filter({hasText:'Wasser'}).click();await page.locator('#quiz-next').waitFor();
  await page.evaluate(()=>window.reviewApp.render('scramble',window.reviewHost));await page.locator('[data-pool]').first().click();await page.locator('#quiz-submit').click();await page.locator('#quiz-next').waitFor();
  const before=await page.evaluate(async({legacy})=>{
   const key='learn-language.de.progress.v1',state=JSON.parse(localStorage.getItem(key));
   if(legacy)for(const mode of ['cloze','scramble']){const [id,record]=Object.entries(state.quizAnswers[mode])[0];record.questionSnapshot=null;delete state.quizAnswers[mode][id];const oldId=mode==='scramble'?'book:0':'book:0:'+record.questionContext.start;state.quizAnswers[mode][oldId]=record;}
   state.wordStatus.book='mastered';localStorage.setItem(key,JSON.stringify(state));const oldRecords=JSON.stringify(state.quizAnswers);
   window.reviewApp.stop();window.reviewApp=window.makeReviewApp();window.reviewApp.setPreferences({uiLanguage:state.preferences.uiLang,hapticEnabled:false});
   window.reviewApp.setStudy(window.reviewStudy('2.0.0','Ich lese das Buch.'));window.reviewApp.render('wrong',window.reviewHost);return oldRecords;
  },{legacy});
  await page.locator('.wrong-entry').first().waitFor();assert.equal(await page.locator('.wrong-entry').count(),2);
  assert.match(await page.locator('#retest-filtered').innerText(),/\(2\)/);
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers)),before);
  await page.locator('#retest-filtered').click();
  for(let i=0;i<2;i++){
   await page.locator('#retest-question [data-pool],#retest-question .opt-btn').first().waitFor();
   const mode=await page.locator('#retest-question').getAttribute('data-review-mode');
   if(mode==='scramble'){
    const tokens=await page.evaluate(()=>window.oldReviewTokens);
    for(const token of tokens)await page.locator('#retest-question [data-pool]').filter({hasText:new RegExp('^'+token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first().click();
    await page.locator('#quiz-submit').click();
   }else{assert.equal(mode,'cloze');await page.locator('#retest-question .opt-btn').filter({hasText:'Buch'}).click();}
   assert.equal(await page.locator('#retest-question .sentence-quiz-text').innerText(),'Das Buch liegt hier.');await page.locator('#quiz-next').click();
  }
  await page.locator('.retest-complete').waitFor();
  const after=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('learn-language.de.progress.v1'));return {mastered:s.wordStatus.book,rows:['cloze','scramble'].map(mode=>Object.values(s.quizAnswers[mode])[0])};});
  assert.equal(after.mastered,'mastered');for(const row of after.rows){assert.equal(row.example.de,'Das Buch liegt hier.');assert.equal(row.attempts.length,2);assert.equal(row.attempts.at(-1).correct,true);}checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German sentence-update browser checks: EN/KO, phone/tablet, light/dark, legacy/new snapshots, actual dataset update, original Review/retest and preserved manual progress.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
