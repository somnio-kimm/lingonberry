import {hasClozeTranslationTarget,preferAlignedCloze} from '../../../../js/shared/cloze-translation.js';
import {readQuestionTranslationFocus} from '../../../../js/shared/translation-focus.js';
import {createQuestionRotation,sentenceQuestionKey} from '../../../../js/shared/question-rotation.js';
import {renderLexiconSentence} from '../../../../js/shared/lexicon-sentence-view.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {findSentenceTarget,practiceSentences} from '../services/sentence-focus.js';
import {createSentenceFilters} from '../services/sentence-filters.js';
import { clozeWordOptions,clozeStudyWords } from '../services/vocabulary-tests.js';
import { showQuizBurst, showStatusSheet } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { posGroupIdsForWord } from '../components.js';
import { t, sentenceMeaning, wordMeaning } from '../services/i18n.js';

export function renderClozeQuiz(el,session={}) {
  const words = session.question?Store.words.filter(w=>w.hskLevel===session.question.word.hskLevel):Store.activeWords;
  const withSentences = session.question?[session.question.word]:clozeStudyWords(words);
  const rowsByWord=new WeakMap();
  function sentenceRows(word){
    if(!rowsByWord.has(word))rowsByWord.set(word,practiceSentences(word,{cloze:true}).map((sentence,index)=>{
      const row={id:word.id+':'+index,word,sentence};
      return {...row,aligned:hasClozeTranslationTarget({...row,example:sentence},sentenceMeaning(sentence),'zh',word.studyExplanationLanguage||Store.uiLang)};
    }));
    return rowsByWord.get(word);
  }
  let word, sentence, blank, options, feedback = '', userAnswer = '',rotation,rotationWords=[],alive=true,childCleanup=()=>{};

  const filters=createSentenceFilters(withSentences,session,()=>{TTS.stop();newQ();});

  function newQ() {
    if(!alive)return;
    if(session.onNext&&word){session.onNext();return;}
    if(session.question){word=session.question.word;sentence=session.question.sentence;}
    else{
      const eligible=filters.pool();
      if(!rotation||rotationWords.length!==eligible.length||eligible.some((item,index)=>item!==rotationWords[index])){rotationWords=eligible.slice();rotation=createQuestionRotation(preferAlignedCloze(eligible.flatMap(sentenceRows),row=>row.aligned),{key:row=>sentenceQuestionKey(row.sentence.hanzi,row.word.hanzi)});}
      const selected=rotation.choose();word=selected?.word;sentence=selected?.sentence;
    }
    if(!word){feedback='';draw();return;}
    blank = word.hanzi;
    options = clozeWordOptions(word, words);
    feedback = ''; userAnswer = '';
    draw();
  }

  function choose(opt) {
    if (!alive||feedback) return;
    userAnswer = opt;
    if (opt === blank) {
      feedback = 'correct'; Haptic.success();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      if(!session.question)Store.addWrong({
        mode: 'cloze', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: opt, correctAnswer: blank,question:snapshotQuestion('cloze',word,sentence),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(feedback==='correct',userAnswer);
    draw();
  }

  function draw() {
    if(!alive)return;childCleanup();
    el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t('mode_cloze')}</div></div>${filters.markup()}<div data-sentence-body></div>`;filters.bind(el);const host=el.querySelector('[data-sentence-body]');
    if(!word){host.innerHTML=`<section class="card empty-wrong quiz-after-filter"><p>${t('noWordsFilter')}</p></section>`;return;}
    const focus=findSentenceTarget(sentence,blank),view={mode:'cloze',word,locale:word.studyExplanationLanguage||Store.uiLang,sentence:sentence.hanzi,example:sentence,answer:blank,focus:focus||{start:0,text:blank},translationFocus:readQuestionTranslationFocus(session.question,sentence),correctOption:blank,options:options.map(option=>({id:option.hanzi,text:option.hanzi,meaning:wordMeaning(option),word:option}))};
    const text=key=>t({'Show Reading':'showPinyin','Skip':'skip','Next':'nextQ'}[key]||key);
    childCleanup=renderLexiconSentence(host,{question:view,feedback,selectedOption:userAnswer,chosenTokens:[],showReading:Store.clozeShowPinyin,showTranslation:true,translationVisible:true,translation:sentenceMeaning(sentence),t:text},{
      language:'zh',uiLanguage:Store.uiLang,reading:true,renderSentence:e,
      renderCloze:({checked,showReading})=>showReading?Pinyin.htmlSentence(sentence,{blank:checked?'':blank,highlight:checked?blank:''}):!focus?e(sentence.hanzi):undefined,
      openDetails:(word,options)=>showStatusSheet(word.id,undefined,word,options),
      renderOption:option=>Pinyin.htmlMarkedColumns(option.word.syllables),select:choose,
      toggleReading:value=>{Store.clozeShowPinyin=value;Haptic.light();draw();},skip:()=>{Haptic.light();session.onSkip?session.onSkip():newQ();},next:newQ,
    });
  }
  newQ();return()=>{alive=false;childCleanup();TTS.stop();};
}
