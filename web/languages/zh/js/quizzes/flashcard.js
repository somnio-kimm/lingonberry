import {headwordsForInventory,readWordSenses} from '../../../../js/shared/headwords.js';
import {createFlashcardStudy} from '../../../../js/shared/flashcard-study.js';
import {Store} from '../services/store.js';
import {Pinyin} from '../services/pinyin.js';
import {TTS} from '../services/tts.js';
import {Haptic} from '../services/haptic.js';
import {showStatusSheet,hskBandLabel,chineseHeadwordTypes,chineseHeadwordStatus,wordlistCombinedFilterMarkup,filterByStudyStatus,filterByPosTag} from '../components.js';
import {wordMeaning,sentenceMeaning} from '../services/i18n.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';

const states=new WeakMap();
export function renderFlashcard(el){
 const source=Store.words,level=Store.hskLevels[0];
 let state=states.get(source);
 if(!state||state.level!==level){
  state={level,pos:'all',status:'all',open:false,study:createFlashcardStudy(chineseHeadwordStatus)};
  states.set(source,state);
 }
 const headwords=headwordsForInventory(source);
 const readPool=()=>headwords.group(filterByPosTag(filterByStudyStatus(Store.activeWords,state.status),state.pos));
 let cleanup,warning='';

 function bindFilters(host){
  const fold=host.querySelector('.filter-fold');
  fold.ontoggle=()=>{state.open=fold.open;};
  for(const [attr,key]of [['data-f','status'],['data-tag','pos']]){
   host.querySelectorAll(`[${attr}]`).forEach(button=>button.onclick=()=>{
    state[key]=decodeURIComponent(button.getAttribute(attr));
    state.study.reset();
    Haptic.light();
    draw();
   });
  }
 }

 function saveStatus(word,status){
  const senses=readWordSenses(word);
  const previous=senses.map(sense=>({...sense.srs}));
  try{
   for(const sense of senses)Store.updateWord(sense.id,current=>{
    current.srs.level=status==='mastered'?5:2;
    current.srs.nextReview=Date.now();
   });
   warning='';
  }catch{
   senses.forEach((sense,index)=>Object.assign(sense.srs,previous[index]));
   warning=Store.uiLang==='ko'?'학습 상태를 저장하지 못했어요.':'Could not save study status.';
   return false;
  }
 }

 function draw(){
  cleanup?.();
  const active=Store.activeWords;
  cleanup=state.study.render(el,{
   selection:state,readPool,redraw:draw,saveStatus,
   haptic:Haptic.light,onMove:Haptic.light,
   locale:Store.uiLang,language:'zh',readMeaning:wordMeaning,readTranslation:sentenceMeaning,
   filters:wordlistCombinedFilterMarkup(filterByPosTag(active,state.pos),state.status,filterByStudyStatus(active,state.status),state.pos,active,state.open,{},true),
   bindFilters,
   renderHeading:word=>`<span class="py-per-char--fc">${Pinyin.htmlMarkedColumns(word.syllables)}</span>`,
   renderTags:word=>`<span class="detail-badge detail-badge-hsk">${e(hskBandLabel(word.hskLevel))}</span>${chineseHeadwordTypes(word).map(label=>`<span class="detail-badge detail-badge-pos">${e(label)}</span>`).join('')}`,
   renderExample:example=>Pinyin.htmlSentence(example),
   warning,
   openWord:word=>showStatusSheet(word.id,draw,word),
   speakWord:word=>TTS.speak(word.hanzi),
   speakExample:text=>TTS.speak(text),
  });
 }

 draw();
 return()=>{cleanup?.();TTS.stop();};
}
