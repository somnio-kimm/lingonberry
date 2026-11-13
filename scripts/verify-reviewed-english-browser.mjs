import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';

// Isolated browser storage and request routes exercise staged bytes only. This
// script neither publishes packages nor changes a real browser/app installation.
const published=process.argv.includes('--published');
const stage=resolve(fileURLToPath(new URL(published?'../':'../local-data/coverage/reviewed-english-release/',import.meta.url)));
const reportPath=published?'language-packages/sources/english-reviewed/7.0.0/report.json':'release-report.json';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
let report,catalog,catalogBytes;
try{
 [report,catalogBytes]=await Promise.all([json(resolve(stage,reportPath)),readFile(resolve(stage,'language-packages/catalog.json'))]);
 catalog=JSON.parse(catalogBytes);
}catch(error){
 if(error.code==='ENOENT')throw new Error('Reviewed English stage is not ready. Wait for the approved build-reviewed-english.mjs --write stage before running this browser check. No browser was opened.');
 throw error;
}
assert.equal(report.complete,true,'The staged release report must be complete');
assert.deepEqual(report.errors,[],'Staged content errors block browser verification');
assert.match(report.reviewSnapshotSha256,/^[a-f0-9]{64}$/u);
const descriptors=['en-core','en-en','en-ko'].map(id=>{
 const descriptor=catalog.find(row=>row.id===id&&row.version===report.version);
 assert.ok(descriptor,'Missing staged descriptor: '+id);return descriptor;
});
const payloads=new Map();
for(const descriptor of descriptors){
 assert.ok(descriptor.url.startsWith('/language-packages/'),'Staged package URL must be local');
 const path=resolve(stage,descriptor.url.slice(1));assert.ok(path.startsWith(stage+sep));
 let bytes;
 try{bytes=await readFile(path);}catch(error){
  if(error.code==='ENOENT')throw new Error('Reviewed English stage is incomplete: '+descriptor.url+'. Wait for the finished --write build.');
  throw error;
 }
 assert.equal(bytes.length,descriptor.bytes,descriptor.id+' staged byte length');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),descriptor.sha256,descriptor.id+' staged SHA-256');
 payloads.set(descriptor.url,{bytes,data:JSON.parse(bytes),descriptor});
}
const core=payloads.get(descriptors[0].url).data;
const pairs=Object.fromEntries(descriptors.slice(1).map(descriptor=>[descriptor.explanationLanguage,payloads.get(descriptor.url).data]));
assert.equal(core.contentReview?.effectiveReviewSha256,report.reviewSnapshotSha256);
assert.equal(core.contentReview?.sourceAndSenseReviewComplete,true);
assert.equal(core.entries.length,report.entries);
const byId=new Map(core.entries.map(row=>[row.id,row]));
for(const locale of ['en','ko']){
 validateExplanation(core,pairs[locale]);
 assert.equal(pairs[locale].entries.length,report[locale==='en'?'englishEntries':'koreanEntries']);
 assert.deepEqual(new Set(pairs[locale].entries.map(row=>row.id)),new Set(byId.keys()));
}
assert.equal(core.practiceData?.countability,undefined,'Removed English countability data must stay absent');
for(const family of core.families||[])assert.ok(family.members.length&&family.members.every(member=>byId.has(member.entryId)),'Root family contains an inactive word');
for(const family of core.practiceData?.rootFamilies||[])assert.ok(family.members.length>=2&&family.members.every(member=>byId.has(member.entryId)),'Historical root group is empty or inactive');
const activeWords=new Set(core.entries.flatMap(row=>[row.word,...(row.aliases||[])]).map(word=>word.normalize('NFKC').trim().toLowerCase()));
for(const row of core.morphemes||[]){
 assert.ok(row.examples.length,'Root without any active word-list words: '+row.id);
 assert.ok(row.examples.every(word=>activeWords.has(word.normalize('NFKC').trim().toLowerCase())),'Reference-only word in root '+row.id);
}
const levels=['IELTS 1.0–3.5','IELTS 4.0–6.5','IELTS 7.0–8.0','IELTS 8.5–9.0'];
const meanings=new Map(pairs.en.entries.map(row=>[row.id,row.meaning]));
const samples=[];
for(const word of ['bank','run','charge']){
 const senses=core.entries.filter(row=>row.word===word).sort((a,b)=>levels.indexOf(a.level)-levels.indexOf(b.level));
 assert.ok(senses.length>=2,'Missing separately reviewed senses: '+word);
 const first=senses[0],second=senses.findLast(row=>row.level!==first.level&&meanings.get(row.id)!==meanings.get(first.id))||
  senses.find(row=>meanings.get(row.id)!==meanings.get(first.id));
 assert.ok(second,'Bundled or duplicate meanings: '+word);samples.push(first,second);
}
for(const level of levels)if(!samples.some(row=>row.level===level)){
 const sample=core.entries.find(row=>row.level===level&&row.example?.text&&row.word.length<20);
 assert.ok(sample,'No reviewed sample in '+level);samples.push(sample);
}
assert.equal(new Set(samples.map(row=>row.id)).size,samples.length);
const selected=samples.map(row=>({id:row.id,word:row.word,level:row.level,partOfSpeech:row.partOfSpeech,
 text:row.example.text,meanings:Object.fromEntries(['en','ko'].map(locale=>[locale,pairs[locale].entries.find(item=>item.id===row.id).meaning])),
 translations:Object.fromEntries(['en','ko'].map(locale=>[locale,pairs[locale].entries.find(item=>item.id===row.id).exampleTranslation])),
 peers:core.entries.filter(item=>item.word===row.word).map(item=>({id:item.id,level:item.level}))}));
const structuredGaps=(core.exercises||[]).filter(row=>row.gapFill);
assert.equal(structuredGaps.length,6,'The reviewed release must contain all six structured expression gaps');
assert.equal(report.practice.structuredGaps,structuredGaps.length);
for(const gap of structuredGaps){
 const reconstructed=gap.gapFill.parts.map((part,i)=>part+(gap.gapFill.answers[i]||'')).join('');
 assert.equal(reconstructed,byId.get(gap.entryId)?.example.text,'Reviewed gaps must preserve the complete original sentence');
}

const server=await startServer(),origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const checks=[],errors=[],downloads=[],unexpected=[];
let offline=false;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready',null,{timeout:60000});
async function tab(page,value){await page.locator(`[data-tab=${value}]`).click();await ready(page);}
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:390,height:900},colorScheme:'light'});
 await context.route('**/catalog.json',route=>offline?route.abort('internetdisconnected'):route.fulfill({body:catalogBytes,contentType:'application/json'}));
 await context.route('**/language-packages/en-*.json',async route=>{
  const path=new URL(route.request().url()).pathname,payload=payloads.get(path);
  if(!payload){unexpected.push(path);await route.abort();return;}
  downloads.push(path);
  if(offline){await route.abort('internetdisconnected');return;}
  await route.fulfill({body:payload.bytes,contentType:'application/json'});
 });
 const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await ready(page);
 await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator('[data-language=en]').click();
 for(const locale of ['en','ko']){
  await page.locator(`[data-available=en-${locale}] .download-package`).click();
  await page.locator(`[data-package=en-${locale}] .remove-package`).waitFor({timeout:120000});
 }
 assert.deepEqual(downloads.slice().sort(),descriptors.map(row=>row.url).sort(),'Each pair and the shared core should be downloaded exactly once');
 const installed=await page.evaluate(async expected=>{
  const {createPackageStorage}=await import('/js/packages/storage.js'),storage=createPackageStorage();
  const result=[];
  for(const descriptor of expected){
   const pack=await storage.get(descriptor.id,descriptor.version);
   if(!pack||pack.entries.length===0||pack.download?.bytes!==descriptor.bytes)throw new Error('Installed package metadata differs from staged descriptor '+descriptor.id);
   const {download,...content}=pack;
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(content)));
   const contentSha256=[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
   if(contentSha256!==descriptor.contentSha256)throw new Error('Installed content differs from the verified staged payload '+descriptor.id);
   result.push({id:pack.id,version:pack.version,entries:pack.entries.length,sourceBytesSha256:descriptor.sha256,contentSha256});
  }
  return result;
 },descriptors.map(descriptor=>({...descriptor,contentSha256:createHash('sha256').update(JSON.stringify(payloads.get(descriptor.url).data)).digest('hex')})));
 checks.push({case:'real-download-and-install',installed});

 for(const locale of ['en','ko']){
  await tab(page,'settings');await page.selectOption('#target','en');await page.selectOption('#explanation',locale);
  await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  const inventory=await page.evaluate(async({locale,sha,expectedCount})=>{
   const [{createPackageStorage},{assembleStudy},{studyWords},{selectWordExample},{createMorphemeModel}]=await Promise.all([
    import('/js/packages/storage.js'),import('/js/packages/study.js'),import('/js/presentation/study-profiles.js'),
    import('/js/shared/word-example.js'),import('/js/shared/morpheme-model.js')]);
   const storage=createPackageStorage(),records=await storage.list();
   const pd=records.find(row=>row.id==='en-'+locale),pair=await storage.get(pd.id,pd.version),core=await storage.get('en-core',pair.studyVersion);
   if(core.contentReview.effectiveReviewSha256!==sha)throw new Error('Installed review snapshot changed');
   const study=assembleStudy(core,pair),words=studyWords(study),translations=new Map(pair.entries.map(row=>[row.id,row]));
   if(words.length!==expectedCount||new Set(words.map(row=>row.id)).size!==expectedCount)throw new Error('Actual studyWords lost sense IDs');
   for(const word of words){
    const original=translations.get(word.id),example=selectWordExample(word,'en');
    if(word.studyMeaning!==original.meaning||!word.level||!example?.text||example.text!==word.examples[0]?.text||
     (locale==='ko'?example.studyTranslation!==original.exampleTranslation:example.studyTranslation!==undefined))throw new Error('Actual study word/example mismatch '+word.id);
   }
   const model=createMorphemeModel(study.morphemes||[],words);
   if(model.total!==(study.morphemes||[]).length)throw new Error('Root inventory contains empty related-word groups');
   window.reviewedStudies||=new Map();window.reviewedStudies.set(locale,{study,words,model});
   return {locale,words:words.length,rootGroups:model.total,reviewSnapshotSha256:sha};
  },{locale,sha:report.reviewSnapshotSha256,expectedCount:core.entries.length});
  checks.push({case:'installed-studyWords-and-examples',...inventory});
  for(const width of [390,1024])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:900});
   await page.evaluate(({locale,theme})=>{
    document.documentElement.dataset.theme=theme;document.documentElement.lang=locale==='ko'?'ko':'en-GB';
   },{locale,theme});
   for(const sample of selected){
    await page.evaluate(async({locale,theme,sample})=>{
     window.reviewedCleanup?.();window.reviewedApp?.stop();
     const {createPresentation}=await import('/js/presentation/multilingual.js');
     const state=JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1')||'null')||
      {version:1,wordStatus:{},wrongs:{},preferences:{}};
     state.wordStatus={[sample.id]:'learning'};state.preferences.studyLevel=sample.level;
     localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify(state));
     const host=document.querySelector('main');let current='wordlist';
     const app=createPresentation({language:'en',navigate:next=>{current=next;refresh();},refresh,onPreferences(){}});
     function refresh(){window.reviewedCleanup?.();window.reviewedCleanup=app.render(current,host);}
     app.setStudy(window.reviewedStudies.get(locale).study);app.setPreferences({uiLanguage:locale,theme});
     app.settings.change('studyLevel',sample.level);window.reviewedApp=app;
     window.reviewedRoute=next=>{current=next;refresh();};refresh();
    },{locale,theme,sample});
    await page.locator('#search-input').fill(sample.word);
    const row=page.locator(`[data-word="${sample.id}"]`);await row.waitFor();
    assert.equal(await row.locator('.wl-meaning').innerText(),sample.meanings[locale]);
    assert.equal(await row.locator('.wl-hsk').innerText(),sample.level);
    for(const peer of sample.peers.filter(row=>row.level!==sample.level))assert.equal(await page.locator(`[data-word="${peer.id}"]`).count(),0,'Search escaped the selected level');
    assert.ok((await page.locator('.wl-hsk').allTextContents()).every(level=>level===sample.level));
    await row.locator('.wl-main').click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    assert.equal(await dialog.locator('.study-sheet-meaning').innerText(),sample.meanings[locale]);
    assert.equal(await dialog.locator('.example-sentence').innerText(),sample.text);
    assert.equal(await dialog.locator('.study-example .muted').count(),locale==='ko'?1:0);
    if(locale==='ko')assert.equal(await dialog.locator('.study-example .muted').innerText(),sample.translations.ko);
    assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));
    await dialog.locator('[data-close]').click();

    await page.evaluate(()=>window.reviewedRoute('flashcards'));
    await page.locator('.study-filter-panel summary').click();
    await page.locator('[data-f=learning]').click();
    assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),sample.id);
    assert.match(await page.locator('#flashcard-count').innerText(),/^1 /u);
    if(await page.locator('.flashcard-front').getAttribute('aria-hidden')==='false')await page.locator('[data-flip]').click();
    assert.equal(await page.locator('.flashcard-back .fc-meaning').innerText(),sample.meanings[locale]);
    assert.equal(await page.locator('.flashcard-back .wl-hsk').innerText(),sample.level);
    assert.equal(await page.locator('.flashcard-back .example-sentence').innerText(),sample.text);
    assert.equal(await page.locator('.flashcard-back .example-translation').count(),locale==='ko'?1:0);
    if(locale==='ko')assert.equal(await page.locator('.flashcard-back .example-translation').innerText(),sample.translations.ko);

    await page.evaluate(({locale,sample})=>{
     const words=window.reviewedStudies.get(locale).words.slice().sort((a,b)=>a.lemma.localeCompare(b.lemma,'en')).filter(row=>row.level===sample.level);
     const index=words.findIndex(row=>row.id===sample.id),random=Math.random;
     if(index<0)throw new Error('Quiz sample missing from its individual level');
     Math.random=()=>(index+.25)/words.length;
     try{window.reviewedRoute('vocabmeaning');}finally{Math.random=random;}
    },{locale,sample});
    assert.equal(await page.locator('[data-question-word]').getAttribute('data-question-word'),sample.id);
    assert.equal(await page.locator(`[data-option="${sample.id}"]`).innerText(),sample.meanings[locale]);
    const quiz=await page.evaluate(async({locale,sample})=>{
     const {vocabularyGlossKey}=await import('/js/shared/vocabulary.js');
     const words=window.reviewedStudies.get(locale).words,byId=new Map(words.map(row=>[row.id,row]));
     const keys=text=>text.split(/[;；]/u).map(vocabularyGlossKey);
     const known=new Set(words.filter(row=>row.lemma===sample.word||row.aliases.includes(sample.word)).flatMap(row=>keys(row.studyMeaning)));
     const options=[...document.querySelectorAll('[data-option]')].map(node=>({id:node.dataset.option,text:node.textContent}));
     for(const option of options){
      const word=byId.get(option.id);
      if(!word||word.level!==sample.level||option.text!==word.studyMeaning)throw new Error('Meaning Quiz option escaped its active level or exact pair meaning');
      if(option.id!==sample.id&&keys(option.text).some(key=>known.has(key)))throw new Error('Another installed meaning was used as a wrong answer');
     }
     return {options:options.length,knownMeaningKeys:known.size};
    },{locale,sample});
    assert.ok(quiz.options>=2);await page.locator(`[data-option="${sample.id}"]`).click();
    assert.equal(await page.locator('.lexicon-question.correct').count(),1);
    checks.push({case:'sense-wordlist-flashcard-meaning-quiz',locale,width,theme,id:sample.id,level:sample.level,...quiz});
   }
   await page.evaluate(()=>window.reviewedRoute('roots'));
   if(core.morphemes?.length){
    assert.equal(Number(await page.locator('[data-root-count]').getAttribute('data-total')),core.morphemes.length);
    assert.ok(await page.locator('[data-morpheme]').count());
    assert.ok(await page.locator('[data-morpheme]').evaluateAll(nodes=>nodes.every(node=>node.querySelector('[data-root-entry]'))));
   }
   const rendered=await page.locator('[data-root-entry]').evaluateAll(nodes=>nodes.map(node=>node.dataset.rootEntry));
   assert.ok(rendered.length&&rendered.every(id=>byId.has(id)),'Root UI shows an inactive or reference-only entry');
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));
   checks.push({case:'active-root-groups',locale,width,theme,renderedMembers:rendered.length});
  }
  // Exercise the product's combined Cloze route with actual staged descriptors,
  // keeping intervening objects/pronouns visible between independent inputs.
  await page.setViewportSize({width:390,height:900});
  for(const gap of structuredGaps){
   const entry=byId.get(gap.entryId);
   await page.evaluate(async({locale,id,level})=>{
    window.reviewedCleanup?.();window.reviewedApp?.stop();
    const {createPresentation}=await import('/js/presentation/multilingual.js');
    const state=JSON.parse(localStorage.getItem('learn-language.en.lexicon.v1'));
    state.wordStatus={[id]:'learning'};state.preferences.studyLevel=level;
    localStorage.setItem('learn-language.en.lexicon.v1',JSON.stringify(state));
    const host=document.querySelector('main');let current='home';
    const app=createPresentation({language:'en',navigate:next=>{current=next;refresh();},refresh,onPreferences(){}});
    function refresh(){window.reviewedCleanup?.();window.reviewedCleanup=app.render(current,host);}
    app.setStudy(window.reviewedStudies.get(locale).study);app.setPreferences({uiLanguage:locale,theme:'dark'});
    app.settings.change('studyLevel',level);window.reviewedApp=app;
    window.reviewedRoute=next=>{current=next;refresh();};refresh();
   },{locale,id:entry.id,level:entry.level});
   await page.locator('[data-route=cloze]').click();await page.locator('[data-answer-mode=input]').click();
   await page.locator('.study-filter-panel summary').click();
   await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;try{document.querySelector('[data-f=learning]').click();}finally{Math.random=random;}});
   assert.equal(await page.locator('[data-question-word]').getAttribute('data-question-word'),gap.entryId);
   assert.equal(await page.locator('[data-phrase-gap]').count(),gap.gapFill.answers.length);
   assert.deepEqual(await page.locator('.phrase-gap-sentence').evaluate(node=>[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent)),gap.gapFill.parts);
   for(const [index,answer] of gap.gapFill.answers.entries()){
    await page.locator(`[data-phrase-gap="${index}"]`).fill(answer);
    assert.equal(await page.locator('[data-phrase-gap="0"]').inputValue(),gap.gapFill.answers[0]);
   }
   await page.locator('[data-sentence-submit]').click();
   assert.equal(await page.locator('.cloze-question.correct').count(),1);
   assert.equal(await page.locator('.phrase-gap-sentence').innerText(),entry.example.text);
   assert.equal(await page.locator('.sentence-translation').count(),1);
   assert.equal(await page.locator('.sentence-translation').innerText(),locale==='ko'?pairs.ko.entries.find(row=>row.id===entry.id).exampleTranslation:pairs.en.entries.find(row=>row.id===entry.id).meaning);
   assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth+1));
   checks.push({case:'combined-cloze-structured-gaps',locale,id:gap.entryId,exerciseId:gap.id,independentInputs:gap.gapFill.answers.length});
   if(['tell off','hold accountable'].includes(entry.word)){
    await page.evaluate(()=>window.reviewedRoute('home'));await page.locator('[data-route=scramble]').click();
    await page.locator('.study-filter-panel summary').click();await page.locator('[data-f=learning]').click();
    assert.equal(await page.locator('[data-question-word]').getAttribute('data-question-word'),entry.id);
    const tileCount=await page.evaluate(async sentence=>{
     const {sentenceTiles}=await import('/js/shared/lexicon-sentences.js');return sentenceTiles(sentence,'en').length;
    },entry.example.text);
    assert.equal(await page.locator('[data-tile]').count(),tileCount);
    for(let index=0;index<tileCount;index++)await page.locator(`[data-tile="${index}"]`).click();
    await page.locator('[data-sentence-submit]').click();
    assert.equal(await page.locator('.scramble-question.correct').count(),1);
    assert.equal(await page.locator('.sentence-quiz-text').innerText(),entry.example.text);
    assert.equal(await page.locator('.sentence-translation').count(),locale==='ko'?1:0);
    checks.push({case:'discontinuous-expression-scramble',locale,id:entry.id,word:entry.word,tiles:tileCount});
   }
  }
  await page.evaluate(()=>{window.reviewedCleanup?.();window.reviewedApp?.stop();});
  // Return control to the real shell and reload an installed pair offline.
  await page.reload();await ready(page);
  await tab(page,'settings');await page.selectOption('#target','en');await page.selectOption('#explanation',locale);
  await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  const downloadCount=downloads.length;offline=true;await context.setOffline(true);
  try{
   await page.reload();await ready(page);await tab(page,'home');
   const sample=selected[0];await page.locator(`[data-level="${sample.level}"]`).click();
   await page.locator('[data-route=wordlist]').click();await page.locator('#search-input').fill(sample.word);
   assert.equal(await page.locator(`[data-word="${sample.id}"] .wl-meaning`).innerText(),sample.meanings[locale]);
   assert.equal(downloads.length,downloadCount,'Offline reload attempted another package download');
   checks.push({case:'real-shell-offline-reload',locale,id:sample.id});
  }finally{offline=false;await context.setOffline(false);}
 }
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 assert.deepEqual(downloads.slice().sort(),descriptors.map(row=>row.url).sort());
 console.log(JSON.stringify({passed:true,stage,version:report.version,reviewSnapshotSha256:report.reviewSnapshotSha256,
  samples:selected.map(({peers,...sample})=>sample),checks},null,2));
 await context.close();
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
