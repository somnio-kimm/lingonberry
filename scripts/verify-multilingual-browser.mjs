import {studyProfiles,studyWords} from '../web/js/presentation/study-profiles.js';
import {allowsExplanation} from '../web/js/shared/language-pairs.js';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer(),origin=`http://127.0.0.1:${server.address().port}`;
let browser;const checks=[];
const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const catalog=await read('web/catalog.json');
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,name){await page.locator(`[data-tab=${name}]`).click();await ready(page);}
async function choose(page,language,explanation){await tab(page,'settings');await page.selectOption('#target',language);await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');}
async function route(page,name){await tab(page,'home');await page.locator(`[data-route=${name}]`).click();await ready(page);}
async function packages(page,language){await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();}
async function download(page,id){await page.locator(`[data-available="${id}"] .download-package`).click();await page.locator(`[data-package="${id}"] .remove-package`).waitFor();}
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],downloads=[];
 await context.addInitScript(()=>{
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}},configurable:true});
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>['ja-JP','ko-KR','en-GB','es-ES','fr-FR'].map(lang=>({lang,localService:true})),cancel(){},speak(utterance){window.testSpokenText=utterance.text;window.testSpokenLanguage=utterance.lang;if(window.deferTestSpeech)window.finishTestSpeech=()=>utterance.onend?.();else setTimeout(()=>utterance.onend?.(),0);}},configurable:true});
 });
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/language-packages/')&&!request.url().endsWith('/catalog.json'))downloads.push(new URL(request.url()).pathname);});
 await page.goto(origin);await ready(page);
 for(const language of ['ja','ko','en','es','fr']){
  const core=await read(catalog.find(row=>row.id===language+'-core').url.slice(1)),pairs=Object.fromEntries(await Promise.all(['en','ko'].filter(locale=>allowsExplanation(language,locale)).map(async locale=>[locale,await read(catalog.find(row=>row.id===language+'-'+locale).url.slice(1))])));
  await packages(page,language);const before=downloads.length;for(const locale of Object.keys(pairs))await download(page,language+'-'+locale);assert.equal(downloads.length-before,1+Object.keys(pairs).length,'core downloaded once');
  for(const explanation of Object.keys(pairs)){
   await choose(page,language,explanation);await tab(page,'home');assert.deepEqual(await page.locator('.menu-grid [data-route]').evaluateAll(nodes=>nodes.map(node=>node.dataset.route)),['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble','listening'],language+' shared menu order');await route(page,'wordlist');if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();await page.selectOption('[data-level-filter]','all');await page.locator('#search-input').fill(core.entries[0].word);
   const row=page.locator(`[data-word="${core.entries[0].id}"]`);await row.waitFor();assert.equal(await row.locator('.wl-meaning').innerText(),pairs[explanation].entries[0].meaning);
   await row.click();await page.locator('[role=dialog]').waitFor();if(language==='ja'&&explanation==='en'){await mkdir('/private/tmp/learn-language-multilingual-shots',{recursive:true});await page.screenshot({path:'/private/tmp/learn-language-multilingual-shots/japanese-detail-light.png'});}assert.ok((await page.locator('[role=dialog]').innerText()).includes(core.entries[0].example.text));
   await page.locator('[data-example="0"]').click();await page.waitForFunction(text=>window.testSpokenText===text,core.entries[0].example.text);await page.keyboard.press('Escape');assert.equal(await page.locator('[role=dialog]').count(),0);await page.locator('#search-input').fill('');
  }
  const authored=core.entries.find(row=>row.example?.provenance?.kind==='app-authored');
  if(authored){
   await route(page,'wordlist');if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();await page.selectOption('[data-level-filter]','all');await page.locator('#search-input').fill(authored.word);await page.locator(`[data-word="${authored.id}"]`).click();assert.ok((await page.locator('[role=dialog]').innerText()).includes(authored.example.text));await page.locator('[data-example="0"]').click();await page.waitForFunction(text=>window.testSpokenText===text,authored.example.text);await page.keyboard.press('Escape');await page.locator('#search-input').fill('');
  }
  const pending=core.entries.find(row=>!row.example&&row.referenceExamples?.length);
  if(pending){
   await route(page,'wordlist');if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();await page.selectOption('[data-level-filter]','all');await page.locator('#search-input').fill(pending.word);const firstResult=await page.locator('[data-word]').first().getAttribute('data-word');assert.equal(core.entries.find(row=>row.id===firstResult)?.word,pending.word);await page.locator(`[data-word="${pending.id}"]`).click();
   assert.ok((await page.locator('[role=dialog]').innerText()).includes('Bilingual Example Under Review'));assert.ok((await page.locator('[role=dialog]').innerText()).includes('Translation Under Review'));await page.locator('[data-reference="0"]').click();await page.waitForFunction(text=>window.testSpokenText===text,pending.referenceExamples[0].text);await page.keyboard.press('Escape');await page.locator('#search-input').fill('');
  }
  if(language==='en'){
   await route(page,'wordlist');if(!await page.locator('[data-level-filter]').isVisible())await page.locator('summary').click();await page.selectOption('[data-level-filter]','all');
   assert.equal(await page.locator('[data-focus]').count(),0);assert.deepEqual(await page.locator('[data-level-filter] option').evaluateAll(nodes=>nodes.map(node=>node.value)),['all','IELTS 1.0–3.5','IELTS 4.0–6.5','IELTS 7.0–8.0','IELTS 8.5–9.0']);await page.selectOption('[data-topic]','research');assert.equal(await page.locator('.filter-fold').evaluate(node=>node.open),true);await page.locator('.wl-row').first().waitFor();
   const visible=await page.locator('[data-word]').evaluateAll(nodes=>nodes.map(node=>node.dataset.word));
   assert.ok(visible.every(id=>{const tags=core.entries.find(row=>row.id===id).tags;return tags.includes('topic:research');}));
   await page.locator('[data-word]').first().click();await page.locator('.lexicon-topic-tags').waitFor();await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await mkdir('/private/tmp/learn-language-broad-shots',{recursive:true});await page.screenshot({path:'/private/tmp/learn-language-broad-shots/english-topic-detail.png'});await page.keyboard.press('Escape');
   await page.selectOption('[data-topic]','all');
  }
  await route(page,'flashcards');await page.locator('[data-flip]').click();await page.locator('[data-next-card]').click();await page.locator('[data-shuffle]').click();
  await route(page,'vocabinput');const questionId=await page.locator('[data-question-word]').getAttribute('data-question-word'),entry=core.entries.find(row=>row.id===questionId);
  await page.locator('#vocab-answer').fill('incorrect answer');await page.locator('#vocab-submit').click();assert.equal(await page.locator('.vocab-answer-cell.wrong').count(),1);
  await tab(page,'wrong');assert.equal(await page.locator('.wrong-card').count(),1);await page.locator('.wrong-card').click();await page.locator('[data-close]').click();await page.locator('[data-retest]').click();
  const expected=entry.article?entry.article+(/[’']$/u.test(entry.article)?'':' ')+entry.word:entry.word;
  await page.locator('#vocab-answer').fill(expected);await page.locator('#vocab-submit').click();assert.equal(await page.locator('.vocab-answer-cell.correct').count(),1);await page.locator('[data-next]').click();await page.locator('[data-finish]').click();assert.ok((await page.locator('.lexicon-review-footer').innerText()).includes('0'));
  await route(page,'vocabmeaning');assert.ok(await page.locator('[data-option]').count()>=2);await page.locator('[data-option]').first().click();await page.locator('#vocab-submit').click();await page.locator('[data-next]').waitFor();
  await route(page,'listening');
  if(language==='ja'){
   await page.evaluate(()=>{window.deferTestSpeech=true;});await page.locator('#listening-answer').fill('answer');await page.locator('#listening-play').click();await page.locator('[data-skip]').click();await page.evaluate(()=>{window.finishTestSpeech();window.deferTestSpeech=false;});await page.locator('#listening-answer').fill('answer');assert.equal(await page.locator('#listening-submit').isEnabled(),false,'completion of skipped audio cannot unlock the next question');
  }
  for(const kind of ['word','sentence']){
   await page.locator(`[data-kind=${kind}]`).click();await page.locator('#listening-answer').fill('answer');assert.equal(await page.locator('#listening-submit').isEnabled(),false);
   await page.locator('#listening-play').click();await page.waitForFunction(()=>!document.querySelector('#listening-submit').disabled);await page.locator('#listening-answer').fill(await page.evaluate(()=>window.testSpokenText));await page.locator('#listening-answer').evaluate(node=>{node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));});assert.equal(await page.locator('#listening-submit').isEnabled(),false,'composition must finish before submission');await page.locator('#listening-answer').evaluate(node=>node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await page.locator('#listening-submit').click();assert.equal(await page.locator('.vocab-answer-cell.correct').count(),1);
  }
  for(const mode of ['cloze','scramble']){
   await route(page,mode);await page.locator('[data-sentence-submit]').waitFor();
   if(mode==='cloze'){
    assert.equal(await page.locator('[data-cloze-option] small').count(),0);assert.notEqual(await page.locator('[data-cloze-option]').first().evaluate(node=>getComputedStyle(node).borderRadius),'0px');
    const id=await page.locator('[data-question-word]').getAttribute('data-question-word');const wrong=page.locator(`[data-cloze-option]:not([data-cloze-option="${id}"])`).first();await wrong.click();
   }else{
    const ids=await page.locator('[data-tile]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.tile)).sort((a,b)=>b-a));for(const id of ids)await page.locator(`[data-tile="${id}"]`).click();
   }
   await page.locator('[data-sentence-submit]').click();await page.locator('[data-sentence-next]').waitFor();assert.equal(await page.locator('.lexicon-question.wrong').count(),1);if(mode==='cloze'){assert.equal(await page.locator('.lexicon-blank.correct').count(),1);assert.equal(await page.locator('[data-cloze-option] small').count(),await page.locator('[data-cloze-option]').count());assert.equal(await page.locator('[data-cloze-option]').first().evaluate(node=>getComputedStyle(node).opacity),'1');}
   await tab(page,'wrong');await page.selectOption('[data-mode]',mode);assert.equal(await page.locator('.wrong-card').count(),1);if(mode==='cloze')assert.equal(await page.locator('.lexicon-review-question .lexicon-blank').count(),1);
   await page.locator('[data-retest]').click();
   if(mode==='cloze'){const id=await page.locator('[data-question-word]').getAttribute('data-question-word');await page.locator(`[data-cloze-option="${id}"]`).click();}
   else {const count=await page.locator('[data-tile]').count();for(let id=0;id<count;id++)await page.locator(`[data-tile="${id}"]`).click();}
   await page.locator('[data-sentence-submit]').click();assert.equal(await page.locator('.lexicon-question.correct').count(),1);await page.locator('[data-sentence-next]').click();await page.locator('[data-finish]').click();assert.ok((await page.locator('.lexicon-review-footer').innerText()).includes('0'));
  }
  await tab(page,'wrong');await page.selectOption('[data-mode]','all');
  await tab(page,'home');assert.deepEqual(await page.locator('[data-route]').evaluateAll(nodes=>nodes.map(node=>node.dataset.route)),['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble','listening']);
  await tab(page,'home');for(const level of studyProfiles[language].levels){await page.locator(`[data-level="${level}"]`).click();await page.locator('[data-route=wordlist]').click();await page.locator('.wl-row').first().waitFor();if(language==='en'){const expected=new Set(studyWords(core).filter(word=>word.level===level).map(word=>word.id));const visible=await page.locator('[data-word]').evaluateAll(nodes=>nodes.map(node=>node.dataset.word));assert.ok(visible.every(id=>expected.has(id)),level);assert.ok((await page.locator('.wl-hsk').allTextContents()).every(text=>text===level));}await tab(page,'home');}
  if(language==='en'){
   for(const [locale,label] of [['ko','학습 레벨'],['en','Study Level']]){
    await tab(page,'settings');await page.selectOption('#display-language',locale);await tab(page,'home');
    assert.equal(await page.locator('.study-level-card h2').innerText(),'IELTS · '+label);
    assert.ok(await page.locator('.english-level-options button').evaluateAll(nodes=>nodes.every(node=>node.scrollWidth<=node.clientWidth)), 'range labels fit phone chips');
    for(const mode of ['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble','listening']){
     await route(page,mode);assert.equal(await page.locator('[data-focus]').count(),0);
     assert.deepEqual(await page.locator('[data-level-filter] option').evaluateAll(nodes=>nodes.map(node=>node.value)),['all','IELTS 1.0–3.5','IELTS 4.0–6.5','IELTS 7.0–8.0','IELTS 8.5–9.0']);
    }
    await tab(page,'wrong');assert.equal(await page.locator('[data-focus]').count(),0);
   }
   const previous=await page.evaluate(()=>{const key='learn-language.en.lexicon.v1',saved=JSON.parse(localStorage.getItem(key));saved.preferences.studyLevel='6.5';localStorage.setItem(key,JSON.stringify(saved));return saved;});
   await page.reload();await ready(page);await tab(page,'home');assert.equal(await page.locator('[data-level="IELTS 4.0–6.5"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-level="IELTS 4.0–6.5"]').click();
   const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')));
   assert.deepEqual(migrated.wrongs,previous.wrongs);assert.deepEqual(migrated.wordStatus,previous.wordStatus);assert.equal(migrated.preferences.studyLevel,'IELTS 4.0–6.5');
  }
  console.log('Verified '+language);checks.push(`${language}: independent ${Object.keys(pairs).join('/').toUpperCase()} explanation downloads, meanings, examples, keyboard inputs, retest, same-POS quiz, dictation, Cloze/Scramble, Review/retest and every target level`);
 }
 await tab(page,'settings');await page.selectOption('#display-language','ko');await page.waitForFunction(()=>document.documentElement.lang==='ko');await route(page,'wordlist');assert.equal(await page.locator('h2').innerText(),'단어 목록');
 await tab(page,'settings');await page.locator('[data-theme-choice=dark]').click();await route(page,'wordlist');
 const shots='/private/tmp/learn-language-multilingual-shots';await mkdir(shots,{recursive:true});await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});await page.screenshot({path:shots+'/french-dark.png',fullPage:true});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await ready(page);
 for(const language of ['ja','ko','en','es','fr']){await choose(page,language,'en');await route(page,'wordlist');await page.locator('.wl-row').first().waitFor();}
 assert.equal(downloads.length,14);checks.push('All five installed languages and their offered explanation sets remain available offline; no repeated package downloads.');
 const saved=await page.evaluate(()=>localStorage.getItem('learn-language.fr.lexicon.v1'));await packages(page,'fr');page.once('dialog',dialog=>dialog.accept());await page.locator('#remove-language').click();await page.locator('#target').waitFor();assert.equal(await page.locator('#target option[value=fr]').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.fr.lexicon.v1')),saved);
 await context.setOffline(false);await packages(page,'fr');await download(page,'fr-en');assert.equal(await page.evaluate(()=>localStorage.getItem('learn-language.fr.lexicon.v1')),saved);assert.deepEqual(errors,[]);
 checks.push('Confirmed language removal hides the installed pair, preserves progress, and allows reinstallation.');
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
