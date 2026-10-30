import {APP_SETTING_KEYS} from '../shared/app-settings.js';
import {APP_NAME} from '../shared/app-config.js';
import {SCREENS,isQuizScreen,STUDY_LEVELS} from '../../languages/de/js/app-definition.js';
import {createScreenRenderers} from '../shared/screen-renderers.js';
import {createStore} from '../../languages/de/js/core/store.js';
import {setLocale,t} from '../../languages/de/js/core/i18n.js';
import {eraseRecordings,stopMedia} from '../../languages/de/js/core/media.js';
import {germanWords} from './words.js';
export function createPresentation({navigate,refresh,onPreferences}) {
 const store=createStore(localStorage);let lastStudy;
 const context={catalog:{units:[],levels:STUDY_LEVELS},units:[],words:[],reference:null,dictionaryCount:0,store,navigate,refresh:()=>{onPreferences(preferences());refresh();},updateStatus:()=>onPreferences(preferences()),offlineStatus:()=>t('Study vocabulary saved for offline use. German speech depends on a system voice.'),haptic:()=>{if(store.state.preferences.hapticEnabled)navigator.vibrate?.(10);}};
 const renderers=createScreenRenderers(SCREENS,()=>store.state.preferences.uiLang);
 function preferences(){return {theme:store.state.preferences.theme,uiLanguage:store.state.preferences.uiLang,hapticEnabled:store.state.preferences.hapticEnabled,autoRemoveResolvedWrongs:store.state.preferences.autoRemoveResolvedWrongs};}
 return {
  id:'de',screens:SCREENS,
  settings:{
   values:preferences,
   change:(key,value)=>store.preference(key==='uiLanguage'?'uiLang':key,value),haptic:context.haptic,
   reportContext:()=>({app:APP_NAME,studyLanguage:'de',studyLevel:store.state.preferences.studyLevel}),
   reset:async()=>{stopMedia();if(!store.resetStudy())throw new Error('Could not reset study progress');context.libraryState=undefined;try{await eraseRecordings();return false;}catch{return true;}},
  },
  setStudy(study){if(study===lastStudy)return;lastStudy=study;context.words=study?germanWords(study):[];context.dictionaryCount=context.words.length;},
  setPreferences(values){for(const key of APP_SETTING_KEYS){const local=key==='uiLanguage'?'uiLang':key;if(Object.hasOwn(values,key)&&store.state.preferences[local]!==values[key])store.preference(local,values[key]);}setLocale(store.state.preferences.uiLang);},
  preferences,
  title(route){return route==='home'?APP_NAME:t(SCREENS[route]?.title||'Study');},
  tab(route){return t(SCREENS[route].tab);},
  render(route,el){
   if(route==='retest'){context.quizBackRoute='wrong';context.quizReview=null;}
   if(isQuizScreen(route)){context.quizBackRoute=context.activeRoute==='wrong'?'wrong':'home';if(context.activeRoute!=='wrong')context.quizReview=null;}
   if(route!=='retest'&&context.activeRoute==='retest')context.retestSession=null;
   context.activeRoute=route;return (renderers[route]||renderers.home)(el,context);
  },
  stop:stopMedia,
 };
}
