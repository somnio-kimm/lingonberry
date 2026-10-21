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
   renderMorphemeInventory(host,{rows:[make('ab','ab-','prefix',['absent',...Array.from({length:45},(_,i)=>'word '+i)]),make('ad','ad-','prefix',['adapt']),make('ling','-ling','suffix',['duckling']),...Array.from({length:1000},(_,i)=>make('root-'+i,'aud','root',['audience']))],words,state:{},t:x=>x,locale,tabs:'',bindTabs(){},openWord:id=>{window.openedMorphemeWord=id;},tags:()=>''});
  },locale);
  assert.ok((await page.locator('[data-root-count]').innerText()).includes('1,003'));assert.ok(await page.locator('[data-morpheme]').count()<1003);
  assert.equal(await page.locator('[data-morpheme=ab] .root-member').count(),12);await page.locator('[data-more-related=ab]').click();assert.equal(await page.locator('[data-morpheme=ab] .root-member').count(),32);
  await page.locator('[data-root-word=absent]').click();assert.equal(await page.evaluate(()=>window.openedMorphemeWord),'absent');
  await page.locator('#root-search').fill('duckling');assert.equal(await page.locator('[data-morpheme]').count(),1);assert.equal(await page.locator('[data-morpheme]').getAttribute('data-morpheme'),'ling');
  assert.equal(await page.locator('#root-search').evaluate(node=>node===document.activeElement),true);
  await page.locator('#root-search').fill('');await page.selectOption('[data-root-kind]','suffix');assert.equal(await page.locator('[data-morpheme]').count(),1);
  assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));
  console.log('Verified independent full inventory, bounded rows/examples, search focus, type filters and dictionary links:',locale);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
