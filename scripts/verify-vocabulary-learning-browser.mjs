import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer(),directory=join(tmpdir(),'lingonberry-vocabulary-learning');let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir(directory,{recursive:true});let checks=0;
 for(const language of ['de','zh','en','ja'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const mode of ['vocabinput','vocabmeaning']){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async({language,locale,theme,mode})=>{
   window.learningCleanup?.();window.learningApp?.stop();localStorage.clear();
   const {presentationDefinitions}=await import('/js/presentation/index.js'),{createPresentation}=await presentationDefinitions[language].load(),definition=presentationDefinitions[language],host=document.querySelector('main');host.parentElement.id=definition.layout.root;host.id=definition.layout.main;document.querySelector('nav').id=definition.layout.tabs;for(const id of ['style-de','style-zh'])document.getElementById(id).disabled=id!==definition.style;document.documentElement.dataset.theme=theme;
   const data={de:[['Auto','das','car','자동차','Das Auto ist neu.'],['Haus','das','house','집','Das Haus ist neu.'],['Buch','das','book','책','Das Buch ist neu.']],zh:[['车','','car','자동차','我坐车去。','chē'],['书','','book','책','我看书。','shū'],['水','','water','물','我喝水。','shuǐ']],ja:[['車','','car','자동차','車で行きます。','くるま'],['本','','book','책','本を読みます。','ほん'],['水','','water','물','水を飲みます。','みず']],en:[['car','','car','자동차','We go by car.'],['book','','book','책','Read a book.'],['house','','house','집','This house is new.']]};
   const entries=data[language].map(([word,article,en,ko,sentence,pronunciation],i)=>({id:'qa'+i,word,article:article||undefined,partOfSpeech:'noun',pronunciation,level:language==='de'?'A1':language==='zh'?'1':language==='ja'?'N5':'IELTS 1.0–3.5',meaning:locale==='ko'?ko:language==='en'?'A common '+en+' used in everyday life.':en,example:{text:sentence,focus:{text:sentence.slice(sentence.toLowerCase().indexOf(word.toLowerCase()),sentence.toLowerCase().indexOf(word.toLowerCase())+word.length)},translation:locale==='ko'?ko+'를 사용하는 문장입니다.':'A sentence about a '+en+'.'}}));
   let app,cleanup,currentRoute=mode;const refresh=()=>{cleanup?.();cleanup=app.render(currentRoute,host);};const navigate=route=>{currentRoute=route;refresh();};app=createPresentation({language,navigate,refresh,onPreferences(){}});app.setStudy({targetLanguage:language,explanationLanguage:locale,studyVersion:'1.0.0',reviewInvalidations:entries.map(row=>({id:row.id,minimumVersion:'1.0.0'})),entries});app.setPreferences({theme,uiLanguage:locale,hapticEnabled:false,soundEnabled:false});window.learningApp=app;window.learningRoute=navigate;window.learningCleanup=()=>cleanup?.();window.learningEntries=entries;refresh();
  },{language,locale,theme,mode});
  await page.locator('[data-question-word],[data-question-id]').first().waitFor();
  const target=await page.evaluate(()=>document.querySelector('[data-question-word]')?.dataset.questionWord||document.querySelector('[data-question-id]').dataset.questionId.split(':')[0]);
  assert.equal(await page.locator('[data-vocabulary-learning]').count(),0);
  if(mode==='vocabinput'){
   assert.equal(await page.locator('[data-vocabulary-hint]').evaluate(node=>node.open),false);assert.equal(await page.locator('#vocab-listen,[data-quiz-sound-hint]').isVisible(),false);
   const field=page.locator('#vocab-answer');await field.fill('attempt');await page.locator('[data-vocabulary-hint] summary').click();assert.equal(await field.inputValue(),'attempt');assert.equal(await page.locator('#vocab-listen,[data-quiz-sound-hint]').isVisible(),true);
   assert.equal(await page.locator('[data-vocabulary-hint]').count(),1);assert.ok(await page.locator('.vocab-context-hint .cloze-blank').isVisible());
   const answer=await page.evaluate(id=>{const row=window.learningEntries.find(row=>row.id===id);return row.article?row.article+' '+row.word:row.word;},target);await field.fill(theme==='light'?answer:'wrong answer');await page.locator('#vocab-submit').click();
  }else{
   const options=page.locator('[data-vocab-option],[data-option]');const attribute=await options.first().getAttribute('data-vocab-option')!==null?'data-vocab-option':'data-option';await page.locator(theme==='light'?`[${attribute}="${target}"]`:`[${attribute}]:not([${attribute}="${target}"])`).first().click();
  }
  await page.locator('[data-vocabulary-learning]').waitFor();assert.equal(await page.locator('.vocab-learning .example-sentence').count(),1);assert.ok((await page.locator('.vocab-learning-meaning').innerText()).trim());assert.equal(await page.locator('.vocab-learning .example-translation').count(),language==='en'&&locale==='en'?0:1);assert.ok(await page.locator('#vocab-next').isVisible());assert.equal(await page.locator('#vocab-answer').count(),0);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
  if(theme==='dark'){
   await page.evaluate(()=>window.learningRoute('wrong'));await page.locator('#retest-filtered').waitFor();await page.locator('#retest-filtered').click();
   if(mode==='vocabinput'){await page.locator('#vocab-answer').fill('second wrong attempt');await page.locator('#vocab-submit').click();}else await page.locator('[data-vocab-option],[data-option]').first().click();
   await page.locator('[data-vocabulary-learning]').waitFor();assert.equal(await page.locator('.vocab-learning .example-sentence').count(),1,'Saved retest keeps the sense example');
  }
  if(width===390&&locale==='ko')await page.screenshot({path:join(directory,`${language}-${theme}-${mode}.png`),fullPage:true});checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} vocabulary hint/result scenarios across all four languages, EN/KO, phone/tablet, light/dark and correct/incorrect answers.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
