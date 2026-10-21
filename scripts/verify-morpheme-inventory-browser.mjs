import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready');
 for(const locale of ['en','ko']){
  await page.evaluate(async locale=>{
   const {renderMorphemeInventory}=await import('/js/shared/morpheme-view.js');
   const host=document.createElement('main');document.body.replaceChildren(host);const words=[{id:'absent',lemma:'absent',studyMeaning:locale==='ko'?'자리에 없는':'not present'}];
   const make=(id,form,kind,examples)=>({id,form,variants:[],kind,origin:kind==='suffix'?'Old English':'Latin',examples,senses:[{id:id+'-0',meaning:locale==='ko'?'~에서 떨어져':'away from'}],source:'https://en.wiktionary.org/wiki/'+form});
   window.cleanupInventory=renderMorphemeInventory(host,{rows:[make('ab','ab-','prefix',['absent',...Array.from({length:45},(_,i)=>'word '+i)]),make('ad','ad-','prefix',['adapt']),make('ling','-ling','suffix',['duckling']),...Array.from({length:1000},(_,i)=>make('root-'+i,'aud','root',['audience']))],words,state:{},t:x=>x,locale,tabs:'',bindTabs(){},openWord:id=>{window.openedMorphemeWord=id;},tags:()=>''});
  },locale);
  assert.ok((await page.locator('[data-root-count]').innerText()).includes('1,003'));assert.equal(await page.locator('[data-root-count]').getAttribute('data-total'),'1003');assert.ok(await page.locator('[data-morpheme]').count()<1003);
  assert.equal(await page.locator('[data-morpheme=ab] .root-member').count(),12);await page.locator('[data-more-related=ab]').click();assert.equal(await page.locator('[data-morpheme=ab] .root-member').count(),32);
  await page.locator('[data-root-word=absent]').click();assert.equal(await page.evaluate(()=>window.openedMorphemeWord),'absent');
  await page.locator('#root-search').fill('duckling');assert.equal(await page.locator('[data-morpheme]').count(),1);assert.equal(await page.locator('[data-morpheme]').getAttribute('data-morpheme'),'ling');
  assert.equal(await page.locator('#root-search').evaluate(node=>node===document.activeElement),true);
  await page.locator('#root-search').fill('');await page.selectOption('[data-root-kind]','suffix');assert.equal(await page.locator('[data-morpheme]').count(),1);
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.cleanupInventory());assert.equal(await page.locator('#root-search').evaluate(node=>node.oninput),null);assert.equal(await page.locator('[data-root-list]').evaluate(node=>node.onclick),null);
  console.log('Verified independent full inventory, bounded rows/examples, search focus, type filters and dictionary links:',locale);
 }
 // Exercise the actual downloaded inventory as well as the bounded synthetic fixture.
 for(const locale of ['en','ko']){
  const expected=await page.evaluate(async locale=>{
   const [{assembleStudy},{renderMorphemeInventory},{lexiconText}]=await Promise.all([import('/js/packages/study.js'),import('/js/shared/morpheme-view.js'),import('/js/shared/lexicon-text.js')]);
   const catalog=await fetch('/catalog.json').then(r=>r.json()),read=id=>fetch(catalog.find(row=>row.id===id).url).then(r=>r.json());
   const study=assembleStudy(await read('en-core'),await read('en-'+locale)),host=document.querySelector('main');
   window.cleanupInventory=renderMorphemeInventory(host,{rows:study.morphemes,words:[],state:{},t:value=>lexiconText(locale,value),locale,tabs:'',bindTabs(){},openWord(){},tags:()=>''});
   return study.morphemes.length;
  },locale);
  assert.ok(expected>1000);assert.equal(Number(await page.locator('[data-root-count]').getAttribute('data-total')),expected);
  assert.equal(Number(await page.locator('[data-root-count]').getAttribute('data-visible')),expected);
  const before=await page.locator('[data-morpheme]').count();await page.locator('.word-list-more>button').click();assert.ok(await page.locator('[data-morpheme]').count()>before);
  await page.locator('#root-search').fill('aud');assert.ok((await page.locator('[data-root-list]').innerText()).includes('audience'));
  await page.locator('#root-search').fill('');await page.selectOption('[data-root-kind]','root');assert.ok(Number(await page.locator('[data-root-count]').getAttribute('data-visible'))>1000);
  await page.evaluate(()=>window.cleanupInventory());console.log('Verified real English inventory count, pagination, aud-family search and root-only coverage:',locale,expected);
 }
 for(const locale of ['en','ko']){
  const addresses=await page.evaluate(async locale=>{
   const [{createPresentation},{assembleStudy}]=await Promise.all([import('/js/presentation/multilingual.js'),import('/js/packages/study.js')]);
   const catalog=await fetch('/catalog.json').then(r=>r.json()),read=id=>fetch(catalog.find(row=>row.id===id).url).then(r=>r.json());
   const study=assembleStudy(await read('en-core'),await read('en-'+locale)),host=document.querySelector('main');let app;
   app=createPresentation({language:'en',navigate(){},refresh:()=>app.render('roots',host),onPreferences(){}});app.setStudy(study);app.setPreferences({theme:'system',uiLanguage:locale});app.render('roots',host);window.cleanupRootPresentation=()=>app.stop();
   return study.entries.filter(row=>row.word==='address').map(row=>({id:row.id,meaning:row.meaning,level:row.level}));
  },locale);
  assert.ok(addresses.length>=2);await page.locator('#root-search').fill('address');
  for(const entry of addresses){const row=page.locator(`[data-root-entry="${entry.id}"]`).first();await row.waitFor();assert.ok((await row.innerText()).includes(entry.meaning));assert.ok((await row.innerText()).includes(entry.level));await row.locator('.wl-meaning').click();await page.locator('[role=dialog]').waitFor();assert.equal(await page.locator('.study-sheet-meaning').innerText(),entry.meaning);await page.keyboard.press('Escape');}
  await page.evaluate(()=>window.cleanupRootPresentation());console.log('Verified real address noun/verb dictionary links, meanings and levels:',locale);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
