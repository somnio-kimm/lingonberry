import {escapeHtml as e} from '../../../../js/shared/ui.js';
import { LISTENING_MODES } from '../services/listening-tests.js';
import { TTS } from '../services/tts.js';
import { vocabularyReview,localizedReviewAnswer } from '../services/vocabulary-review.js';
import { Store } from '../services/store.js';
import { wordPosGroupDisplay,modeTitle,showStatusSheet,wrongBookCombinedFilterMarkup,posGroupIdsForWord } from '../components.js';
import { parseHskLevelFromWordId,loadHskLevels } from '../services/vocabulary.js';
import { Pinyin } from '../services/pinyin.js';
import { Haptic } from '../services/haptic.js';
import { t,sentenceMeaning,wordMeaning } from '../services/i18n.js';
import { navigate } from '../router.js';
import { resolveWrongQuestion,wrongAnswerCount,expectedSyllables,characterDifferences,makeReviewQueue } from '../services/wrong-review.js';
import { reviewState } from './retest.js';
const levelOf=r=>r.hskLevel||parseHskLevelFromWordId(r.wordId);
function groupsOf(r){if(r.posGroups?.length)return r.posGroups;const word=Store.words.find(w=>w.id===r.wordId);return word?posGroupIdsForWord(word):[];}
export function filteredWrongs(rows,{level='all',tag='all',mode='all'}={}){return rows.filter(r=>(level==='all'||levelOf(r)===Number(level))&&(tag==='all'||groupsOf(r).includes(tag))&&(mode==='all'||r.mode===mode));}
function vocabReview(record,q){
 return vocabularyReview({mode:record.mode,question:q||record.question,word:Store.words.find(w=>w.id===record.wordId),locale:Store.uiLang,correctAnswer:record.correctAnswer,userAnswer:record.userAnswer});
}
function details(record,q){
 const normalized=value=>String(value??'').normalize('NFC').trim().replace(/\s+/gu,' ');
 const word=Store.words.find(w=>w.id===record.wordId)||q?.word||record.question?.word;
 const headword=word?.hanzi||record.wordHanzi;
 const answer=LISTENING_MODES.includes(record.mode)?q?.answer||record.correctAnswer:record.correctAnswer;
 const duplicate=!!headword&&normalized(answer)===normalized(headword);
 let condition='',correct=e(record.correctAnswer),given=`<del class='wrong-token'>${e(record.userAnswer)||'—'}</del>`,answerLang='zh';
 if(LISTENING_MODES.includes(record.mode)){
  correct=e(q?.answer||record.correctAnswer);
 }else if(['vocabmeaning','vocabinput','pinyin','tone'].includes(record.mode)){
  const selected=record.mode==='vocabmeaning'?localizedReviewAnswer(vocabReview(record,q),Store.uiLang,id=>Store.words.find(w=>w.id===id)):null;
  const lang=selected?.locale||(['pinyin','tone'].includes(record.mode)?'zh-Latn':'zh');
  const answer=selected?selected.text:['pinyin','tone'].includes(record.mode)?Pinyin.convertLive(record.userAnswer||''):record.userAnswer;
  return `<p class='wrong-line wrong-answer-row wrong-only'><span class='wrong-answer-label'>${t('wrongUserAnswer')}:</span> <span class='wrong-answer-value--wrong' lang='${lang}'><del>${e(answer)||'—'}</del></span></p>`;
 }else if(record.mode==='cloze'){
  const sentence=q?.sentence,blank=record.correctAnswer,start=q?.blankStart??sentence?.hanzi.indexOf(blank);
  const question=sentence&&!q.originalMissing&&start>=0?`${e(sentence.hanzi.slice(0,start))}<span class='wrong-test-slot wrong-test-blank' role='img' aria-label='${t('wrongPartCloze')}'></span>${e(sentence.hanzi.slice(start+blank.length))}`:`<span class='wrong-details-note'>${t('wrongOriginalMissing')}</span>`;
  condition=`<div class='wrong-question' lang='zh'>${question}</div>${sentence&&!q.originalMissing?`<p class='wrong-translation'>${e(sentenceMeaning(sentence))}</p>`:''}`;
 }else{
  const diff=characterDifferences(record.correctAnswer,record.userAnswer),marked=(tokens,bad)=>tokens.map((c,i)=>diff.positions.includes(i)?bad?`<del class='wrong-token'>${e(c)}</del>`:`<mark class='wrong-target'>${e(c)}</mark>`:e(c)).join('');
  correct=marked(diff.expected,false);given=marked(diff.actual,true)||'—';
  if(q?.sentence)condition=`<p class='wrong-translation'>${e(sentenceMeaning(q.sentence))}</p>`;
 }
 return `${condition?['vocabinput','vocabmeaning'].includes(record.mode)?condition:`<div class='wrong-question-block'>${condition}</div>`:''}${duplicate?'':`<p class='wrong-line wrong-answer-row'><span class='wrong-answer-label'>${t('wrongCorrectAnswer')}:</span> <span class='wrong-correct' lang='${answerLang}'>${correct}</span></p>`}<p class='wrong-line wrong-answer-row'><span class='wrong-answer-label'>${t('wrongUserAnswer')}:</span> <span class='wrong-answer-value--wrong' lang='${answerLang}'>${given}</span></p>`;
}
export function renderWrong(el){
 const filters=reviewState.filters;if(![1,2,3,4,5,6,7].includes(Number(filters.level)))filters.level=String(Store.hskLevels[0]||1);let alive=true,loading=true,error='';
 function draw(){
  if(!alive)return;TTS.stop();
  const all=Store.wrongAnswers,rows=filteredWrongs(all,filters),queue=makeReviewQueue(rows,Store.words);
  const block=all.length?wrongBookCombinedFilterMarkup(filteredWrongs(all,{...filters,level:'all'}),filters.level,filteredWrongs(all,{...filters,tag:'all'}),filters.tag,{levelOf,groupsOf,showMode:true,modeFilter:filters.mode,forModeRow:filteredWrongs(all,{...filters,mode:'all'})}):'';
  el.innerHTML=`<div class='wrong-heading'><div class='section-title'>${t('wrongBook')} (${rows.length}${rows.length!==all.length?' / '+all.length:''})</div>${all.length?`<button id='clear-wrong' class='btn-small' style='color:var(--red)'>${t('clearAll')}</button>`:''}</div>${block}${all.length?`<button class='btn-primary wrong-retest' id='retest-filtered' ${loading||!queue.items.length?'disabled':''}>${t('retestFiltered')} (${queue.items.length})</button>${error?`<p class='wrong-details-note'>${e(error)}</p>`:''}${!loading&&queue.unavailable.length?`<p class='wrong-details-note'>${queue.unavailable.length} · ${t('retestUnavailable')}</p>`:''}`:''}<div class='wrong-results'>${!rows.length?`<section class='card empty-wrong'><div aria-hidden='true'>${all.length?'🔎':'🎉'}</div><h2>${t(all.length?'noWrongForFilters':'noWrongYet')}</h2><p>${t(all.length?'wrongFilterHint':'wrongReviewHint')}</p></section>`:rows.map((record,i)=>{const q=resolveWrongQuestion(record,Store.words),word=Store.words.find(w=>w.id===record.wordId)||q?.word||record.question?.word,syllables=expectedSyllables(record,word);return `<section class='card wrong-item' data-id='${e(record.id)}' data-open-word='${i}' role='button' tabindex='0'><div class='wrong-card-heading'><div class='wrong-card-tags'><span class='badge wrong-mode'>${modeTitle(record.mode)}</span>${word?`<span class='badge wrong-pos'>${e(wordPosGroupDisplay(word))}</span>`:''}<span class='badge wrong-level'>${levelOf(record)===7?'HSK 7–9':'HSK '+levelOf(record)}</span></div><div class='wrong-card-actions'><span class='wrong-count'>${t('wrongCount')}: ${wrongAnswerCount(record)}</span><button class='del-wrong' data-dismiss='${i}' aria-label='${t('deleteAria')}'>×</button></div></div><div class='wrong-main-word wrong-hanzi-word'>${syllables.length?`${Pinyin.htmlMarkedColumns(syllables)}`:e(record.wordHanzi||word?.hanzi||'')}</div><p class='wrong-word-meaning' lang='${Store.uiLang}'>${e((['vocabinput','vocabmeaning'].includes(record.mode)?vocabReview(record,q).meaning:wordMeaning(q?.word||Store.words.find(w=>w.id===record.wordId)))||t('wordTranslationMissing'))}</p><div class="review-answer-details">${details(record,q)}</div></section>`;}).join('')}</div>`;
  const fold=el.querySelector('.filter-fold');if(fold){fold.open=filters.open;fold.ontoggle=()=>{filters.open=fold.open;};}
  for(const [attr,key] of [['data-wlv','level'],['data-wtag','tag'],['data-wmode','mode']])el.querySelectorAll('['+attr+']').forEach(b=>b.onclick=()=>{filters[key]=decodeURIComponent(b.getAttribute(attr));Haptic.light();draw();});
  el.querySelector('#clear-wrong')?.addEventListener('click',()=>{if(!confirm(t('confirmClearWrong')))return;Store.clearWrong();draw();});
  el.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>{Store.deleteWrong(rows[Number(b.dataset.dismiss)].id);draw();});
  el.querySelectorAll('[data-open-word]').forEach(card=>{const open=()=>{const r=rows[Number(card.dataset.openWord)],q=resolveWrongQuestion(r,Store.words),word=Store.words.find(w=>w.id===r.wordId)||Store.words.find(w=>w.hanzi===r.wordHanzi)||q?.word;if(word){card.focus({preventScroll:true});Haptic.light();showStatusSheet(word.id,undefined,word);}};card.onclick=event=>{if(!event.target.closest('button,a,input,select,summary'))open();};card.onkeydown=event=>{if(event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();open();}};});
  const start=entries=>{const batch=makeReviewQueue(entries,Store.words);if(!batch.items.length)return;reviewState.session=batch;Haptic.light();navigate('retest',{title:t('retestTitle')});};
  el.querySelector('#retest-filtered')?.addEventListener('click',()=>start(rows));
 }
 draw();const levels=[...new Set(Store.wrongAnswers.map(levelOf).filter(Boolean))];loadHskLevels(levels).then(()=>{loading=false;draw();}).catch(()=>{loading=false;error=t('vocabLoadError');draw();});return()=>{alive=false;TTS.stop();};
}
