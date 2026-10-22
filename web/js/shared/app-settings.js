/** App-wide choices; language stores keep only compatibility mirrors used by exercises. */
export const APP_SETTING_DEFAULTS=Object.freeze({theme:'system',uiLanguage:'en',hapticEnabled:false,autoRemoveResolvedWrongs:false});
export const APP_SETTING_KEYS=Object.freeze(Object.keys(APP_SETTING_DEFAULTS));
export function normaliseAppSettings(values={}){
 return {
  theme:['light','dark','system'].includes(values?.theme)?values.theme:APP_SETTING_DEFAULTS.theme,
  uiLanguage:['en','ko'].includes(values?.uiLanguage)?values.uiLanguage:APP_SETTING_DEFAULTS.uiLanguage,
  hapticEnabled:typeof values?.hapticEnabled==='boolean'?values.hapticEnabled:APP_SETTING_DEFAULTS.hapticEnabled,
  autoRemoveResolvedWrongs:typeof values?.autoRemoveResolvedWrongs==='boolean'?values.autoRemoveResolvedWrongs:APP_SETTING_DEFAULTS.autoRemoveResolvedWrongs,
 };
}
/** Adopt the active language's explicit Review choice once; legacy haptics had an on default. */
export function readAppSettings(storage,saved={}){
 let removal=saved?.autoRemoveResolvedWrongs;
 if(typeof removal!=='boolean')try{
  const target=saved?.target;
  if(target==='zh')removal=JSON.parse(storage.getItem('learn-language.zh.autoRemoveResolvedWrongs'));
  else if(['de','ja','ko','en','es','fr'].includes(target)){
   const key=target==='de'?'learn-language.de.progress.v1':`learn-language.${target}.lexicon.v1`;
   removal=JSON.parse(storage.getItem(key))?.preferences?.autoRemoveResolvedWrongs;
  }
 }catch{}
 return normaliseAppSettings({...saved,autoRemoveResolvedWrongs:removal});
}
