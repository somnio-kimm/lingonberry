import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer(),directory=join(tmpdir(),'lingonberry-english-headwords');let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage(),errors=[];
 await context.addInitScript(()=>{Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-GB',localService:true}],cancel(){},speak(utterance){window.groupSpoken=utterance.text;setTimeout(()=>utterance.onend?.(),0);}},configurable:true});});
 page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir(directory,{recursive:true});let scenarios=0;
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const levelIndex of [1,2]){
  await page.setViewportSize({width,height:1000});
  const fixture=await page.evaluate(async({locale,theme,levelIndex})=>{
   window.groupCleanup?.();document.querySelectorAll('.quiz-feedback-burst').forEach(node=>node.remove());
   const [{createPresentation},{assembleStudy},{studyWords,studyProfiles},{createLexiconStore},{createLexiconQuestions},{groupEnglishHeadwords,readWordSenses}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js'),import('/js/presentation/study-profiles.js'),import('/js/shared/lexicon-store.js'),import('/js/shared/lexicon-questions.js'),import('/js/shared/english-headwords.js')]);
   window.groupStudies||=new Map();if(!window.groupStudies.has(locale)){const catalog=await fetch('/catalog.json').then(r=>r.json()),pair=await fetch(catalog.find(row=>row.id==='en-'+locale).url).then(r=>r.json()),core=await fetch(catalog.find(row=>row.id==='en-core'&&row.version===pair.studyVersion).url).then(r=>r.json());window.groupStudies.set(locale,assembleStudy(core,pair));}
   const original=window.groupStudies.get(locale),fullWords=studyWords(original),flattened=groupEnglishHeadwords(fullWords).flatMap(readWordSenses);if(flattened.length!==fullWords.length||new Set(flattened.map(word=>word.id)).size!==fullWords.length)throw new Error('Grouping lost a dictionary sense');
   const level=studyProfiles.en.levels[levelIndex],appeals=original.entries.filter(row=>row.word==='appeal'),other=original.entries.find(row=>row.level===level&&row.word>'b'&&!row.word.includes(' ')),nounVariants=original.entries.filter(row=>['plural noun','proper noun'].includes(row.partOfSpeech)),study={...original,entries:[...appeals,other,...nounVariants]},words=studyWords(study),current=words.filter(word=>word.lemma==='appeal'&&word.level===level);
   if(current.length<2||!current.some(word=>word.pos==='noun')||!current.some(word=>word.pos==='verb'))throw new Error('Missing real appeal senses');
   if(words.some(word=>['plural noun','proper noun'].includes(word.pos)))throw new Error('Noun categories were not normalised');
   localStorage.removeItem('learn-language.en.lexicon.v1');const store=createLexiconStore(localStorage,studyProfiles.en);store.setWordStatus(current[0].id,'mastered');
   const q=createLexiconQuestions(studyProfiles.en).createVocabularyPool('vocabinput',current,locale).all()[0];store.record(q,'original saved answer',false);const saved=JSON.stringify(store.state.wrongs);
   const host=document.querySelector('main');let route='wordlist',cleanup,app;const refresh=()=>{cleanup?.();cleanup=app.render(route,host);};app=createPresentation({language:'en',navigate:value=>{route=value;refresh();},refresh,onPreferences(){}});app.setStudy(study);app.setPreferences({theme,uiLanguage:locale});app.settings.change('studyLevel',level);document.documentElement.dataset.theme=theme;document.querySelector('#style-de').disabled=false;document.querySelector('#style-zh').disabled=true;
   window.groupRoute=value=>{route=value;refresh();};window.groupCleanup=()=>{cleanup?.();app.stop();};window.groupFixture={saved,all:words.filter(word=>word.lemma==='appeal').map(word=>({id:word.id,level:word.level})),level};refresh();
   return {senses:current.map(word=>({id:word.id,pos:word.pos,meaning:word.studyMeaning,text:word.examples[0].text,translation:word.examples[0].studyTranslation})),total:new Set(words.filter(word=>word.level===level).map(word=>word.lemma)).size};
  },{locale,width,theme,levelIndex});
  await page.locator('#search-input').fill('appeal');const row=page.locator('#wordlist-results [data-word]');assert.equal(await row.count(),1);assert.equal(await row.getAttribute('data-sense-count'),String(fixture.senses.length));assert.ok((await row.locator('.wl-tag.wl-st-learning').count())===1);
  for(const sense of fixture.senses)assert.ok((await row.locator('.wl-meaning').innerText()).includes(sense.meaning));assert.equal(await row.locator('.wl-pos').count(),2);
  await row.locator('.wl-main').click();await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-headword').innerText(),'appeal');assert.equal(await page.locator('.study-example[data-sense-id]').count(),fixture.senses.length);
  for(const [index,sense]of fixture.senses.entries()){
   const block=page.locator(`.study-example[data-sense-id="${sense.id}"]`);assert.equal(await block.locator('.example-sentence').innerText(),sense.text);if(locale==='ko')assert.equal(await block.locator('.muted').innerText(),sense.translation);else assert.equal(await block.locator('.muted').count(),0);
   await block.locator('[data-example]').click();await page.waitForFunction(text=>window.groupSpoken===text,sense.text);
  }
  await page.locator('.detail-sheet').screenshot({path:join(directory,`${locale}-${width}-${theme}-${levelIndex}-details.png`)});await page.locator('[data-close]').click();
  const fold=page.locator('.filter-fold');if(!await fold.evaluate(node=>node.open))await fold.locator('summary').click();assert.equal(await page.locator('[data-tag="plural noun"],[data-tag="proper noun"]').count(),0);await page.locator('[data-tag=noun]').click();assert.equal(await row.count(),1);const nounSenses=fixture.senses.filter(sense=>sense.pos==='noun');assert.equal(await row.getAttribute('data-sense-count'),String(nounSenses.length));await row.locator('.wl-main').click();assert.equal(await page.locator('.study-example[data-sense-id]').count(),nounSenses.length);await page.locator('[data-close]').click();
  await page.locator('[data-tag=all]').click();await row.locator('.wl-main').click();await page.locator('[data-status=mastered]').click();
  const preserved=await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1'));return {history:JSON.stringify(value.wrongs),statuses:value.wordStatus,fixture:window.groupFixture};});assert.equal(preserved.history,preserved.fixture.saved);for(const sense of preserved.fixture.all)assert.equal(preserved.statuses[sense.id]||'new',sense.level===preserved.fixture.level?'mastered':'new');
  await page.locator('[data-f=mastered]').click();assert.equal(await row.count(),1);await page.locator('[data-f=learning]').click();assert.equal(await row.count(),0);await page.locator('[data-f=all]').click();
  await page.locator('main').screenshot({path:join(directory,`${locale}-${width}-${theme}-${levelIndex}-words.png`),fullPage:true});await page.evaluate(()=>window.groupRoute('flashcards'));assert.match(await page.locator('#flashcard-count').innerText(),new RegExp('^'+fixture.total+'\\s'));
  for(let index=0;await page.locator('.flashcard-front .lexicon-word').innerText()!=='appeal';index++){assert.ok(index<fixture.total);await page.locator('[data-next-card]').click();}
  await page.locator('[data-flip]').click();assert.equal(await page.locator('.flashcard-back [data-sense-id]').count(),fixture.senses.length);for(const sense of fixture.senses)assert.equal(await page.locator(`.flashcard-back [data-sense-id="${sense.id}"] .example-sentence`).innerText(),sense.text);if(locale==='en')assert.equal(await page.locator('.flashcard-back .example-translation').count(),0);
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await page.locator('main').screenshot({path:join(directory,`${locale}-${width}-${theme}-${levelIndex}-cards.png`),fullPage:true});scenarios++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${scenarios} real-package grouped-headword scenarios: complete dictionary allocation, same-level meanings/examples, noun/POS/status filters, audio, Flashcards and unchanged per-sense history/other levels; EN/KO, phone/tablet and themes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
