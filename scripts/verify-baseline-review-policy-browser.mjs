import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser,checks=0;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const language of ['de','zh'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
  const result=await page.evaluate(async({language,locale,theme})=>{
   localStorage.clear();document.documentElement.dataset.theme=theme;
   for(const code of ['de','zh'])document.getElementById('style-'+code).disabled=code!==language;
   const definitions=language==='de'?[['changed','Bank','bank','은행','die'],['keep','Buch','book','책','das'],['old','Haus','house','집','das']]:[['changed','书','book','책'],['keep','水','water','물'],['old','车','car','차']];
   const entries=definitions.map(([id,word,en,ko,article])=>({id,word,article,partOfSpeech:language==='de'?'noun':'Noun',level:language==='de'?'A1':'1',meaning:locale==='en'?en:ko,syllables:language==='zh'?[{hanzi:word,base:word==='书'?'shu':word==='水'?'shui':'che',tone:word==='水'?3:1}]:undefined,grammar:{gender:article==='die'?'feminine':'neuter'},example:{text:word,translation:locale==='en'?en:ko}}));
   const words=entries.map(e=>({...e,id:e.id,lemma:e.word,hanzi:e.word,cefr:'A1',hskLevel:1,pos:'noun',studyMeaning:e.meaning,studyExplanationLanguage:locale,syllables:e.syllables}));
   const q=word=>({id:word.id+':'+locale,mode:'vocabinput',locale,word,prompt:word.studyMeaning,answer:word.lemma,example:{de:word.lemma}});
   const policy={targetLanguage:language,explanationLanguage:locale,studyVersion:'4.0.0',entries:entries.filter(e=>e.id!=='old'),retiredEntries:[{id:'old',reason:'Synthetic corrected concept'}],reviewInvalidations:[{id:'changed',minimumVersion:'4.0.0'}]};
   let store;
   if(language==='de'){
    const {createStore}=await import('/languages/de/js/core/store.js');store=createStore(localStorage);store.preference('uiLang',locale);store.setReviewContent({studyVersion:'3.0.0'});store.setWordStatus('changed','mastered');store.setWordStatus('duplicate','mastered');store.setWordStatus('old','mastered');policy.retiredEntries.push({id:'duplicate',replacementId:'keep',sameConcept:true});
    for(const word of words)store.recordQuizAnswer('vocabinput',q(word),'wrong',false);
   }else{
    ({Store:store}=await import('/languages/zh/js/services/store.js'));store.setReviewContent({studyVersion:'3.0.0'});store.uiLang=locale;localStorage.setItem('learn-language.zh.srsById',JSON.stringify({changed:{level:5}}));
    for(const word of words)store.addWrong({wordId:word.id,wordHanzi:word.hanzi,hskLevel:1,mode:'vocabinput',question:q(word),userAnswer:'wrong',correctAnswer:word.hanzi});
   }
   const saved=language==='de'?JSON.stringify(store.state.quizAnswers):localStorage.getItem('learn-language.zh.wrong');
   const {createPresentation}=await import('/js/presentation/'+(language==='de'?'german':'chinese')+'.js');
   const host=document.createElement('section');document.querySelector('main').replaceChildren(host);
   let route='wrong',app;const refresh=()=>app.render(route,host);
   app=createPresentation({navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app.setPreferences({uiLanguage:locale});app.setStudy(policy);refresh();
   window.baselinePolicyApp=app;window.openPolicyTyping=()=>{route='vocabinput';refresh();};window.openPolicyWordList=()=>{route='wordlist';refresh();};window.reopenPolicyWordList=()=>{app.stop();app=createPresentation({navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app.setPreferences({uiLanguage:locale});app.setStudy({...policy});route='wordlist';refresh();window.baselinePolicyApp=app;};
   const raw=language==='de'?JSON.stringify(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers):localStorage.getItem('learn-language.zh.wrong');
   const persisted=language==='de'?JSON.parse(localStorage.getItem('learn-language.de.progress.v1')):null;if(persisted){if(persisted.wordStatus.keep!=='mastered'||persisted.wordStatus.duplicate!=='mastered'||persisted.wordStatus.old!=='mastered')throw new Error('Equivalent manual markers were not preserved');}return {historyUntouched:saved===raw,keep:entries.find(e=>e.id==='keep').word};
  },{language,locale,theme});
  const cards=page.locator(language==='de'?'.wrong-entry':'.wrong-item');await cards.first().waitFor();assert.equal(await cards.count(),1);assert.ok((await page.locator('.wrong-main-word').innerText()).trim().endsWith(result.keep));assert.equal(result.historyUntouched,true);
  await page.evaluate(()=>window.openPolicyTyping());await page.locator('#vocab-answer').fill('definitely wrong');await page.locator('#vocab-submit').click();
  const versions=await page.evaluate(language=>language==='de'?Object.values(JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).quizAnswers.vocabinput).filter(r=>r.attempts.at(-1).input==='definitely wrong').map(r=>r.questionSnapshot.contentVersion):JSON.parse(localStorage.getItem('learn-language.zh.wrong')).filter(r=>r.userAnswer==='definitely wrong').map(r=>r.question.contentVersion),language);
  assert.deepEqual(versions,['4.0.0']);if(language==='de'){await page.evaluate(()=>window.openPolicyWordList());await page.locator('.wl-row[data-id=keep] .wl-main').click();assert.equal(await page.locator('[data-word-status=mastered]').getAttribute('aria-pressed'),'true');await page.locator('[data-word-status=new]').click();await page.locator('.detail-sheet-close').click();await page.evaluate(()=>window.reopenPolicyWordList());await page.locator('.wl-row[data-id=keep] .wl-main').click();assert.equal(await page.locator('[data-word-status=new]').getAttribute('aria-pressed'),'true');await page.locator('.detail-sheet-close').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.de.progress.v1')).wordStatus.duplicate),'mastered');}checks++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} baseline Review policy and real typed-answer checks: German/Chinese, EN/KO, phone/tablet, light/dark; stored history preserved, explicit German equivalent manual markers survive content installation and later learner resets.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
