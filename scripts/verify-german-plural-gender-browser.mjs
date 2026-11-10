import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;document.getElementById('style-de').disabled=false;
   const {createPresentation}=await import('/js/presentation/german.js');const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let app;app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});app.setPreferences({uiLanguage:locale});
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'4.0.0',entries:[{id:'plural-fixture',word:'Ferien',article:'die',partOfSpeech:'noun',level:'A1',meaning:locale==='en'?'holidays':'방학; 휴가',grammar:{gender:null,genders:[],number_restriction:'plural'}}]});
   app.render('wordlist',host);window.pluralApp=app;window.pluralHost=host;
  },{locale,theme});
  await page.locator('.wl-headword .noun-article.plural').waitFor();assert.equal(await page.locator('.wl-headword .noun-article.feminine').count(),0);
  const palette=await page.locator('.wl-headword .noun-article').evaluate(node=>{const span=document.createElement('span');span.className='noun-article feminine';span.textContent='die';document.body.append(span);const same=getComputedStyle(node).color===getComputedStyle(span).color;span.remove();return same;});assert.equal(palette,true,'Requested orange die palette is preserved');
  await page.locator('.wl-main').click();await page.locator('.study-headword .noun-article.plural').waitFor();await page.locator('.detail-sheet-close').click();
  await page.evaluate(()=>window.pluralApp.render('vocabinput',window.pluralHost));await page.locator('#vocab-answer').fill('wrong');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();
  const saved=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.vocabinput)[0].questionSnapshot.word);assert.equal(saved.gender,null);assert.equal(saved.number_restriction,'plural');
  await page.evaluate(()=>window.pluralApp.render('wrong',window.pluralHost));await page.locator('.wrong-main-word .noun-article.plural').waitFor();assert.equal(await page.locator('.wrong-main-word .noun-article.feminine').count(),0);checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German plural-gender checks: EN/KO, phone/tablet, light/dark, Word List/details/saved-word/Review classification; requested article palette preserved.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
