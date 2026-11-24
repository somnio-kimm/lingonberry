import {renderLexiconWordList} from '../../../../js/shared/lexicon-wordlist-view.js';
import {collocationPreview} from '../../../../js/shared/collocation-view.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {Store} from '../services/store.js';
import {Pinyin} from '../services/pinyin.js';
import {TTS} from '../services/tts.js';
import {Haptic} from '../services/haptic.js';
import {matchesWordSearch,wordSearchQuery} from '../services/word-search.js';
import {showStatusSheet,wordlistCombinedFilterMarkup,hskBandLabel,filterByStudyStatus,filterByPosTag,wordPosGroupDisplay} from '../components.js';
import {t,wordMeaning} from '../services/i18n.js';
export function renderWordList(el){
 const active=Store.activeWords,byId=new Map(active.map(word=>[word.id,word]));let status='all',tag='all',search='',open=false;
 const text=key=>t({'Word List':'wordlistTitle','Search':'searchPlaceholder','Speak Word':'listenWord','New':'statusNew','Learning':'statusLearning','Mastered':'statusMastered','Show More Words':'showMoreWords','No Matching Words':'noSearchResults'}[key]||key);
 return renderLexiconWordList(el,{t:text,query:search,language:'zh',locale:Store.uiLang,showCount:true,headingClass:'wl-py-hz',filters:initial=>wordlistCombinedFilterMarkup(filterByPosTag(active,tag),status,filterByStudyStatus(active,status),tag,active,open,initial),getWords:()=>{const query=wordSearchQuery(search);return filterByPosTag(filterByStudyStatus(active,status),tag).filter(word=>matchesWordSearch(word,query));},readStatus:word=>word.srs.level>=5?'mastered':word.srs.level>0?'learning':'new',renderHeading:word=>Pinyin.htmlMarkedColumns(word.syllables),readMeaning:wordMeaning,renderTags:word=>`<span class="wl-tag wl-hsk">${e(hskBandLabel(word.hskLevel))}</span><span class="wl-tag wl-pos">${e(wordPosGroupDisplay(word))}</span>`,renderPreview:collocationPreview},{
  bindFilters:(host,refresh)=>{const fold=host.querySelector('.filter-fold');fold.ontoggle=()=>{if(fold.isConnected)open=fold.open;};host.querySelectorAll('[data-f]').forEach(button=>button.onclick=()=>{status=button.dataset.f;Haptic.light();refresh(true);});host.querySelectorAll('[data-tag]').forEach(button=>button.onclick=()=>{tag=decodeURIComponent(button.dataset.tag);Haptic.light();refresh(true);});},
  setQuery:value=>search=value,openWord:(id,refresh)=>showStatusSheet(id,refresh),speakWord:id=>TTS.speak(byId.get(id).hanzi),
 });
}
