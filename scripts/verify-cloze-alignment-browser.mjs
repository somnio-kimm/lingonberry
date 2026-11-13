import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const directory=join(tmpdir(),'lingonberry-cloze-alignment'),server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[],measurements=[];
 page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir(directory,{recursive:true});
 for(const language of ['de','zh','en','ja'])for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  const measured=await page.evaluate(async({language,locale,theme})=>{
   window.alignmentBinding?.destroy();
   const [{renderLexiconSentence},{bindTypingAnswers},{lexiconText}]=await Promise.all([import('/js/shared/lexicon-sentence-view.js'),import('/js/shared/typing-answer.js'),import('/js/shared/lexicon-text.js')]);
   document.querySelector('#style-de').disabled=language==='zh';document.querySelector('#style-zh').disabled=language!=='zh';document.documentElement.dataset.theme=theme;
   const host=document.querySelector('main'),parts={de:['Bitte ',' es ',' bevor du es vergisst.'],zh:['请','下来，再','给我。'],en:['Please ',' it ',' before you forget.'],ja:['ここに','、声に出して','ください。']}[language],answers={de:['schreib','auf'],zh:['写','读'],en:['write','down'],ja:['書いて','読んで']}[language];
   const question={mode:'cloze',answerMode:'input',exercise:true,locale,word:{id:'alignment',studyLanguage:language},gapFill:{parts,answers},context:locale==='ko'?'문장 전체 번역입니다.':'A complete sentence translation.'};
   renderLexiconSentence(host,{question,chosenTokens:[],showTranslation:true,t:key=>lexiconText(locale,key)},{language,uiLanguage:locale,submit(){}});
   const fields=[...host.querySelectorAll('[data-phrase-gap]')];window.alignmentSubmitted=null;window.alignmentBinding=bindTypingAnswers(fields,{button:host.querySelector('[data-sentence-submit]'),onChange(){},onSubmit:values=>{window.alignmentSubmitted=values;}});
   const metrics=fields.map(input=>{
    const label=input.closest('.phrase-gap-field'),marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;margin:0;padding:0;vertical-align:baseline';input.before(marker);
    const rect=input.getBoundingClientRect(),style=getComputedStyle(input),parent=getComputedStyle(input.closest('.phrase-gap-sentence'));
    return {font:parseFloat(style.fontSize),sentenceFont:parseFloat(parent.fontSize),lineHeight:parseFloat(style.lineHeight),inputHeight:rect.height,tapHeight:label.getBoundingClientRect().height,underlineOffset:rect.bottom-parseFloat(style.borderBottomWidth)-marker.getBoundingClientRect().top};
   });
   return {metrics,answers};
  },{language,locale,theme});
  for(const row of measured.metrics){assert.equal(row.font,row.sentenceFont);assert.ok(row.tapHeight>=44);assert.ok(row.inputHeight<=row.font*1.3,JSON.stringify({language,locale,width,theme,...row}));assert.ok(row.underlineOffset>=0&&row.underlineOffset<=8,JSON.stringify({language,locale,width,theme,...row}));}
  const fields=page.locator('[data-phrase-gap]'),labels=page.locator('.phrase-gap-field');await labels.first().click({position:{x:2,y:2}});assert.equal(await fields.first().evaluate(node=>node===document.activeElement),true,'Padding remains a usable focus target');
  await fields.first().fill(measured.answers[0]);assert.equal(await page.locator('[data-sentence-submit]').isDisabled(),true);await fields.first().press('Enter');assert.equal(await fields.nth(1).evaluate(node=>node===document.activeElement),true);
  await fields.nth(1).fill(measured.answers[1]);await fields.nth(1).dispatchEvent('compositionstart');assert.equal(await page.locator('[data-sentence-submit]').isDisabled(),true);await fields.nth(1).dispatchEvent('compositionend');await page.locator('[data-sentence-submit]').click();assert.deepEqual(await page.evaluate(()=>window.alignmentSubmitted),measured.answers);
  assert.equal(await page.locator('body').evaluate(node=>node.scrollWidth>innerWidth),false);
  await page.locator('.sentence-question').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}.png`)});measurements.push({language,locale,width,theme,...measured});
 }
 assert.deepEqual(errors,[]);await writeFile(join(directory,'measurements.json'),JSON.stringify(measurements,null,2));console.log(`Passed ${measurements.length} shared Cloze underline/touch/keyboard/IME cases across four languages, EN/KO, phone/tablet and light/dark.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
