import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseAppSettings,readAppSettings} from '../web/js/shared/app-settings.js';
const storage=rows=>({getItem:key=>rows[key]??null});
test('new app settings default to system appearance, English and both toggles off',()=>{
 assert.deepEqual(normaliseAppSettings(),{theme:'system',uiLanguage:'en',hapticEnabled:false,autoRemoveResolvedWrongs:false});
 assert.deepEqual(normaliseAppSettings({theme:'invalid',uiLanguage:'fr',hapticEnabled:'true',autoRemoveResolvedWrongs:1}),normaliseAppSettings());
});
test('explicit shared choices win over conflicting old language preferences',()=>{
 const saved={target:'de',theme:'dark',uiLanguage:'ko',hapticEnabled:true,autoRemoveResolvedWrongs:false};
 assert.deepEqual(readAppSettings(storage({'learn-language.de.progress.v1':JSON.stringify({preferences:{hapticEnabled:false,autoRemoveResolvedWrongs:true}})}),saved),{theme:'dark',uiLanguage:'ko',hapticEnabled:true,autoRemoveResolvedWrongs:false});
});
for(const [target,key,value]of [
 ['de','learn-language.de.progress.v1',{preferences:{hapticEnabled:true,autoRemoveResolvedWrongs:true}}],
 ['zh','learn-language.zh.autoRemoveResolvedWrongs',true],
 ['ja','learn-language.ja.lexicon.v1',{preferences:{hapticEnabled:true,autoRemoveResolvedWrongs:true}}],
])test(`${target}: initial migration retains the active Review choice and starts haptics off`,()=>{
 const result=readAppSettings(storage({[key]:JSON.stringify(value),'learn-language.zh.hapticEnabled':'true'}),{target});
 assert.equal(result.hapticEnabled,false);assert.equal(result.autoRemoveResolvedWrongs,true);
});
test('broken or unavailable legacy storage safely uses shared defaults',()=>{
 assert.deepEqual(readAppSettings(storage({'learn-language.de.progress.v1':'{'}),{target:'de'}),normaliseAppSettings());
 assert.deepEqual(readAppSettings({getItem(){throw new Error('unavailable');}},{target:'ja'}),normaliseAppSettings());
});
