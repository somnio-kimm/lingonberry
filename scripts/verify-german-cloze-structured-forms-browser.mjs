import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const kind of ['plural','verb']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  const expected=await page.evaluate(async({locale,theme,kind})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;
   for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!=='de';
   const {createPresentation}=await import('/js/presentation/german.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   const app=createPresentation({navigate:route=>app.render(route,host),refresh(){},onPreferences(){}});
   app.setPreferences({uiLanguage:locale,hapticEnabled:false});app.settings.change('studyLevel','B2');
   const noun=(id,word,plural,meaning,article='das')=>({id,word,article,partOfSpeech:'noun',level:'B2',meaning,grammar:{declension:{dat:['dem '+word,plural?'den '+plural:null]}}});
   const verb=(id,word,form,meaning,person='ich')=>({id,word,partOfSpeech:'verb',level:'B2',meaning,grammar:{forms:{Präsens:{[person]:form}}}});
   const entries=kind==='plural'?[
    noun('luggage','Gepäck',null,locale==='en'?'luggage':'짐'),
    noun('parcel','Paket','Paketen',locale==='en'?'parcel':'소포'),
    noun('room','Zimmer','Zimmern',locale==='en'?'room':'방'),
    noun('letter','Brief','Briefen',locale==='en'?'letter':'편지','der'),
    {...noun('target','Megapixel','Megapixeln',locale==='en'?'megapixel':'메가픽셀'),example:{text:'Die Kamera hat eine Auflösung von zwölf Megapixeln.',translation:locale==='en'?'The camera has a resolution of twelve megapixels.':'카메라의 해상도는 12메가픽셀이다.'}},
   ]:[
    verb('work','arbeiten','arbeitest',locale==='en'?'to work':'일하다','du'),
    verb('learn','lernen','lerne',locale==='en'?'to learn':'배우다'),
    verb('ask','fragen','frage',locale==='en'?'to ask':'묻다'),
    verb('say','sagen','sage',locale==='en'?'to say':'말하다'),
    {...verb('target','gehen','gehe',locale==='en'?'to go':'가다'),example:{text:'Ich gehe heute zu Fuß nach Hause.',translation:locale==='en'?'I am walking home today.':'나는 오늘 집에 걸어간다.'}},
   ];
   app.setStudy({targetLanguage:'de',explanationLanguage:locale,studyVersion:'1.0.0',entries});
   window.structuredApp=app;window.structuredRandom=Math.random;Math.random=()=>.999999;app.render('cloze',host);
   return {sentence:entries.at(-1).example.text,options:kind==='plural'?['Megapixeln','Paketen','Zimmern','Briefen']:['gehe','lerne','frage','sage'],answer:kind==='plural'?'Megapixeln':'gehe'};
  },{locale,theme,kind});
  await page.locator('.cloze-option-word').first().waitFor();
  assert.deepEqual((await page.locator('.cloze-option-word').allTextContents()).sort(),expected.options.slice().sort());
  await page.locator('.opt-btn').filter({has:page.locator('.cloze-option-word').filter({hasText:new RegExp('^'+expected.answer+'$')})}).click();
  await page.locator('#quiz-next').waitFor();
  assert.equal(await page.locator('.sentence-quiz-text').innerText(),expected.sentence);
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>{Math.random=window.structuredRandom;window.structuredApp.stop();});checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} German structured-Cloze browser checks: EN/KO, phone/tablet, light/dark, actual plural/person forms and immediate correct-answer feedback.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
