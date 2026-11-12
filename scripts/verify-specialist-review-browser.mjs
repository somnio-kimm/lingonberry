import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
async function measure(page,card){return card.evaluate(node=>{
 const pick=selector=>{const n=node.querySelector(selector),s=n&&getComputedStyle(n);return s?{font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,colour:s.color,opacity:s.opacity}:null;},s=getComputedStyle(node),d=getComputedStyle(node.querySelector('.review-answer-details'));
 return {card:{padding:s.padding,radius:s.borderRadius,border:s.borderWidth,background:s.backgroundColor},word:pick('.wrong-main-word'),meaning:pick('.wrong-word-meaning'),wrong:pick('.wrong-answer-value--wrong'),label:pick('.wrong-answer-label'),detail:{margin:d.marginTop,padding:d.paddingTop,border:d.borderTopWidth}};
});}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir('/private/tmp/specialist-review',{recursive:true});let checks=0;const output=[];
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const ui of ['en','ko']){
  const explanation=ui==='en'?'ko':'en';await page.setViewportSize({width,height:1000});const baselines={};
  for(const language of ['de','zh','ja','en']){
   const cases=await page.evaluate(async({language,explanation,ui,theme})=>{
    window.reviewCleanup?.();window.reviewFixtureApp?.stop();
    const [{assembleStudy},{germanWords,chineseWords},{studyWords,studyProfiles},{createVocabularyEngine},{prepareLanguageExercises},{createExerciseQuestions},{createLexiconStore},{presentationDefinitions}]=await Promise.all([import('/js/packages/study.js'),import('/js/presentation/words.js'),import('/js/presentation/study-profiles.js'),import('/js/shared/vocabulary.js'),import('/js/shared/exercise-pools.js'),import('/js/shared/language-exercises.js'),import('/js/shared/lexicon-store.js'),import('/js/presentation/index.js')]);
    window.reviewStudies||=new Map();const key=language+'-'+explanation;
    if(!window.reviewStudies.has(key)){const catalog=await fetch('/catalog.json').then(r=>r.json()),read=(id,version)=>fetch(catalog.find(row=>row.id===id&&(!version||row.version===version)).url).then(r=>r.json());const pair=await read(key);window.reviewStudies.set(key,assembleStudy(await read(language+'-core',pair.studyVersion),pair));}
    const study=window.reviewStudies.get(key),host=document.querySelector('main'),definition=presentationDefinitions[language];host.parentElement.id=definition.layout.root;host.id=definition.layout.main;document.querySelector('nav').id=definition.layout.tabs;document.documentElement.dataset.theme=theme;document.documentElement.lang=ui==='ko'?'ko':'en-GB';document.querySelector('#style-de').disabled=language==='zh';document.querySelector('#style-zh').disabled=language!=='zh';
    let app,result=[];
    if(language==='de'){
     const [{createPresentation},{createStore},{createVocabularyPool}]=await Promise.all([import('/js/presentation/german.js'),import('/languages/de/js/core/store.js'),import('/languages/de/js/core/vocabulary-tests.js')]);localStorage.removeItem('learn-language.de.progress.v1');const store=createStore(localStorage),words=germanWords(study),q=createVocabularyPool('vocabinput',words.filter(w=>w.cefr==='A1'),explanation).choose(undefined,()=>0);store.setReviewContent(study);q.contentVersion=study.studyVersion;store.recordQuizAnswer('vocabinput',q,'wrong-review-answer',false);store.setWordStatus(q.word.id,'learning');app=createPresentation({navigate(){},refresh(){},onPreferences(){}});app.setStudy(study);app.setPreferences({uiLanguage:ui,theme});result=[{name:'baseline',level:'A1'}];
    }else if(language==='zh'){
     const [{createPresentation},{Store},{createVocabularyPool,snapshotVocabularyQuestion}]=await Promise.all([import('/js/presentation/chinese.js'),import('/languages/zh/js/services/store.js'),import('/languages/zh/js/services/vocabulary-tests.js')]);Store.clearWrong();Store.hskLevels=[1];app=createPresentation({navigate(){}});app.setStudy(study);app.setPreferences({uiLanguage:ui,theme});const q=createVocabularyPool('vocabinput',Store.activeWords,explanation).choose(undefined,()=>0);Store.words.find(word=>word.id===q.word.id).srs.level=1;Store.addWrong({mode:'vocabinput',wordId:q.word.id,wordHanzi:q.word.hanzi,hskLevel:q.word.hskLevel,userAnswer:'wrong-review-answer',correctAnswer:q.answer,question:snapshotVocabularyQuestion(q)});result=[{name:'baseline',level:'1'}];
    }else{
     const {createPresentation}=await import('/js/presentation/multilingual.js');localStorage.removeItem(`learn-language.${language}.lexicon.v1`);const store=createLexiconStore(localStorage,studyProfiles[language]),words=studyWords(study),byId=new Map(words.map(word=>[word.id,word])),prepared=prepareLanguageExercises(study,words),pick=(name,row)=>{if(!row)throw new Error('Missing Review fixture '+name);const q=createExerciseQuestions([row],words,row.route,row.category,explanation,()=>.3)[0];q.contentVersion=study.studyVersion;q.mode=language==='en'&&row.category==='phrasal'?'collocations':row.category;result.push({name,level:q.word.level,question:q});};
     if(language==='ja'){
      const school=words.find(w=>w.lemma==='学校'),long=words.find(w=>w.lemma==='久しい');pick('reading',prepared.find(r=>r.entryId===school.id&&r.category==='reading'&&r.options));pick('okurigana',prepared.find(r=>r.entryId===long.id&&r.category==='okurigana'&&r.route==='vocabinput'));
      pick('legacy-forms',study.exercises.find(r=>r.category==='forms'&&r.route==='forms'));
     }else{
      // A saved pre-retirement root question remains readable in Review.
      const family=study.families.find(row=>row.members.some(member=>byId.has(member.entryId))),member=family.members.find(row=>byId.has(row.entryId)),rootWord=byId.get(member.entryId);
      pick('roots',{id:'saved-root-'+family.id+'-'+rootWord.id,entryId:rootWord.id,category:'roots',route:'vocabinput',rootFamilyId:family.id,prompt:family.root+'\n'+rootWord.studyMeaning,answer:rootWord.lemma,acceptedAnswers:[rootWord.lemma]});
      pick('phrase-choice',prepared.find(r=>['collocations','phrasal','idioms'].includes(r.category)&&r.options&&!r.gapFill&&r.answer!==byId.get(r.entryId).lemma));
      pick('separated-gaps',prepared.find(r=>r.gapFill&&r.route==='vocabinput'));
     }
     for(const item of result){const q=item.question;let input=q.options?q.options.find(option=>option.id!==q.correctOption).id:q.category==='okurigana'?'久い':q.category==='forms'?'食べた':'incorrect-written-answer';
      if(q.category==='roots'){const choice=prepared.find(row=>row.rootFamilyId===q.rootFamilyId&&row.entryId===q.word.id&&row.options);input=choice?.options.find(value=>value!==q.answer&&!(q.acceptedAnswers||[]).includes(value))||'incorrect-written-answer';}
      if(q.gapFill){const {gradePhraseGaps}=await import('/js/shared/phrase-gaps.js');const wrong=['up','off','out','down','incorrect-gap'].find(value=>!gradePhraseGaps(q.gapFill,[q.gapFill.answers[0],value]).correct);input=[q.gapFill.answers[0],wrong].join(' … ');item.gapWrong=wrong;}
      store.record(q,input,false);const row=Object.values(store.state.wrongs).find(row=>row.question.id===q.id);item.recordId=row.id;item.wordId=q.word.id;item.wrong=q.options?q.options.find(option=>option.id===input).text:input;}
     app=createPresentation({language,navigate(){},refresh(){},onPreferences(){}});app.setStudy(study);app.setPreferences({uiLanguage:ui,theme});window.reviewBefore=JSON.parse(JSON.stringify(store.state.wrongs));window.reviewRenderLevel=level=>{window.reviewCleanup?.();app.settings.change('studyLevel',level);window.reviewCleanup=app.render('wrong',host);};
    }
    window.reviewFixtureApp=app;window.reviewCleanup=app.render('wrong',host);return result;
   },{language,explanation,ui,theme});
   if(['de','zh'].includes(language)){
    const cards=page.locator('.wrong-entry,.wrong-item');
    await cards.first().waitFor();baselines[language]=await measure(page,cards.first());
    const filter=page.locator('.wrong-filter-panel');
    assert.ok((await filter.locator('summary').innerText()).includes(ui==='ko'?'학습 상태':'Study Status'));
    await page.locator('#retest-filtered:enabled').waitFor();
    if(!await filter.evaluate(node=>node.open))await filter.locator('summary').click();
    const status=value=>filter.locator(language==='de'?'[data-wrong-filter=status][data-value='+value+']':'[data-wstatus='+value+']');
    await status('mastered').click();assert.equal(await cards.count(),0);assert.ok(await page.locator('#retest-filtered').isDisabled());
    await status('learning').click();assert.equal(await cards.count(),1);assert.equal(await status('learning').getAttribute('aria-pressed'),'true');
    await status('all').click();assert.equal(await cards.count(),1);continue;
   }
   const reference=baselines[language==='ja'?'zh':'de'];
   for(const item of cases){
    await page.evaluate(level=>window.reviewRenderLevel(level),item.level);const card=page.locator(`[data-review-id="${item.recordId}"]`);await card.waitFor();const measured=await measure(page,card);
    if(item.name==='legacy-forms'){
     const {label,...actual}=measured,{label:referenceLabel,...expected}=reference;assert.deepEqual(actual,expected);const labelStyle=await card.locator('.wrong-form-label').first().evaluate(node=>{const s=getComputedStyle(node);return {font:s.fontSize,colour:s.color};});assert.equal(labelStyle.font,'13px');assert.equal(labelStyle.colour,referenceLabel.colour);
    }else assert.deepEqual(measured,reference,`${language} ${item.name} shares baseline Review typography, answer rows, separator and card geometry`);
    assert.equal(await card.locator('.wrong-main-word,.wrong-word-meaning').count(),2);if(item.question.category==='phrasal')assert.equal(await card.locator('.wrong-mode').innerText(),ui==='ko'?'구동사':'Phrasal Verbs');assert.equal(await card.locator('.vocab-instruction,.vocab-prompt,.form-original-word,.grammar-word,.exercise-explanation p,input').count(),0,'Review must not contain quiz blocks or duplicate explanations');
    if(item.name==='reading'||item.name==='okurigana'||item.name==='roots')assert.equal(await card.locator('.wrong-correct-line').count(),0,'Correct answer already supplied by the heading');
    if(item.name==='reading'){
     assert.equal(await card.locator('.wrong-question-block').count(),1);assert.equal(await card.locator('.reading-segments').count(),0);
     assert.equal(await card.locator('.wrong-question').innerText(),item.question.prompt);
     assert.equal(await card.locator('.study-reading-target').innerText(),item.question.readingFocus?.text||item.question.word.lemma);
     assert.equal(await card.locator('.wrong-translation').innerText(),item.question.context);
     assert.equal(await card.locator('.wrong-translation').getAttribute('lang'),item.question.locale);
    }
    if(item.name==='okurigana')assert.equal(await card.locator('.reading-segments').count(),0);
    if(item.name==='roots')assert.equal(await card.locator('.wrong-question').evaluate(node=>getComputedStyle(node).fontSize),'16px');
    if(item.name==='phrase-choice')assert.equal(await card.locator('.wrong-user-line del').innerText(),item.wrong);
    if(item.name==='separated-gaps'){assert.equal(await card.locator('.wrong-test-blank').count(),2);assert.equal(await card.locator('.wrong-user-line .correct-answer').count(),1);assert.equal(await card.locator('.wrong-user-line del').innerText(),item.gapWrong);assert.ok(await card.locator('.wrong-test-blank').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).borderBottomStyle==='solid'&&getComputedStyle(node).borderTopStyle==='none')));}
    if(item.name==='legacy-forms')assert.deepEqual(await card.locator('[data-form-detail]').evaluateAll(nodes=>nodes.map(node=>node.dataset.formDetail)),['conditions','base','question','correct','wrong']);
    assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await card.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await card.screenshot({path:`/private/tmp/specialist-review/${language}-${item.name}-${width}-${theme}-${ui}.png`});
    await card.click();await page.locator('[role=dialog]').waitFor();await page.locator('[data-close]').click();await page.locator('.detail-overlay').waitFor({state:'detached'});checks++;output.push({language,feature:item.name,width,theme,ui,explanation,metrics:measured});
   }
   const stored=await page.evaluate(language=>JSON.parse(localStorage.getItem(`learn-language.${language}.lexicon.v1`)).wrongs,language);assert.deepEqual(stored,await page.evaluate(()=>window.reviewBefore),'Rendering Review does not rewrite stored questions/options/answers');
  }
 }
 await page.evaluate(()=>{window.reviewCleanup?.();window.reviewFixtureApp?.stop();});assert.deepEqual(errors,[]);await writeFile('/private/tmp/specialist-review/measurements.json',JSON.stringify(output,null,2));console.log(`Passed ${checks} real-package specialist Review cards against German/Chinese reference geometry: Reading, Okurigana, roots, phrase choices, separated gaps and historical forms; phone/tablet, themes, opposite display/explanation languages, dictionary-card opening and unchanged snapshots.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
