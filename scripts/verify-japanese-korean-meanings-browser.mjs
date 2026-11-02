import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';

const server=await startServer();let browser,page;
const output='/private/tmp/japanese-korean-meanings-browser';
try{
 await mkdir(output,{recursive:true});browser=await chromium.launch({headless:true});page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');let checks=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const display of ['en','ko']){
  await page.setViewportSize({width,height:1000});
  const samples=await page.evaluate(async({theme,display})=>{
   window.meaningCleanup?.();window.meaningApp?.stop();
   const [{assembleStudy},{studyWords},{createPresentation}]=await Promise.all([import('/js/packages/study.js'),import('/js/presentation/study-profiles.js'),import('/js/presentation/multilingual.js')]);
   window.meaningPackages||=await Promise.all(['ja-core','ja-ko'].map(async id=>{const catalog=await fetch('/catalog.json').then(r=>r.json());return fetch(catalog.find(row=>row.id===id).url).then(r=>r.json());}));
   const [core,pair]=window.meaningPackages;if(pair.version!=='4.6.0'||pair.meaningReview.changed!==771)throw new Error('Natural Korean release is not loaded');
   const study=assembleStudy(core,pair),words=studyWords(study),host=document.querySelector('main');host.parentElement.id='shell';host.id='app';document.querySelector('nav').id='main-nav';document.querySelector('#style-de').disabled=false;document.querySelector('#style-zh').disabled=true;document.documentElement.dataset.theme=theme;document.documentElement.lang=display==='ko'?'ko':'en-GB';
   let route='wordlist';const app=createPresentation({language:'ja',navigate(){},refresh(){window.meaningCleanup?.();window.meaningCleanup=app.render(route,host);},onPreferences(){}});app.setPreferences({uiLanguage:display,theme});window.meaningApp=app;
   window.meaningRender=(id,next)=>{window.meaningCleanup?.();const entry=study.entries.find(row=>row.id===id);app.setStudy({...study,entries:[entry]});app.settings.change('studyLevel',entry.level);route=next;window.meaningCleanup=app.render(route,host);};
   return [['明日','내일'],['作','작품'],['女優','여배우'],['幅','너비; 폭'],['声','목소리'],['キーボード','키보드; 글자판'],['祖父','할아버지'],['空欄','빈칸']].map(([spelling,meaning])=>{const word=words.find(row=>row.lemma===spelling&&row.studyMeaning===meaning);if(!word)throw new Error('Missing corrected word '+spelling);return {id:word.id,word:spelling,meaning};});
  },{theme,display});
  for(const sample of samples){
   await page.evaluate(id=>window.meaningRender(id,'wordlist'),sample.id);assert.equal(await page.locator('.wl-meaning').innerText(),sample.meaning);await page.locator(`[data-word="${sample.id}"]`).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.ok((await dialog.innerText()).includes(sample.meaning));assert.equal(await dialog.locator('.study-examples h3').innerText(),display==='ko'?'예문':'Examples');assert.equal(await dialog.locator('.study-example .muted').count(),1);assert.ok((await dialog.locator('.study-example .muted').innerText()).trim());
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));if(sample.word==='明日')await dialog.screenshot({path:`${output}/${width}-${theme}-${display}.png`});await dialog.locator('[data-close]').click();
   await page.evaluate(id=>window.meaningRender(id,'flashcards'),sample.id);if(await page.locator('.flashcard-front').getAttribute('aria-hidden')==='false')await page.locator('[data-flip]').click();const back=page.locator('.flashcard-back[aria-hidden=false]');await back.waitFor();assert.ok((await back.innerText()).includes(sample.meaning));assert.equal(await back.locator('.example-translation').count(),1);checks++;
  }
 }
 await page.evaluate(()=>{window.meaningCleanup?.();window.meaningApp?.stop();});assert.deepEqual(errors,[]);console.log(`Passed ${checks} corrected Japanese Korean Word List/detail/Flashcard displays across phone/tablet, light/dark and English/Korean display languages.`);
}catch(error){await page?.screenshot({path:output+'/failure.png',fullPage:true});throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
