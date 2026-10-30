import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startServer} from './dev-server.mjs';
const server=await startServer();let browser;
const languages=['de','zh','en','ja','ko','es','fr'];
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.catalogState==='ready'&&document.querySelector('main').dataset.viewState==='ready');
async function settings(page){await page.locator('[data-tab=settings]').click();await ready(page);}
async function select(page,target,explanation='en'){await settings(page);await page.selectOption('#target',target);await page.selectOption('#explanation',explanation);await page.waitForFunction(()=>document.querySelector('#package-status').dataset.state==='ready'&&document.querySelector('main').dataset.viewState==='ready');}
async function toggle(page,id,enabled){if(await page.locator(id).getAttribute('aria-checked')!==String(enabled))await page.locator(id).click();await ready(page);}
async function expectSettings(page,{theme,uiLanguage,hapticEnabled,autoRemoveResolvedWrongs}){
 assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.equal(await page.locator('#display-language').inputValue(),uiLanguage);
 assert.equal(await page.locator('#set-haptic').getAttribute('aria-checked'),String(hapticEnabled));assert.equal(await page.locator('#set-hide-resolved').getAttribute('aria-checked'),String(autoRemoveResolvedWrongs));
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('learn-language.preferences.v1')));
 assert.deepEqual({theme:saved.theme,uiLanguage:saved.uiLanguage,hapticEnabled:saved.hapticEnabled,autoRemoveResolvedWrongs:saved.autoRemoveResolvedWrongs},{theme,uiLanguage,hapticEnabled,autoRemoveResolvedWrongs});
}
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.testVibrations=[];Object.defineProperty(navigator,'vibrate',{value:pattern=>{window.testVibrations.push(pattern);return true;},configurable:true});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready(page);
 // Older versions persisted an on default in language stores. It must not turn on the new app-wide default.
 await page.evaluate(()=>{localStorage.setItem('learn-language.de.progress.v1',JSON.stringify({version:1,units:{},concepts:{},wordStatus:{'settings-progress-sentinel':'mastered'},preferences:{hapticEnabled:true,autoRemoveResolvedWrongs:false,studyLevel:'A2'}}));localStorage.setItem('learn-language.zh.hapticEnabled','true');localStorage.setItem('learn-language.zh.hskLevels','[3]');});await page.reload();await ready(page);
 await expectSettings(page,{theme:'system',uiLanguage:'en',hapticEnabled:false,autoRemoveResolvedWrongs:false});assert.equal(await page.evaluate(()=>window.testVibrations.length),0);
 for(const language of languages){await settings(page);await page.locator('#manage-packages').click();await page.locator(`[data-language=${language}]`).click();await page.locator(`[data-available="${language}-en"] .download-package`).click();await page.locator(`[data-package="${language}-en"] .remove-package`).waitFor();if(language==='de'){await page.locator('[data-available="de-ko"] .download-package').click();await page.locator('[data-package="de-ko"] .remove-package').waitFor();}}
 let cases=0;
 for(const {width,theme,uiLanguage,enabled}of [
  {width:390,theme:'light',uiLanguage:'en',enabled:false},{width:390,theme:'dark',uiLanguage:'ko',enabled:true},
  {width:1024,theme:'light',uiLanguage:'en',enabled:false},{width:1024,theme:'dark',uiLanguage:'ko',enabled:true},
 ]){
  await page.setViewportSize({width,height:900});await settings(page);await page.locator(`[data-theme-choice=${theme}]`).click();await page.selectOption('#display-language',uiLanguage);await toggle(page,'#set-haptic',enabled);await toggle(page,'#set-hide-resolved',enabled);
  const expected={theme,uiLanguage,hapticEnabled:enabled,autoRemoveResolvedWrongs:enabled};
  for(const language of languages){await select(page,language);await expectSettings(page,expected);assert.ok(await page.locator('body').evaluate(node=>node.scrollWidth<=innerWidth));cases++;}
  await select(page,'de','ko');await expectSettings(page,expected);await select(page,'de','en');await expectSettings(page,expected);
  const before=await page.evaluate(()=>window.testVibrations.length);await page.locator(`[data-theme-choice=${theme}]`).click();assert.equal((await page.evaluate(()=>window.testVibrations.length))>before,enabled,'actual haptics obey the shared toggle');
  await page.reload();await ready(page);await settings(page);await expectSettings(page,expected);
 }
 await toggle(page,'#set-haptic',false);const before=await page.evaluate(()=>window.testVibrations.length);await select(page,'zh');await page.locator('[data-theme-choice=system]').click();assert.equal(await page.evaluate(()=>window.testVibrations.length),before);
 const progress=await page.evaluate(()=>({de:JSON.parse(localStorage.getItem('learn-language.de.progress.v1')),zh:localStorage.getItem('learn-language.zh.hskLevels')}));assert.equal(progress.de.wordStatus['settings-progress-sentinel'],'mastered');assert.equal(progress.de.preferences.studyLevel,'A2');assert.equal(progress.zh,'[3]');
 assert.deepEqual(errors,[]);console.log(`Passed ${cases} shared-setting language switches, explanation switches, relaunches, phone/tablet and light/dark; haptics off by default and functional on/off gates; study levels/progress retained.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
