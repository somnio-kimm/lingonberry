import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const mixed of [false,true]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  const evidence=await page.evaluate(async({locale,theme,mixed})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;
   for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='zh';
   const {Store}=await import('/languages/zh/js/services/store.js');
   const {t}=await import('/languages/zh/js/services/i18n.js');
   const {createPresentation}=await import('/js/presentation/chinese.js');
   const {snapshotQuestion}=await import('/languages/zh/js/services/wrong-review.js');
   const {listeningQuestions}=await import('/languages/zh/js/services/listening-tests.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let app;const navigate=route=>app.render(route,host);app=createPresentation({navigate});
   app.setPreferences({uiLanguage:locale,hapticEnabled:false});
   app.setStudy({targetLanguage:'zh',explanationLanguage:locale,studyVersion:'1.0.0',entries:[
    {id:'reference-book',word:'书',partOfSpeech:'Noun',level:'1',pronunciation:'shū',meaning:locale==='en'?'book':'책',example:{text:'我读书。',pronunciation:'wo3 du2 shu1',translation:locale==='en'?'I read a book.':'나는 책을 읽는다.',focus:{start:2,text:'书'},practiceEligible:false},additionalExamples:[{text:'我看书。',pronunciation:'wo3 kan4 shu1',translation:locale==='en'?'I read a book.':'나는 책을 읽는다.',focus:{start:2,text:'书'},practiceEligible:mixed}]},
    {id:'reference-water',word:'水',partOfSpeech:'Noun',level:'1',pronunciation:'shuǐ',meaning:locale==='en'?'water':'물'},
   ]});window.referenceNavigate=navigate;window.referenceStore=Store;
   window.referenceText=node=>{const copy=node.cloneNode(true);copy.querySelectorAll('rt').forEach(rt=>rt.remove());return copy.textContent;};
   const word=Store.words.find(word=>word.id==='reference-book');
   for(const mode of ['cloze','scramble'])Store.addWrong({mode,wordId:word.id,wordHanzi:word.hanzi,hskLevel:1,userAnswer:'水',correctAnswer:mode==='cloze'?'书':'我读书。',question:snapshotQuestion(mode,word,word.sentences[0])});
   window.referenceHistory=localStorage.getItem('learn-language.zh.wrong');window.referenceTitles={cloze:t('mode_cloze'),scramble:t('mode_scramble'),wrong:t('wrongBook')};
   navigate('wordlist');return {dictionaryExamples:word.sentences.length,listeningSentences:listeningQuestions('listensentence',Store.words,locale).length};
  },{locale,theme,mixed});
  assert.deepEqual(evidence,{dictionaryExamples:2,listeningSentences:mixed?1:0});
  await page.locator('.wl-main').first().click();assert.equal(await page.locator('.study-examples .fc-example-block').count(),2);
  await page.locator('.detail-sheet-close').click();
  await page.evaluate(()=>window.referenceNavigate('cloze'));await page.waitForFunction(()=>document.querySelector('main > section')?.dataset.viewState==='ready'&&document.querySelector('main .section-title')?.textContent.trim()===window.referenceTitles.cloze);
  if(mixed)assert.equal(await page.locator('.cloze-sentence').evaluate(node=>window.referenceText(node)),'我看______。');
  else assert.equal(await page.locator('.cloze-sentence').count(),0);
  await page.evaluate(()=>window.referenceNavigate('scramble'));await page.waitForFunction(()=>document.querySelector('main > section')?.dataset.viewState==='ready'&&document.querySelector('main .section-title')?.textContent.trim()===window.referenceTitles.scramble);
  if(mixed)assert.equal((await page.locator('.scramble-chip-hanzi').allTextContents()).sort().join(''),[...'我看书。'].sort().join(''));
  else assert.equal(await page.locator('.scramble-chip').count(),0);
  await page.evaluate(()=>window.referenceNavigate('wrong'));
  await page.locator('.wrong-item').first().waitFor();assert.equal(await page.locator('.wrong-item').count(),2);assert.equal(await page.locator('#retest-filtered').isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.zh.wrong')===window.referenceHistory),true);checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} Chinese reference-example checks: EN/KO, phone/tablet, light/dark, mixed/only-reference dictionaries, Cloze/Scramble/Dictation eligibility and readable saved Review without retest or history mutation.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
