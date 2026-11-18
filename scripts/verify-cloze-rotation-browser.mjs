import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');let checks=0;
 for(const language of ['en','de','zh','ja'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.evaluate(async({language,locale,theme})=>{
   window.rotationCleanup?.();window.rotationApp?.stop();localStorage.clear();const [{assembleStudy},{studyProfiles},{presentationDefinitions}]=await Promise.all([import('/js/packages/study.js'),import('/js/presentation/study-profiles.js'),import('/js/presentation/index.js')]);window.rotationStudies||=new Map();const key=language+'-'+locale;
   if(!window.rotationStudies.has(key)){const cat=await fetch('/catalog.json').then(r=>r.json()),pair=await fetch(cat.find(row=>row.id===key).url).then(r=>r.json()),core=await fetch(cat.find(row=>row.id===language+'-core'&&row.version===pair.studyVersion).url).then(r=>r.json());window.rotationStudies.set(key,assembleStudy(core,pair));}
   const definition=presentationDefinitions[language],{createPresentation}=await definition.load(),host=document.querySelector('main');host.parentElement.id=definition.layout.root;host.id=definition.layout.main;document.querySelector('nav').id=definition.layout.tabs;document.getElementById('style-de').disabled=definition.style!=='style-de';document.getElementById('style-zh').disabled=definition.style!=='style-zh';document.documentElement.dataset.theme=theme;let cleanup,app;const refresh=()=>{cleanup?.();cleanup=app.render('cloze',host);};app=createPresentation({language,navigate(){},refresh,onPreferences(){}});app.setStudy(window.rotationStudies.get(key));app.setPreferences({theme,uiLanguage:locale,hapticEnabled:false,soundEnabled:false});if(language!=='zh')app.settings.change('studyLevel',language==='en'?studyProfiles.en.levels[0]:language==='de'?'A1':'N5');window.rotationApp=app;window.rotationCleanup=()=>cleanup?.();refresh();
  },{language,locale,theme});
  for(const mode of language==='en'?['choice','input']:['choice']){
   if(language==='en')await page.locator(`[data-answer-mode=${mode}]`).click();await page.locator('.sentence-quiz-text').waitFor();const seen=new Set();
   for(let i=0;i<20;i++){const key=await page.locator('.sentence-question').evaluate(node=>JSON.stringify([node.dataset.questionWord,node.querySelector('.sentence-quiz-text').textContent,node.querySelector('.sentence-translation')?.textContent]));assert.ok(!seen.has(key),`${language}/${locale}/${mode} repeated within first20: ${key}`);seen.add(key);await page.locator('[data-sentence-skip],#quiz-skip,#skip-btn').click();}
   checks++;
  }
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} real-package Cloze rotations,20 unique successive prompts each, across all four languages, EN/KO, widths/themes and both English answer modes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
