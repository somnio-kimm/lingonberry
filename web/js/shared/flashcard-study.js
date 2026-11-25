import {createFlashcardSession,readFlashcardSetSize,saveFlashcardSetSize} from './flashcard-session.js';
import {readHeadwordIdentity} from './headwords.js';
import {renderLexiconFlashcards} from './lexicon-flashcard-view.js';
import {selectSenseExamples} from './word-example.js';

/** The shared study lifecycle. Each presentation still supplies its pool and progress writes. */
export function createFlashcardStudy(readStatus){
 const session=createFlashcardSession({readStatus,readIdentity:readHeadwordIdentity});
 let scope,flipped=false;

 function reset(){
  scope=undefined;
  flipped=false;
  session.begin([],{resetSeen:true});
 }

 function render(host,{
  selection,readPool,readMeaning=word=>word.studyMeaning,redraw,saveStatus,
  haptic,onMove,onMark,bindFilters,openWord,speakWord,speakExample,...view
 }){
  const size=readFlashcardSetSize();
  const pool=readPool();
  const nextScope=JSON.stringify([selection.level,selection.pos,selection.status,size]);
  if(scope===nextScope){
   session.reconcile(pool);
  }else{
   scope=nextScope;
   session.begin(pool,{size,resetSeen:true});
   flipped=false;
  }

  const word=session.current;
  const meaning=word&&readMeaning(word);
  const examples=word?selectSenseExamples(word,view.language,meaning):[];
  const displayedWord=word&&meaning!==word.studyMeaning?{...word,studyMeaning:meaning}:word;

  function nextSet(){
   session.begin(readPool(),{size});
   flipped=false;
   redraw();
  }

  function reviewLearning(){
   session.reviewLearning();
   flipped=false;
   redraw();
  }

  return renderLexiconFlashcards(host,{
   ...view,word:displayedWord,examples,flipped,total:session.total,index:session.index,
   completed:session.completed,setSize:size,phase:session.phase,summary:session.summary,
   learningCount:session.learningCount,canStartNext:pool.length>0,
  },{
   bindFilters,
   resize(value){
    saveFlashcardSetSize(value);
    reset();
    redraw();
   },
   nextSet,reviewLearning,
   shuffle(){
    if(selection.status==='mastered'||!session.learningCount)nextSet();
    else reviewLearning();
   },
   flip(){
    flipped=!flipped;
    haptic?.();
    return flipped;
   },
   move(direction){
    session.move(direction);
    flipped=false;
    onMove?.();
    redraw();
   },
   mark(status){
    if(!word)return;
    if(saveStatus(word,status)!==false){
     session.mark(status);
     flipped=false;
     haptic?.();
     onMark?.();
    }
    redraw();
   },
   openWord:()=>openWord(word),
   speakWord:()=>speakWord(word),
   speakExample,
  });
 }

 return {render,reset};
}
