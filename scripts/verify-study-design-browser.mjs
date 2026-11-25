import assert from 'node:assert/strict';
import {ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer(),directory=join(tmpdir(),'study-design-contract');let browser;
const properties=['fontSize','fontWeight','color','backgroundColor','padding','borderRadius','borderWidth'];
const measure=(page,selector,keys=properties)=>page.locator(selector).first().evaluate((node,keys)=>{const style=getComputedStyle(node);return Object.fromEntries(keys.map(key=>[key,style[key]]));},keys);
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');await mkdir(directory,{recursive:true});let checks=0;const selectorMeasurements=new Map();
 for(const language of ['de','zh'])for(const width of [390,1024])for(const theme of ['light','dark'])for(const locale of ['en','ko']){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async({language,theme,locale})=>{
   document.querySelector('#style-de').disabled=language!=='de';document.querySelector('#style-zh').disabled=language!=='zh';document.documentElement.dataset.theme=theme;
   const [{renderMorphemeInventory},{renderStudyTabs,renderStudyFilters,renderStudyReviewFilters,renderDictionaryMeanings,renderDictionarySenses},{lexiconText},{selectSenseExamples}]=await Promise.all([import('/js/shared/morpheme-view.js'),import('/js/shared/study-components.js'),import('/js/shared/lexicon-text.js'),import('/js/shared/word-example.js')]);
   const host=document.querySelector('main');host.innerHTML='<div id="baseline"><section class="panel"><h2 class="section-title">Reference</h2></section><div class="card study-search"><input class="input-field" type="search" placeholder="Search"></div><div class="wl-list wl-list--wordlist"><div class="word-row-window"><div class="wl-row"><div class="wl-main"><span class="wl-headword">audience</span><div class="wl-meaning">listeners</div></div></div></div></div></div><div id="feature"></div>';
   const words=[{id:'audience',lemma:'audience',studyMeaning:'listeners'}],rows=[{id:'aud',form:'aud-',variants:[],kind:'root',origin:'Latin',examples:['audience','audition'],senses:[{id:'aud-0',meaning:'hear',tags:[]}],source:'https://en.wiktionary.org/wiki/aud-'}];
   renderMorphemeInventory(document.querySelector('#feature'),{rows,words,state:{},t:x=>lexiconText(locale,x),locale,openWord:id=>{window.openedRootWord=id;},tags:()=>''});
   host.insertAdjacentHTML('beforeend',renderStudyTabs({label:'Answer Mode',options:[{value:'choice',label:'Selection'},{value:'input',label:'Typing'}],selected:'choice',attribute:'data-answer-mode'}));
   const group={title:'Type',selected:'all',options:[{value:'all',label:'All'}]};
   host.insertAdjacentHTML('beforeend',renderStudyFilters({title:'Filters',status:group,pos:group,open:true}));
   host.insertAdjacentHTML('beforeend',renderStudyReviewFilters({title:'Filters',groups:[{...group,key:'mode',options:[{value:'all',label:'All',count:1}]}],open:true}));
   const definition=locale==='ko'?'뜻이 길어져 다음 줄로 넘어갈 때도 번호 아래가 아니라 첫 줄의 뜻과 예문이 같은 위치에서 시작하는지 확인합니다.':'A deliberately long definition that wraps across several lines and stays aligned with its example sentence and translated sentence.';
   const word={id:'indent-layout',studyMeaning:definition,examples:[{text:'Example sentence.',studyTranslation:'Example translation.'}]};
   const senses=renderDictionarySenses([definition],selectSenseExamples(word,language),{locale,title:'Examples',speakLabel:'Listen',renderExample:example=>`<div class="example-sentence">${example.text}</div>`});
   host.insertAdjacentHTML('beforeend',`<section id="sense-indent" class="panel" style="max-width:330px"><div class="wl-meaning">${renderDictionaryMeanings(word,language)}</div>${senses}</section>`);
  },{language,theme,locale});
  const indentation=await page.locator('#sense-indent').evaluate(node=>{
   const bounds=selector=>node.querySelector(selector).getBoundingClientRect();
   const textRects=selector=>[...node.querySelector(selector).getClientRects()].map(rect=>rect.left);
   const sentence=bounds('.example-sentence'),translation=bounds('.example-translation');
   return {numbers:[...node.querySelectorAll('.study-sense-number')].map(marker=>marker.textContent.trim()),
    marker:bounds('.study-sheet-meaning .study-sense-number').left,
    meaning:textRects('.study-sheet-meaning .study-sense-text'),list:textRects('.wl-meaning .study-sense-text'),
    sentence:sentence.left,translation:translation.left,translationGap:translation.top-sentence.bottom};
  });
  assert.deepEqual(indentation.numbers,['1.','1.']);
  assert.ok(indentation.meaning.length>1&&indentation.list.length>1);
  const firstText=indentation.meaning[0];
  assert.ok(firstText>indentation.marker&&[...indentation.meaning,...indentation.list,indentation.sentence,indentation.translation].every(x=>Math.abs(x-firstText)<.5),JSON.stringify(indentation));
  assert.ok(indentation.translationGap>=8);
  assert.deepEqual(await measure(page,'[data-morpheme]', ['padding','borderRadius','borderWidth','backgroundColor']),await measure(page,'#baseline .panel',['padding','borderRadius','borderWidth','backgroundColor']));
  assert.deepEqual(await measure(page,'.study-reference-heading',['fontSize','fontWeight','color']),await measure(page,'#baseline .wl-headword',['fontSize','fontWeight','color']));
  assert.deepEqual(await measure(page,'.study-reference-origin',['fontSize','color']),await measure(page,'#baseline .wl-meaning',['fontSize','color']));
  assert.deepEqual(await measure(page,'#feature .wl-row'),await measure(page,'#baseline .wl-row'));
  assert.deepEqual(await measure(page,'#feature .study-search .input-field'),await measure(page,'#baseline .study-search .input-field'));
  assert.equal((await measure(page,'.study-reference-heading')).fontSize,'24px');assert.equal((await measure(page,'[data-morpheme]')).padding,'16px');
  assert.equal((await measure(page,'[data-related-list]',['gap'])).gap,'2px');assert.equal((await measure(page,'[data-root-list]>.word-row-window',['gap'])).gap,'16px');
  assert.equal(await page.locator('[data-related-list] .wl-row').count(),1);
  assert.equal(await page.locator('#feature [data-root-list] :is(details,summary,a)').count(),0);await page.locator('[data-related-list] .wl-row').waitFor({state:'visible'});assert.match(await page.locator('.study-reference-words-title').innerText(),locale==='ko'?/^관련 단어 \(1\)/u:/^Related Words \(1\)/u);await page.locator('[data-root-word=audience]').click();assert.equal(await page.evaluate(()=>window.openedRootWord),'audience');
  const buttons=await page.locator('[data-answer-mode]').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize})));assert.ok(Math.abs(buttons[0].width-buttons[1].width)<=.5);assert.ok(buttons.every(b=>b.height>=44&&b.font==='14px'),JSON.stringify({language,width,theme,buttons}));
  await page.locator('#feature .study-search-filters summary').click();
  const filterStyle=['fontFamily','fontSize','fontWeight','padding','minHeight','borderRadius'];
  const rootTag=await measure(page,'#feature [data-root-kind=all]',filterStyle);
  assert.deepEqual(rootTag,await measure(page,'main > .study-filter-panel .wl-filter',filterStyle));
  assert.deepEqual(rootTag,await measure(page,'.wrong-filter-panel .wl-filter',filterStyle));
  const select=await measure(page,'#feature [data-root-kind=all]'),key=locale+'-'+width+'-'+theme;if(language==='de'){selectorMeasurements.set(key,select);selectorMeasurements.set(key+'-search',await measure(page,'#feature .study-search .input-field'));}else{assert.deepEqual(select,selectorMeasurements.get(key),'Chinese filter tags follow German geometry');assert.deepEqual(await measure(page,'#feature .study-search .input-field'),selectorMeasurements.get(key+'-search'),'Search fields match between languages');}assert.equal((await measure(page,'[data-morpheme]',['marginBottom'])).marginBottom,'0px');
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));await page.locator('main').screenshot({path:join(directory,`${language}-${locale}-${width}-${theme}.png`),fullPage:true});checks++;
 }
 for(const [width,theme,locale] of [[390,'dark','ko'],[1024,'light','en']])for(const legacy of [false,true]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(async({theme,locale,level,legacy})=>{
   const {createPresentation}=await import('/js/presentation/multilingual.js');
   document.querySelector('#style-de').disabled=false;document.querySelector('#style-zh').disabled=true;
   document.documentElement.dataset.theme=theme;
   const host=document.querySelector('main');
   let cleanup;
   const refresh=()=>{cleanup?.();cleanup=presentation.render('roots',host);};
   const presentation=createPresentation({language:'en',refresh,onPreferences(){}});
   presentation.setPreferences({uiLanguage:locale,studyLevel:level});
   presentation.setStudy({
    targetLanguage:'en',explanationLanguage:locale,
    entries:[{id:'audience',word:'audience',partOfSpeech:'noun',level,meaning:locale==='ko'?'청중':'listeners'},
     {id:'audition',word:'audition',partOfSpeech:'noun',level,meaning:locale==='ko'?'오디션':'trial performance'}],
    families:[{id:'aud',root:'aud-',origin:'la',meaning:locale==='ko'?'듣다':'hear',members:[{entryId:'audience',word:'audience',references:['https://en.wiktionary.org/wiki/audience']},{entryId:'audition',word:'audition'}]}],
    morphemes:legacy?[]:[{id:'aud',form:'aud-',variants:[],kind:'root',origin:'Latin',examples:['audience','audition','audial'],
     senses:[{meaning:locale==='ko'?'듣다':'hear'}],source:'https://en.wiktionary.org/wiki/aud-'}],
   });
   refresh();
  },{theme,locale,legacy,level:ENGLISH_LEVELS[0]});
  const search=page.locator('#root-search');
  await search.fill('audial');
  assert.equal(await page.locator('[data-morpheme]').count(),0);
  await search.fill('aud');
  assert.equal(await page.locator('[data-practice-family]').count(),0);
  assert.equal(await page.locator('[data-root-view],[data-answer-mode],[data-submit],.vocab-question').count(),0);
  await page.locator('main').screenshot({path:join(directory,`root-reference-${legacy?'legacy':'current'}-${width}-${theme}.png`)});
  assert.equal(await search.inputValue(),'aud');assert.equal(await page.locator('[data-root-list] details,[data-root-list] summary,[data-root-list] a').count(),0);assert.equal(await page.locator('[data-root-entry]').count(),2);await page.locator('[data-root-entry=audience]').waitFor({state:'visible'});await page.locator('[data-root-entry=audience] .wl-meaning').click();await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-sheet-meaning').innerText(),locale==='ko'?'1. 청중':'1. listeners');await page.locator('[data-close]').click();
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${checks} shared design contracts and four current/legacy Root Families scenarios: directly visible words, dictionary opening and no source links.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
