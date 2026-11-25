import {headwordsForInventory,readHeadwordIdentity,readWordSenses} from '../../../../js/shared/headwords.js';
import {selectSenseExamples} from '../../../../js/shared/word-example.js';
import {renderStudyUsageLabel} from '../../../../js/shared/study-components.js';
import {Store} from '../services/store.js';
import {Pinyin} from '../services/pinyin.js';
import {TTS} from '../services/tts.js';
import {Haptic} from '../services/haptic.js';
import {showStatusSheet,hskBandLabel,wordPosGroupDisplay,chineseHeadwordTypes,chineseHeadwordStatus,wordlistCombinedFilterMarkup,filterByStudyStatus,filterByPosTag} from '../components.js';
import {wordMeaning,sentenceMeaning} from '../services/i18n.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {createFlashcardSession,readFlashcardSetSize,saveFlashcardSetSize} from '../../../../js/shared/flashcard-session.js';
import {renderLexiconFlashcards} from '../../../../js/shared/lexicon-flashcard-view.js';
const states=new WeakMap();
export function renderFlashcard(el){
 const source=Store.words,level=Store.hskLevels[0];let state=states.get(source);
 if(!state||state.level!==level){state={level,pos:'all',status:'all',open:false,key:'',flipped:false,exampleIndex:0,session:createFlashcardSession({readStatus:chineseHeadwordStatus,readIdentity:readHeadwordIdentity})};states.set(source,state);}
 const session=state.session;let cleanup,warning='';
 const headwords=headwordsForInventory(source);
 const readPool=()=>headwords.group(filterByPosTag(filterByStudyStatus(Store.activeWords,state.status),state.pos));
 function draw(){
  cleanup?.();state.size=readFlashcardSetSize();const pool=readPool(),key=JSON.stringify([state.pos,state.status,state.size]);
  if(state.key!==key){state.key=key;session.begin(pool,{size:state.size,resetSeen:true});state.flipped=false;state.exampleIndex=0;}else session.reconcile(pool);
  const word=session.current,examples=word?selectSenseExamples(word,'zh').map(row=>({...row,example:row.example?{...row.example,studyTranslation:sentenceMeaning(row.example)}:undefined})):[];state.exampleIndex%=Math.max(1,examples.length);
  const restart=()=>{session.begin(readPool(),{size:state.size});state.flipped=false;state.exampleIndex=0;draw();};
  const repeat=()=>{session.reviewLearning();state.flipped=false;state.exampleIndex=0;draw();};
  const active=Store.activeWords;
  cleanup=renderLexiconFlashcards(el,{locale:Store.uiLang,language:'zh',word:word?{...word,studyMeaning:wordMeaning(word)}:undefined,examples,exampleIndex:state.exampleIndex,flipped:state.flipped,total:session.total,index:session.index,completed:session.completed,setSize:state.size,phase:session.phase,summary:session.summary,learningCount:session.learningCount,canStartNext:pool.length>0,filters:wordlistCombinedFilterMarkup(filterByPosTag(active,state.pos),state.status,filterByStudyStatus(active,state.status),state.pos,active,state.open,{},true),renderHeading:word=>`<span class="py-per-char--fc">${Pinyin.htmlMarkedColumns(word.syllables)}</span>`,renderTags:word=>`<span class="detail-badge detail-badge-hsk">${e(hskBandLabel(word.hskLevel))}</span>${chineseHeadwordTypes(word).map(label=>`<span class="detail-badge detail-badge-pos">${e(label)}</span>`).join('')}`,renderSenseLabel:sense=>renderStudyUsageLabel(sense,wordPosGroupDisplay(sense),readWordSenses(word).some(item=>item.pronunciation!==word.pronunciation)),renderExample:example=>Pinyin.htmlSentence(example),warning},{
   bindFilters:host=>{const fold=host.querySelector('.filter-fold');fold.ontoggle=()=>{state.open=fold.open;};for(const [attr,key]of [['data-f','status'],['data-tag','pos']])host.querySelectorAll(`[${attr}]`).forEach(button=>button.onclick=()=>{state[key]=decodeURIComponent(button.getAttribute(attr));state.key='';Haptic.light();draw();});},
   resize:value=>{saveFlashcardSetSize(value);state.key='';draw();},nextSet:restart,reviewLearning:repeat,shuffle:()=>{if(state.status==='mastered'||!session.learningCount)restart();else repeat();},flip:()=>{state.flipped=!state.flipped;Haptic.light();return state.flipped;},move:direction=>{session.move(direction);state.flipped=false;state.exampleIndex=0;Haptic.light();draw();},moveExample:direction=>{state.exampleIndex=(state.exampleIndex+direction+examples.length)%examples.length;return state.exampleIndex;},mark:status=>{if(!word)return;const senses=readWordSenses(word),previous=senses.map(sense=>({...sense.srs}));try{for(const sense of senses)Store.updateWord(sense.id,current=>{current.srs.level=status==='mastered'?5:2;current.srs.nextReview=Date.now();});warning='';session.mark(status);state.flipped=false;state.exampleIndex=0;Haptic.light();}catch{senses.forEach((sense,i)=>Object.assign(sense.srs,previous[i]));warning=Store.uiLang==='ko'?'학습 상태를 저장하지 못했어요.':'Could not save study status.';}draw();},openWord:()=>showStatusSheet(word.id,draw,word),speakWord:()=>TTS.speak(word.hanzi),speakExample:()=>TTS.speak(examples[state.exampleIndex].example.text),
  });
 }
 draw();return()=>{cleanup?.();TTS.stop();};
}
