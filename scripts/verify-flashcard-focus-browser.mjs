import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));let cases=0;
 for(const locale of ['en','ko'])for(const width of [390,1024])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
  await page.evaluate(async({locale,theme})=>{
   document.documentElement.dataset.theme=theme;
   const [{createFlashcardSession},{renderLexiconFlashcards}]=await Promise.all([import('/js/shared/flashcard-session.js'),import('/js/shared/lexicon-flashcard-view.js')]),host=document.querySelector('main'),words=Array.from({length:3},(_,index)=>({id:'focus'+index,lemma:'Word '+index,studyMeaning:'Meaning '+index})),statuses=new Map(words.map(word=>[word.id,'new'])),session=createFlashcardSession({readStatus:word=>statuses.get(word.id),random:()=>0});let flipped=false,cleanup;
   session.begin(words,{size:10});
   const draw=()=>{
    window.previousMains=[...host.querySelectorAll('.fc-card-main')];window.previousFold=host.querySelector('.filter-fold');cleanup?.();
    const word=session.current;
    cleanup=renderLexiconFlashcards(host,{locale,language:'en',word,examples:word?[{word,number:1,example:{text:'Example '+word.id}}]:[],flipped,total:session.total,index:session.index,completed:session.completed,setSize:10,phase:session.phase,summary:session.summary,learningCount:session.learningCount,canStartNext:words.some(word=>statuses.get(word.id)!=='mastered'),filters:'<details class="filter-fold"><summary>Filters</summary></details>',renderHeading:word=>word.lemma,renderTags:()=>'<span class="detail-badge" style="flex:0 0 100%;height:28px">Level</span><span class="detail-badge" style="flex:0 0 100%;height:28px">Part of Speech</span>',renderExample:example=>'<p class="example-sentence">'+example.text+'</p>'},{
     bindFilters:host=>{host.querySelector('.filter-fold').ontoggle=()=>{};},resize(){},shuffle(){},nextSet(){session.begin(words.filter(word=>statuses.get(word.id)!=='mastered'),{size:10});flipped=false;draw();},reviewLearning(){session.reviewLearning();session.reconcile(words.filter(word=>statuses.get(word.id)!=='mastered'));flipped=false;draw();},flip(){flipped=!flipped;return flipped;},move(direction){session.move(direction);flipped=false;draw();},mark(status){statuses.set(word.id,status);session.mark(status);session.reconcile(words.filter(word=>statuses.get(word.id)!=='mastered'));flipped=false;draw();},openWord(){},speakWord(){},speakExample(){},
    });
   };window.focusSession=session;window.focusCleanup=()=>cleanup?.();draw();
  },{locale,theme});
  const front=page.locator('.flashcard-front .fc-card-main'),back=page.locator('.flashcard-back .fc-card-main');assert.ok((await front.getAttribute('aria-label')).includes('Word 0'));assert.ok(!(await front.getAttribute('aria-label')).includes('Meaning 0'));assert.ok((await back.getAttribute('aria-label')).includes('Meaning 0'));
  const top=face=>face.locator('.flashcard-word').evaluate(node=>node.getBoundingClientRect().top-node.closest('.flashcard').getBoundingClientRect().top);
  const headwordTop=await top(front);
  await front.focus();await front.press('Enter');assert.equal(await top(back),headwordTop,'Wrapped badges must not shift the headword on flip');assert.equal(await page.locator('.flashcard-front').evaluate(node=>node.inert),true);assert.equal(await page.locator('.flashcard-back').evaluate(node=>node.inert),false);assert.equal(await back.evaluate(node=>node===document.activeElement),true);await back.press('Space');assert.equal(await front.evaluate(node=>node===document.activeElement),true);
  await page.locator('.flashcard-front').click({position:{x:8,y:100}});
  assert.equal(await back.getAttribute('tabindex'),'0','Tapping card padding flips it');
  await page.locator('.flashcard-back .example-sentence').click();
  assert.equal(await front.getAttribute('tabindex'),'0','Tapping the example flips back');
  await page.locator('[data-mark-learning]').focus();await page.locator('[data-mark-learning]').press('Enter');assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),'focus1');assert.equal(await page.locator('[data-mark-learning]').evaluate(node=>node===document.activeElement),true);assert.equal(await page.evaluate(()=>window.previousMains.every(node=>node.onclick===null&&node.onkeydown===null)&&window.previousFold.ontoggle===null),true);
  await page.locator('[data-mark-mastered]').focus();await page.locator('[data-mark-mastered]').press('Enter');assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),'focus2');assert.equal(await page.locator('[data-mark-mastered]').evaluate(node=>node===document.activeElement),true);await page.locator('[data-mark-mastered]').press('Enter');await page.locator('.fc-set-complete').waitFor();assert.equal(await page.locator('[data-review-learning]').evaluate(node=>node===document.activeElement),true);
  await page.locator('[data-review-learning]').press('Enter');assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),'focus0');assert.equal(await page.locator('#flashcard-count').getAttribute('data-set-total'),'1');assert.equal(await page.locator('[data-mark-learning]').evaluate(node=>node===document.activeElement),true);
  await page.locator('[data-mark-mastered]').focus();await page.locator('[data-mark-mastered]').press('Enter');await page.locator('.fc-set-complete').waitFor();await page.locator('[data-prev-card]').focus();await page.locator('[data-prev-card]').press('Enter');assert.equal(await page.locator('.flashcard').getAttribute('data-word-id'),'focus0');assert.equal(await page.locator('[data-mark-learning]').evaluate(node=>node===document.activeElement),true,'Reopening a one-card completed round must not focus its disabled previous button');
  await page.evaluate(()=>window.focusCleanup());assert.equal(await page.locator('.fc-card-main').evaluateAll(nodes=>nodes.every(node=>node.onclick===null&&node.onkeydown===null)),true);
  await page.evaluate(async locale=>{
   const {renderLexiconFlashcards}=await import('/js/shared/lexicon-flashcard-view.js');
   const word={id:'sparse',lemma:'Sparse',studyMeaning:'Missing example\nValid example'};
   const examples=[{word:{id:'missing'},number:1},
    ...Array.from({length:8},(_,i)=>({word,number:2,example:{text:`Example ${i+1}. ${'A longer sentence that wraps inside this flashcard. '.repeat(4)}`,studyTranslation:'Example translation.'}})),
   ];
   let flipped=true;
   renderLexiconFlashcards(document.querySelector('main'),{locale,language:'en',word,examples,flipped,total:1,index:0,completed:0,setSize:10,phase:'studying',filters:'',renderHeading:word=>word.lemma,renderTags:()=>'',renderExample:example=>'<p class="example-sentence">'+example.text+'</p>'},{resize(){},shuffle(){},nextSet(){},reviewLearning(){},flip(){flipped=!flipped;return flipped;},move(){},mark(){},openWord(){},speakWord(){},speakExample(text){window.focusExampleSpoken=text;}});
  },locale);
  const senses=page.locator('.flashcard-back .study-dictionary-sense');
  assert.deepEqual(await senses.locator('.study-sheet-meaning').allTextContents(),['1. Missing example','2. Valid example']);
  assert.equal(await senses.first().locator('[data-example]').count(),0);
  const scroll=page.locator('.fc-card-answer'),start=await top(back);
  await scroll.press('End');
  await page.waitForFunction(()=>{
   const region=document.querySelector('.fc-card-answer');
   return region.scrollTop>0&&region.scrollTop+region.clientHeight>=region.scrollHeight-1;
  });
  assert.equal(await top(back),start,'The headword stays fixed while the answer scrolls');
  assert.equal(await page.locator('.flashcard-back').evaluate(node=>node.scrollTop),0);
  const audio=senses.nth(1).locator('[data-example]').last();
  await audio.click();
  assert.match(await page.evaluate(()=>window.focusExampleSpoken),/^Example 8\./u);
  assert.equal(await top(back),start,'Focusing the last example speaker keeps the word fixed');
  assert.equal(await page.locator('.flashcard-back').getAttribute('aria-hidden'),'false','Example audio keeps the card answer visible');
  await back.press('Enter');
  await front.press('Enter');
  assert.equal(await scroll.evaluate(node=>node.scrollTop),0,'Reopening the card starts at the first meaning');
  cases++;
 }
 assert.deepEqual(errors,[]);console.log(`Passed ${cases} Flashcard cases: pinned headword during answer scrolling, example audio, whole-face tap, keyboard flip, classification and replay; EN/KO, phone/tablet and both themes.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
