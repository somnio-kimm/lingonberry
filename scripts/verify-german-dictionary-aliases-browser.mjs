import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;
   for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='de';
   const {createPresentation}=await import('/js/presentation/german.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});
   app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','C1');
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'1.0.0',entries:[
    {id:'station',word:'Internationale Raumstation',article:'die',partOfSpeech:'noun',level:'C1',meaning:locale==='en'?'International Space Station':'국제우주정거장',grammar:{related_forms:['ISS']}},
    {id:'know',word:'wissen',partOfSpeech:'verb',level:'C1',meaning:locale==='en'?'to know':'알다'},
    {id:'yoghurt',word:'Joghurt',aliases:['Jogurt'],article:'der',partOfSpeech:'noun',level:'B1',meaning:locale==='en'?'yoghurt':'요구르트'},
   ]});window.aliasApp=app;window.aliasRender=()=>app.render('wordlist',host);window.aliasRender();
  },{locale,theme});
  await page.locator('#search-input').fill('ISS');await page.waitForFunction(()=>document.querySelector('#wordlist-results')?.dataset.query==='ISS');await page.locator('.wl-row[data-id=station]').waitFor();
  assert.equal(await page.locator('.wl-row').count(),1);
  await page.locator('.wl-row[data-id=station] .wl-main').click();
  assert.equal(await page.locator('#study-word-title').innerText(),'die Internationale Raumstation');
  assert.equal(await page.locator('.study-sheet-meaning').innerText(),locale==='en'?'International Space Station':'국제우주정거장');
  await page.locator('.detail-sheet-close').click();
  await page.evaluate(()=>{window.aliasApp.settings.change('studyLevel','B1');window.aliasRender();});
  await page.locator('#search-input').fill('ISS');await page.waitForFunction(()=>document.querySelector('#wordlist-results')?.dataset.query==='ISS');
  assert.equal(await page.locator('.wl-row').count(),0);
  await page.locator('#search-input').fill('Jogurt');await page.locator('.wl-row[data-id=yoghurt]').waitFor();
  assert.equal(await page.locator('.wl-headword').innerText(),'der Joghurt');
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>window.aliasApp.stop());checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German alias-search browser checks: EN/KO, phone/tablet, light/dark, ISS exact priority, canonical word details, selected-level filtering and spelling aliases.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
