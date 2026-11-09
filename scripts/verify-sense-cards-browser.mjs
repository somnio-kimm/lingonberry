import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';

const server=await startServer();
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 let checks=0;
 for(const locale of ['en','ko'])for(const width of [390,1024]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(async locale=>{
   const {createPresentation}=await import('/js/presentation/multilingual.js');
   localStorage.removeItem('learn-language.en.lexicon.v1');
   const host=document.querySelector('main');
   let route='home';
   const app=createPresentation({language:'en',navigate:next=>{route=next;refresh();},refresh,onPreferences(){}});
   function refresh(){app.render(route,host);}
   app.setPreferences({uiLanguage:locale});
   app.setStudy({targetLanguage:'en',explanationLanguage:locale,entries:[
    {id:'pedestrian-person',word:'pedestrian',partOfSpeech:'noun',level:'IELTS 1.0–3.5',
     meaning:locale==='en'?'A person travelling on foot.':'보행자',
     example:{text:'The pedestrian waited at the crossing.',translation:locale==='en'?'The pedestrian waited at the crossing.':'보행자는 횡단보도에서 기다렸다.'}},
    {id:'pedestrian-unoriginal',word:'pedestrian',partOfSpeech:'adjective',level:'IELTS 8.5–9.0',
     meaning:locale==='en'?'Ordinary and lacking imagination.':'평범한, 진부한',
     example:{text:'The critic found the plot pedestrian.',translation:locale==='en'?'The critic found the plot pedestrian.':'평론가는 줄거리가 진부하다고 생각했다.'}},
   ]});
   window.senseRoute=next=>{route=next;refresh();};
   window.setSenseStudy=value=>{app.setStudy(value);refresh();};
   refresh();
  },locale);
  for(const [level,id,meaning,sentence] of [
   ['IELTS 1.0–3.5','pedestrian-person',locale==='en'?'A person travelling on foot.':'보행자','The pedestrian waited at the crossing.'],
   ['IELTS 8.5–9.0','pedestrian-unoriginal',locale==='en'?'Ordinary and lacking imagination.':'평범한, 진부한','The critic found the plot pedestrian.'],
  ]){
   await page.evaluate(()=>window.senseRoute('home'));
   await page.locator(`[data-level="${level}"]`).click();
   await page.locator('[data-route=wordlist]').click();
   await page.locator('#search-input').fill('pedestrian');
   assert.equal(await page.locator('.wl-row').count(),1);
   assert.equal(await page.locator('.wl-row').getAttribute('data-word'),id);
   assert.equal(await page.locator('.wl-meaning').innerText(),meaning);
   await page.evaluate(()=>window.senseRoute('flashcards'));
   assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),id);
   if(!await page.locator('.flashcard').evaluate(node=>node.classList.contains('flipped')))await page.locator('[data-flip]').click();
   assert.equal(await page.locator('.flashcard-back .fc-meaning').innerText(),meaning);
   assert.equal(await page.locator('.fc-examples .example-sentence').innerText(),sentence);
   assert.match(await page.locator('#flashcard-count').innerText(),/^1 /u);
   checks++;
  }
  await page.evaluate(locale=>{
   const meaning=(en,ko)=>locale==='en'?en:ko;
   window.setSenseStudy({targetLanguage:'en',explanationLanguage:locale,entries:[
    {id:'bank-money',word:'bank',partOfSpeech:'noun',level:'IELTS 1.0–3.5',meaning:meaning('A financial institution.','금융 기관')},
    // The intentionally distant fixture level tests the filter boundary, not editorial grading.
    {id:'bank-river',word:'bank',partOfSpeech:'noun',level:'IELTS 8.5–9.0',meaning:meaning('Land beside a river.','강둑')},
    {id:'shore',word:'shore',partOfSpeech:'noun',level:'IELTS 1.0–3.5',meaning:meaning('Land beside a river.','강둑')},
    {id:'chair',word:'chair',partOfSpeech:'noun',level:'IELTS 1.0–3.5',meaning:meaning('A seat for one person.','의자')},
   ]});
   window.senseRoute('home');
  },locale);
  await page.locator('[data-level="IELTS 1.0–3.5"]').click();
  await page.evaluate(()=>{
   const random=Math.random;Math.random=()=>0;
   try{window.senseRoute('vocabmeaning');}finally{Math.random=random;}
  });
  assert.equal(await page.locator('[data-question-word]').getAttribute('data-question-word'),'bank-money');
  assert.deepEqual(new Set(await page.locator('[data-option]').evaluateAll(nodes=>nodes.map(node=>node.dataset.option))),new Set(['bank-money','chair']));
  await page.locator('[data-option="bank-money"]').click();
  assert.equal(await page.locator('.lexicon-question.correct').count(),1);
  checks++;
 }
 assert.deepEqual(errors,[]);
 console.log(`Passed ${checks} sense-specific Word List, Flashcard and Meaning Quiz cases across EN/KO and phone/tablet.`);
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
