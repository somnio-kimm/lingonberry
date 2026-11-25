import {headwordsForInventory,readWordSenses} from '../../../../js/shared/headwords.js';
import {createFlashcardStudy} from '../../../../js/shared/flashcard-study.js';
import {studyLevelLabel} from '../app-definition.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {wordMeaning,sentenceMeaning,t,getLocale} from '../core/i18n.js';
import {studyWords,wordHeading,filterStudyStatus} from '../core/words.js';
import {studyFilterMarkup,headwordTypeLabels,germanHeadwordStatus,createStudyControls} from './study-components.js';
import {speakGerman} from '../core/media.js';

export function renderFlashcards(el,ctx){
 const level=ctx.store.state.preferences.studyLevel;
 if(!ctx.flashcardState||ctx.flashcardState.source!==ctx.words||ctx.flashcardState.level!==level){
  ctx.flashcardState={
   source:ctx.words,level,pos:'all',status:'all',open:false,
   study:createFlashcardStudy(word=>germanHeadwordStatus(word,ctx.store)),
  };
 }
 const state=ctx.flashcardState,controls=createStudyControls(el,ctx);
 const headwords=headwordsForInventory(ctx.words);
 const readPool=()=>headwords.group(filterStudyStatus(studyWords(ctx.words,level,{pos:state.pos}),ctx.store,state.status));
 let cleanup;

 function bindFilters(host){
  const fold=host.querySelector('.filter-fold');
  fold.ontoggle=()=>{state.open=fold.open;};
  for(const [attr,key]of [['data-f','status'],['data-tag','pos']]){
   host.querySelectorAll(`[${attr}]`).forEach(button=>button.onclick=()=>{
    state[key]=button.getAttribute(attr);
    state.study.reset();
    ctx.haptic();
    draw();
   });
  }
 }

 function draw(){
  cleanup?.();
  cleanup=state.study.render(el,{
   selection:state,readPool,redraw:draw,
   haptic:ctx.haptic,onMove:ctx.haptic,onMark:ctx.updateStatus,
   saveStatus(word,status){
    for(const sense of readWordSenses(word))ctx.store.setWordStatus(sense.id,status);
   },
   locale:getLocale(),language:'de',readMeaning:wordMeaning,readTranslation:sentenceMeaning,
   filters:studyFilterMarkup(studyWords(ctx.words,level),ctx.store,state.status,state.pos,state.open,'',{},true),
   bindFilters,
   renderHeading:wordHeading,
   renderTags:word=>`<span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(word.cefr))}</span>${headwordTypeLabels(word).map(label=>`<span class="detail-badge detail-badge-pos">${e(label)}</span>`).join('')}`,
   renderExample:example=>`<div class="example-sentence" lang="de">${e(example.de)}</div>`,
   warning:ctx.store.warning?t(ctx.store.warning):'',
   openWord:word=>controls.open(word,draw),
   speakWord:controls.speak,
   speakExample:speakGerman,
  });
 }

 draw();
 return()=>{cleanup?.();controls.cleanup();};
}
