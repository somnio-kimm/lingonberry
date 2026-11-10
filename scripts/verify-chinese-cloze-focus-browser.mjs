import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const reading of [false,true]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme,reading})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;
   for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='zh';
   const {Store}=await import('/languages/zh/js/services/store.js');Store.clozeShowPinyin=reading;
   const {createPresentation}=await import('/js/presentation/chinese.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let app;const navigate=route=>app.render(route,host);app=createPresentation({navigate});
   app.setPreferences({uiLanguage:locale,hapticEnabled:false});
   // Independently written repeated-word fixture, not an unpublished corpus sample.
   app.setStudy({targetLanguage:'zh',explanationLanguage:locale,studyVersion:'1.0.0',entries:[
    {id:'focus-book',word:'书',partOfSpeech:'Noun',level:'1',pronunciation:'shū',meaning:locale==='en'?'book':'책',example:{text:'他看书，我读书。',pronunciation:'ta1 kan4 shu1 wo3 du2 shu1',translation:locale==='en'?'He reads a book; I read a book.':'그는 책을 읽고 나도 책을 읽는다.',focus:{start:6,text:'书'}}},
    {id:'focus-water',word:'水',partOfSpeech:'Noun',level:'1',pronunciation:'shuǐ',meaning:locale==='en'?'water':'물'},
   ]});window.focusTestNavigate=navigate;window.focusTestStore=Store;navigate('cloze');
   window.readWithoutAnnotations=node=>{const copy=node.cloneNode(true);copy.querySelectorAll('rt').forEach(rt=>rt.remove());return copy.textContent;};
   window.readBefore=node=>{const range=document.createRange();range.selectNodeContents(node.parentNode.closest('.cloze-sentence,.wrong-question'));range.setEndBefore(node);const host=document.createElement('div');host.append(range.cloneContents());return window.readWithoutAnnotations(host);};
  },{locale,theme,reading});
  assert.equal(await page.locator('.cloze-sentence').evaluate(node=>window.readWithoutAnnotations(node)),'他看书，我读______。');
  await page.locator('[data-o="水"]').click();
  assert.equal(await page.locator('.cloze-sentence .cloze-answer').evaluate(node=>window.readBefore(node)),'他看书，我读');
  const saved=await page.evaluate(()=>window.focusTestStore.wrongAnswers[0]);assert.equal(saved.question.blankStart,6);assert.equal(saved.question.sentence.focus.start,6);
  await page.evaluate(()=>window.focusTestNavigate('wrong'));
  await page.locator('#retest-filtered:not([disabled])').waitFor();
  assert.equal(await page.locator('.wrong-test-blank').evaluate(node=>window.readBefore(node)),'他看书，我读');
  await page.locator('#retest-filtered').click();
  assert.equal(await page.locator('#retest-question .cloze-sentence').evaluate(node=>window.readWithoutAnnotations(node)),'他看书，我读______。');
  const history=await page.evaluate(()=>{
   const Store=window.focusTestStore,old=structuredClone(Store.wrongAnswers[0]);old.question.blankStart=2;
   Store.addWrong({...old,id:undefined});const before=localStorage.getItem('learn-language.zh.wrong');window.focusTestNavigate('wrong');return before;
  });
  await page.locator('#retest-filtered:not([disabled])').waitFor();
  assert.equal(await page.locator('.wrong-item').count(),2);
  assert.match(await page.locator('#retest-filtered').innerText(),/\(1\)/);
  const positions=await page.locator('.wrong-test-blank').evaluateAll(nodes=>nodes.map(node=>window.readBefore(node)));
  assert.deepEqual(positions,['他看','他看书，我读']);
  assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.zh.wrong')),history);checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} Chinese Cloze target checks: EN/KO, phone/tablet, light/dark, reading off/on, feedback, original Review and retest; history unchanged.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
