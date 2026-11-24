import {renderVocabularyView} from '../../../../js/shared/vocabulary-view.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {showQuizBurst,showStatusSheet,posGroupIdsForWord,wordlistCombinedFilterMarkup,filterByStudyStatus,filterByPosTag} from '../components.js';
import {TTS} from '../services/tts.js';
import {Store} from '../services/store.js';
import {createVocabularyPool,vocabularyAnswerCorrect,snapshotVocabularyQuestion} from '../services/vocabulary-tests.js';
import {Haptic} from '../services/haptic.js';
import {Pinyin} from '../services/pinyin.js';
import {recordAnswer} from '../services/srs.js';
import {t} from '../services/i18n.js';
export function renderVocabularyTest(el,mode,session={}){
 const pool=Store.activeWords;
 return renderVocabularyView(el,{
  mode,language:'zh',inputLanguage:'zh-CN',locale:()=>Store.uiLang,
  labels:{title:t('mode_'+mode),listen:t('listenWord'),answer:t('yourAnswer'),correct:t('retestCorrect'),incorrect:t('retestIncorrect'),submit:t('submit'),skip:t('skip'),next:t('nextQ'),empty:t('vocabEmpty'),audioError:t('chineseSpeechUnavailable')},
  words:({status,pos})=>filterByStudyStatus(filterByPosTag(pool,pos),status),
  createPool:(words,locale)=>createVocabularyPool(mode,words,locale,'vocabulary',{meaningWords:Store.words}),
  filters:({status,pos})=>wordlistCombinedFilterMarkup(filterByPosTag(pool,pos),status,filterByStudyStatus(pool,status),pos),
  answerCorrect:vocabularyAnswerCorrect,renderPrompt:q=>e(mode==='vocabinput'||q.collocationId?q.prompt:q.word.hanzi),renderAnswer:q=>q.collocationId?e(q.answer):Pinyin.htmlMarkedColumns(q.word.syllables),
  learning:q=>({fallbackWord:Store.words.find(word=>word.id===q.word.id)}),
  openDetails:(q,options)=>showStatusSheet(q.word.id,undefined,q.word,options),
  spokenWord:q=>q.collocationId?q.phrase:q.word.hanzi,speak:(text,onError)=>TTS.speak(text,()=>{},onError),stopAudio:()=>TTS.stop(),
  record:(q,_input,correct,{displayInput})=>{recordAnswer(correct);if(!correct&&!session.question)Store.addWrong({mode,wordId:q.word.id,wordHanzi:q.word.hanzi,hskLevel:q.word.hskLevel,posGroups:posGroupIdsForWord(q.word),userAnswer:displayInput,correctAnswer:q.answer,question:snapshotVocabularyQuestion(q)});},
  feedback:correct=>{showQuizBurst(correct);correct?Haptic.success():Haptic.error();},
 },session);
}
export const renderWordInput=(el,session)=>renderVocabularyTest(el,'vocabinput',session);
export const renderMeaningQuiz=(el,session)=>renderVocabularyTest(el,'vocabmeaning',session);
