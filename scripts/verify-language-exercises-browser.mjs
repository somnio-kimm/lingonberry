import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 await page.evaluate(async()=>{
  const {createPresentation}=await import('/js/presentation/multilingual.js');localStorage.removeItem('learn-language.ja.lexicon.v1');
  const host=document.createElement('main');document.body.replaceChildren(host);let route='home';let app;const refresh=()=>app.render(route,host);
  app=createPresentation({language:'ja',navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});
  app.setStudy({targetLanguage:'ja',explanationLanguage:'ko',studyVersion:'4.1.0',entries:[{id:'ja-taberu',word:'食べる',partOfSpeech:'verb',level:'N5',pronunciation:'たべる',meaning:'먹다'}],families:[],exercises:[{id:'ja-ex-tab',entryId:'ja-taberu',route:'vocabinput',category:'okurigana',prompt:'食べる → 食【　】べる',answer:'た',instruction:'食의 읽기만 입력하세요.',explanation:'食은 た, 오쿠리가나는 べる입니다.',segments:[{text:'食',reading:'た',kind:'kanji'},{text:'べる',reading:'べる',kind:'kana'}]},{id:'ja-ex-particle',entryId:'ja-taberu',route:'particles',category:'particles',prompt:'パン（　）食べる。',answer:'を',options:['を','に','で'],instruction:'조사를 고르세요.',explanation:'목적어는 を로 표시합니다.'}]});window.testApp=app;window.testRoute=value=>{route=value;refresh();};refresh();
 });
 assert.deepEqual(await page.locator('[data-route]').evaluateAll(nodes=>nodes.map(n=>n.dataset.route)),['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble','listening','okurigana','particles']);
 await page.locator('[data-route=okurigana]').click();
 assert.equal(await page.locator('.reading-segments').count(),0);await page.locator('#vocab-answer').fill('たべ');
 await page.locator('#vocab-answer').dispatchEvent('compositionstart');assert.ok(await page.locator('[data-submit]').isDisabled());await page.locator('#vocab-answer').dispatchEvent('compositionend');assert.ok(await page.locator('[data-submit]').isEnabled());
 await page.locator('[data-submit]').click();assert.ok(await page.locator('.lexicon-question.wrong').count());assert.equal(await page.locator('.reading-segment.kanji rt').innerText(),'た');
 await page.evaluate(()=>window.testRoute('wrong'));assert.match(await page.locator('.wrong-card').innerText(),/たべ/);assert.match(await page.locator('.wrong-card').innerText(),/食の|食의/);
 await page.locator('[data-retest]').click();await page.locator('#vocab-answer').fill('た');await page.locator('[data-submit]').click();assert.ok(await page.locator('.lexicon-question.correct').count());await page.locator('[data-next]').click();assert.match(await page.locator('.lexicon-retest-complete').innerText(),/Correct: 1/);
 await page.evaluate(()=>window.testRoute('particles'));await page.locator('[data-option="0"]').click();assert.ok(await page.locator('.lexicon-question.correct').count());
 assert.deepEqual(errors,[]);console.log('Passed: language-specific menu, category filters, hidden readings, IME, corrections, Review, retest and grammar choices.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
