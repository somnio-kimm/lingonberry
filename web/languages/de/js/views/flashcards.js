import {studyLevelLabel} from '../app-definition.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {createFlashcardSession,readFlashcardSetSize,saveFlashcardSetSize} from '../../../../js/shared/flashcard-session.js';
import {renderLexiconFlashcards} from '../../../../js/shared/lexicon-flashcard-view.js';
import {wordMeaning,sentenceMeaning,t,getLocale} from '../core/i18n.js';
import {studyWords,wordHeading,filterStudyStatus} from '../core/words.js';
import {studyFilterMarkup,typeLabel,createStudyControls} from './study-components.js';
import {speakGerman} from '../core/media.js';
export function renderFlashcards(el,ctx){
 const level=ctx.store.state.preferences.studyLevel;
 if(!ctx.flashcardState||ctx.flashcardState.source!==ctx.words||ctx.flashcardState.level!==level)ctx.flashcardState={source:ctx.words,level,pos:'all',status:'all',open:false,key:'',flipped:false,exampleIndex:0,session:createFlashcardSession({readStatus:word=>ctx.store.wordStatus(word.id)})};
 const state=ctx.flashcardState,session=state.session,controls=createStudyControls(el,ctx);let cleanup;
 const readPool=()=>filterStudyStatus(studyWords(ctx.words,level,{pos:state.pos}),ctx.store,state.status);
 function draw(){
  cleanup?.();state.size=readFlashcardSetSize();const pool=readPool(),key=JSON.stringify([state.pos,state.status,state.size]);
  if(state.key!==key){state.key=key;session.begin(pool,{size:state.size,resetSeen:true});state.flipped=false;state.exampleIndex=0;}else session.reconcile(pool);
  const word=session.current,examples=(word?.examples||[]).map(example=>({word,example:{...example,text:example.de,studyTranslation:sentenceMeaning(example)}}));state.exampleIndex%=Math.max(1,examples.length);
  const restart=()=>{session.begin(readPool(),{size:state.size});state.flipped=false;state.exampleIndex=0;draw();};
  const repeat=()=>{session.reviewLearning();state.flipped=false;state.exampleIndex=0;draw();};
  cleanup=renderLexiconFlashcards(el,{locale:getLocale(),language:'de',word:word?{...word,studyMeaning:wordMeaning(word)}:undefined,examples,exampleIndex:state.exampleIndex,flipped:state.flipped,total:session.total,index:session.index,completed:session.completed,setSize:state.size,phase:session.phase,summary:session.summary,learningCount:session.learningCount,canStartNext:pool.length>0,filters:studyFilterMarkup(studyWords(ctx.words,level),ctx.store,state.status,state.pos,state.open),renderHeading:wordHeading,renderTags:word=>`<span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(word.cefr))}</span><span class="detail-badge detail-badge-pos">${e(typeLabel(word))}</span>`,renderExample:example=>`<div class="example-sentence" lang="de">${e(example.de)}</div>`,warning:ctx.store.warning?t(ctx.store.warning):''},{
   bindFilters:host=>{const fold=host.querySelector('.filter-fold');fold.ontoggle=()=>{state.open=fold.open;};for(const [attr,key]of [['data-f','status'],['data-tag','pos']])host.querySelectorAll(`[${attr}]`).forEach(button=>button.onclick=()=>{state[key]=button.getAttribute(attr);state.key='';ctx.haptic();draw();});},
   resize:value=>{saveFlashcardSetSize(value);state.key='';draw();},nextSet:restart,reviewLearning:repeat,shuffle:()=>{if(state.status==='mastered'||!session.learningCount)restart();else repeat();},flip:()=>{state.flipped=!state.flipped;ctx.haptic();return state.flipped;},move:direction=>{session.move(direction);state.flipped=false;state.exampleIndex=0;ctx.haptic();draw();},moveExample:direction=>{state.exampleIndex=(state.exampleIndex+direction+examples.length)%examples.length;return state.exampleIndex;},mark:status=>{if(!word)return;ctx.store.setWordStatus(word.id,status);session.mark(status);state.flipped=false;state.exampleIndex=0;ctx.haptic();ctx.updateStatus();draw();},openWord:()=>controls.open(word,draw),speakWord:()=>controls.speak(word),speakExample:()=>speakGerman(examples[state.exampleIndex].example.de),
  });
 }
 draw();return()=>{cleanup?.();controls.cleanup();};
}
