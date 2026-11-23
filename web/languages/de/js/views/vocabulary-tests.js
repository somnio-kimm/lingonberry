import {renderVocabularyView} from '../../../../js/shared/vocabulary-view.js';
import {speakGerman,stopMedia} from '../core/media.js';
import {escapeHtml as e,showQuizBurst} from '../../../../js/shared/ui.js';
import {t,getLocale} from '../core/i18n.js';
import {studyWords,filterStudyStatus,wordHeading} from '../core/words.js';
import {createVocabularyPool,vocabularyAnswerCorrect,vocabularyExpectedAnswer} from '../core/vocabulary-tests.js';
import {studyFilterMarkup} from './study-components.js';
export function renderVocabularyTest(el,ctx,mode,session={}){
 const level=ctx.store.state.preferences.studyLevel,pool=studyWords(ctx.words,level);
 return renderVocabularyView(el,{
  mode,language:'de',locale:getLocale,
  labels:{title:t(mode==='vocabinput'?'Word input':'Meaning quiz'),listen:t('Listen to word'),answer:t('Your answer'),correct:t('Correct'),incorrect:t('Incorrect'),submit:t('Submit'),skip:t('Skip'),next:t('Next'),empty:t('Not enough vocabulary matches these filters. Meaning options must share the same word type.'),audioError:t('German speech is unavailable. Download a German voice in the phone’s speech settings.')},
  words:({status,pos})=>filterStudyStatus(studyWords(pool,level,{pos}),ctx.store,status),
  createPool:(words,locale)=>createVocabularyPool(mode,words,locale,'vocabulary',{meaningWords:ctx.words}),
  filters:({status,pos,open})=>studyFilterMarkup(pool,ctx.store,status,pos,open),
  answerCorrect:vocabularyAnswerCorrect,renderPrompt:q=>mode==='vocabinput'||q.collocationId?e(q.prompt):wordHeading(q.word),renderAnswer:q=>e(vocabularyExpectedAnswer(q)),
  learning:q=>({fallbackWord:ctx.words.find(word=>word.id===q.word.id),renderWord:wordHeading}),
  spokenWord:q=>q.collocationId?q.phrase:q.word.pos==='noun'&&q.word.article?q.word.article+' '+q.word.lemma:q.word.lemma,
  speak:(text,onError)=>speakGerman(text,()=>{},onError),stopAudio:stopMedia,
  record:(q,_input,correct,{displayInput})=>ctx.store.recordQuizAnswer(mode,q,displayInput,correct,{review:!!session.question}),
  feedback:correct=>{showQuizBurst(correct);ctx.haptic();},update:()=>ctx.updateStatus(),
 },session);
}
export const renderWordInput=(el,ctx,session)=>renderVocabularyTest(el,ctx,'vocabinput',session);
export const renderMeaningQuiz=(el,ctx,session)=>renderVocabularyTest(el,ctx,'vocabmeaning',session);
