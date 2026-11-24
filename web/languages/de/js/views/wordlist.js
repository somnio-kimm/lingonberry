import {renderLexiconWordList} from '../../../../js/shared/lexicon-wordlist-view.js';
import {collocationPreview} from '../../../../js/shared/collocation-view.js';
import {studyLevelLabel} from '../app-definition.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {t,getLocale,wordMeaning} from '../core/i18n.js';
import {studyWords,wordHeading,filterStudyStatus} from '../core/words.js';
import {studyFilterMarkup,typeLabel,createStudyControls} from './study-components.js';
export function renderWordList(el,ctx){
 const level=ctx.store.state.preferences.studyLevel,pool=studyWords(ctx.words,level),byId=new Map(pool.map(word=>[word.id,word]));
 const state=ctx.wordListState?.level===level?ctx.wordListState:{level,pos:'all',query:'',status:'all'};state.status||='all';ctx.wordListState=state;let open=false;
 const controls=createStudyControls(el,ctx),text=key=>t({'Word List':'Word list','Speak Word':'Speak word','Show More Words':'Show more words','No Matching Words':'No matching words for these filters.'}[key]||key);
 return renderLexiconWordList(el,{t:text,query:state.query,language:'de',locale:getLocale(),showCount:true,filters:initial=>studyFilterMarkup(pool,ctx.store,state.status,state.pos,open,'',initial),getWords:()=>filterStudyStatus(studyWords(pool,level,state),ctx.store,state.status),readStatus:word=>ctx.store.wordStatus(word.id),renderHeading:wordHeading,readMeaning:wordMeaning,renderTags:word=>`<span class="wl-tag wl-hsk">${e(studyLevelLabel(word.cefr))}</span><span class="wl-tag wl-pos">${e(typeLabel(word))}</span>`,renderPreview:collocationPreview},{
  bindFilters:(host,refresh)=>{const fold=host.querySelector('.filter-fold');fold.ontoggle=()=>{if(fold.isConnected)open=fold.open;};for(const [attribute,key]of [['data-f','status'],['data-tag','pos']])host.querySelectorAll('['+attribute+']').forEach(button=>button.onclick=()=>{state[key]=button.getAttribute(attribute);ctx.haptic();refresh(true);});},
  setQuery:value=>state.query=value,openWord:(id,refresh)=>{ctx.haptic();controls.open(byId.get(id),refresh);},speakWord:id=>controls.speak(byId.get(id)),cleanup:controls.cleanup,
 });
}
