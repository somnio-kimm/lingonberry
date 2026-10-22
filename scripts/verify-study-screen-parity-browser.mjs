import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function tab(page,id){await page.locator(`[data-tab=${id}]`).click();await ready(page);}
async function route(page,language,id){await tab(page,'home');await page.locator(language==='zh'?`[data-quiz=${id==='flashcards'?'flashcard':id}]`:`[data-route=${id}]`).click();await ready(page);const fold=page.locator('.filter-fold');if(await fold.count())await fold.evaluate(node=>{node.open=false;});}
async function measure(page,selector){return page.locator(selector).first().evaluate(node=>{const s=getComputedStyle(node),b=node.getBoundingClientRect();return {width:b.width,padding:s.padding,radius:s.borderRadius,border:s.borderWidth,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,align:s.textAlign,background:s.backgroundColor,colour:s.color,minHeight:s.minHeight};});}
async function question(page){return page.locator('.vocab-question,.sentence-question').first().evaluate(node=>{const box=node.getBoundingClientRect(),s=getComputedStyle(node),fold=document.querySelector('.filter-fold').getBoundingClientRect(),speaker=node.querySelector('.word-listen,.speak-btn'),b=speaker?.getBoundingClientRect();return {width:box.width,padding:s.padding,radius:s.borderRadius,border:s.borderWidth,gap:box.top-fold.bottom,speaker:b?{x:b.left-box.left,y:b.top-box.top,width:b.width,height:b.height}:null};});}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);await mkdir('/private/tmp/study-screen-parity',{recursive:true});
 for(const language of ['de','zh','en','ja']){await tab(page,'settings');await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-en"] .download-package`).click();await page.locator(`[data-package="${language}-en"] .remove-package`).waitFor();}
 const results={};let checks=0;
 for(const width of [390,1024])for(const theme of ['light','dark'])for(const locale of ['en','ko']){
  await page.setViewportSize({width,height:900});const group={};results[`${width}-${theme}-${locale}`]=group;
  for(const language of ['de','zh','en','ja']){
   await tab(page,'settings');await page.selectOption('#display-language',locale);await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#target',language);await page.selectOption('#explanation','en');await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready');const value={};group[language]=value;
   for(const mode of ['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble']){
    await route(page,language,mode);
    if(mode==='wordlist'){
     value.row=await measure(page,'.wl-row');value.search=await measure(page,'#search-input');await page.locator('.wl-main').first().click();value.sheet=await measure(page,'.detail-sheet');await page.locator('.detail-sheet-head button').first().click();await page.locator('.detail-overlay').waitFor({state:'detached'});
    }else if(mode==='flashcards'){
     value.card=await measure(page,'.flashcard');value.shuffle=await measure(page,'.fc-tools .btn-small');value.nav=await measure(page,'.fc-nav');
    }else{
     value[mode]={card:await question(page)};
     if(mode==='vocabinput'){value[mode].field=await measure(page,'#vocab-answer');value[mode].answer=await measure(page,'.vocab-answer-cell');}
     if(mode==='vocabmeaning'){
      value[mode].option=await measure(page,'.vocab-choice');assert.equal(await page.locator('#vocab-submit').count(),0,language+' selection checks on tap');
     }
     if(mode==='cloze'){
      const option=page.locator('[data-cloze-option],.cloze-options .opt-btn,[data-o]').first();value[mode].option=await measure(page,'[data-cloze-option],.cloze-options .opt-btn,[data-o]');assert.equal(await page.locator('[data-sentence-submit],#quiz-submit,#sub-btn').count(),0,language+' Cloze checks on tap');await option.click();await page.locator('.quiz-next-bar').waitFor();assert.equal(await page.locator('.quiz-action-bar').count(),0);value[mode].next=await measure(page,'.quiz-next-bar button');
     }
     if(mode==='scramble'){
      assert.equal(await page.locator('.sentence-question .flow-chip').count(),0,language+' tiles outside question');
      const panels=await page.locator('.quiz-after-filter>.panel,.quiz-after-filter>.card').count();assert.equal(panels,3,language+' question/answer/pool cards');
      const reset=page.locator('[data-sentence-reset],#quiz-reset,#clr-btn');assert.equal(await reset.count(),1);value[mode].reset=await measure(page,'[data-sentence-reset],#quiz-reset,#clr-btn');
      const tile=page.locator('[data-tile],[data-pool],[data-pi]').first();await tile.click();await reset.click();assert.equal(await page.locator('[data-return],[data-chosen],.chosen[data-i]').count(),0);
     }
    }
    assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth),`${language} ${mode} fits viewport`);
    if(mode==='vocabinput'){await page.locator('#vocab-answer').fill('wrong design answer');await page.locator('#vocab-submit').click();await page.locator('.vocab-answer-cell.wrong').waitFor();value.feedback={box:await measure(page,'.vocab-answer-cell'),correct:await measure(page,'.vocab-correction'),wrong:await measure(page,'.vocab-wrong')};assert.equal(await page.locator('.vocab-wrong').evaluate(node=>getComputedStyle(node).textDecorationLine),'line-through');}
    if(locale==='en')await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});if(locale==='en')await page.screenshot({path:`/private/tmp/study-screen-parity/${language}-${mode}-${width}-${theme}.png`,fullPage:true});checks++;
   }
   await tab(page,'wrong');
   value.review={card:await measure(page,'.wrong-entry,.wrong-item'),word:await measure(page,'.wrong-main-word'),meaning:await measure(page,'.wrong-word-meaning'),answer:await measure(page,'.wrong-answer-value--wrong'),remove:await measure(page,'.del-wrong,.dismiss-wrong'),count:await measure(page,'.wrong-count'),retest:await measure(page,'#retest-filtered')};
   delete value.review.answer.width;delete value.review.count.width;
   if(['ja','en'].includes(language)){
    assert.equal(await page.locator('.wrong-filter-panel').count(),1);assert.equal(await page.locator('.lexicon-view>label').count(),0);
    const row=page.locator('[data-review-word]').first();await row.click();await page.locator('[role=dialog]').waitFor();await page.locator('[data-close]').click();
    let message;page.once('dialog',async dialog=>{message=dialog.message();await dialog.dismiss();});await page.locator('#clear-wrong').click();assert.equal(message,locale==='ko'?'정말로 삭제할까요?':'Are you sure you want to delete?');assert.ok(await page.locator('.wrong-card').count());
   }
   checks++;
   if(locale==='en')await page.locator('.quiz-feedback-burst').waitFor({state:'detached'});if(locale==='en')await page.screenshot({path:`/private/tmp/study-screen-parity/${language}-review-${width}-${theme}.png`,fullPage:true});
  }
 }
 await writeFile('/private/tmp/study-screen-parity/measurements.json',JSON.stringify(results,null,2));
 for(const [scenario,group]of Object.entries(results))for(const [language,baseline]of [['en','de'],['ja','zh']]){
  for(const part of ['row','search','sheet','card','shuffle','nav','feedback','review'])assert.deepEqual(group[language][part],group[baseline][part],`${scenario} ${language} ${part}`);
  for(const mode of ['vocabmeaning','vocabinput','cloze','scramble'])assert.deepEqual(group[language][mode],group[baseline][mode],`${scenario} ${language} ${mode}`);
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} non-Dictation screens: English/German and Japanese/Chinese question, answer, speaker, option, list, detail, flashcard and action parity; phone/tablet, EN/KO and both themes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
