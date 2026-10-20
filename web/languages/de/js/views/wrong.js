import { studyLevelLabel } from '../app-definition.js';
import { personLabel,tenseLabel } from '../core/grammar-quizzes.js';
import { NOMINAL_MODES,caseLabel,patternLabel } from '../core/nominal-grammar.js';
import { LISTENING_MODES } from '../core/listening-tests.js';
import { stopMedia } from '../core/media.js';
import { vocabularyReview,localizedReviewAnswer } from '../core/vocabulary-review.js';
import { t,getLocale,sentenceMeaning,wordMeaning } from '../core/i18n.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { wrongEntries,filterWrongEntries,wrongMode } from '../core/wrong.js';
import { reviewCatalog,reviewItems,createRetestSession,modeLabels } from '../core/retest.js';
import { tokenDifferences,clozeStart } from '../core/wrong-detail.js';
import { wordHeading } from '../core/words.js';
import { types } from '../core/word-types.js';
import { createStudyControls, typeLabel } from './study-components.js';
function vocabReview(row){
 return vocabularyReview({mode:row.quizMode,question:row.questionSnapshot,word:row.word,locale:getLocale(),prompt:row.grammarPrompt,example:row.example,questionLocale:row.question.id.match(/:(en|ko)$/)?.[1],correctAnswer:row.question.answer,userAnswer:row.attempt.input});
}
function formDetails(row) {
 const original=row.questionSnapshot||{},context={...row.questionContext,...original},word=original.word||row.word;
 const verb=row.quizMode==='verbforms';
 const conditions=verb?[tenseLabel(context.tense),context.person?personLabel(context.person):'']:[context.case?t(caseLabel(context.case)):'',context.number?t(context.number==='plural'?'Plural':'Singular'):'',context.pattern?t(patternLabel(context.pattern)):''];
 const condition=e(conditions.filter(Boolean).join(' · ')||row.grammarPrompt||t('Original question not available.'));
 const base=row.quizMode==='adjendings'&&original.noun?wordHeading({...original.noun,pos:'noun'}):row.quizMode==='cases'?e(original.base)||(word?wordHeading(word):'—'):e(word?.infinitive||word?.lemma||'—');
 const blank=`<span class='wrong-test-slot wrong-test-blank' role='img' aria-label='${t('Missing word')}'></span>`;
 const at=original.sentence?.indexOf('___')??-1;
 const question=verb&&context.person?`${e(personLabel(context.person))} ${blank}`:at>=0?`${e(original.sentence.slice(0,at))}${blank}${e(original.sentence.slice(at+3))}`:e(t('Original question not available.'));
 const field=(key,label,value,classes='',lang='')=>`<div class='wrong-form-row ${classes}' data-form-detail='${key}'><span class='wrong-form-label'>${t(label)}</span><div class='wrong-form-value'${lang?` lang='${lang}'`:''}>${value}</div></div>`;
 return `<div class='wrong-form-details'>${field('conditions','Conditions',`<span class='wrong-grammar-context'>${condition}</span>`)}${field('base','Base form',base,'','de')}${field('question','Question',`<span class='wrong-question'>${question}</span>`,'','de')}${field('correct','Correct answer',`<span class='correct-answer'>${e(row.question.answer)}</span>`,'wrong-correct-line wrong-answer-row','de')}${field('wrong','Wrong answer',`<del class='wrong-answer-value--wrong'>${e(row.attempt.input)||'—'}</del>`,'wrong-user-line wrong-answer-row','de')}</div>`;
}
function details(row,wordsById) {
 if(['verbforms',...NOMINAL_MODES].includes(row.quizMode))return formDetails(row);
 const q=row.question,mode=row.quizMode,diff=tokenDifferences(q.answer,row.attempt.input);
 const normalized=value=>String(value??'').normalize('NFC').trim().replace(/\s+/gu,' ');
 const word=row.word,answer=LISTENING_MODES.includes(mode)?row.questionSnapshot?.answer||q.answer:q.answer;
 const headwords=word?[word.lemma,word.pos==='noun'&&word.article?word.article+' '+word.lemma:word.lemma]:[];
 const duplicate=headwords.some(text=>text&&normalized(answer)===normalized(text));
 const marked=(tokens,wrong=false)=>tokens.map((token,i)=>diff.positions.includes(i)?wrong?`<del class='wrong-token'>${e(token)}</del>`:`<mark class='wrong-target'>${e(token)}</mark>`:e(token)).join(' ');
 let condition='',correct=e(q.answer),input=`<del class='wrong-token'>${e(row.attempt.input)||'—'}</del>`,answerLang=mode==='vocabmeaning'?row.questionSnapshot?.locale||'en':'de';
 if(LISTENING_MODES.includes(mode)){
  correct=e(row.questionSnapshot?.answer||q.answer);
 }else if(mode==='cloze'){
  const sentence=row.example.de,start=clozeStart(row);
  condition=`<div class='wrong-question' lang='de'>${start>=0?`${e(sentence.slice(0,start))}<span class='wrong-test-slot wrong-test-blank' role='img' aria-label='${t('Missing word')}'></span>${e(sentence.slice(start+q.answer.length))}`:e(sentence)}</div>`;
 }else if(mode==='scramble'){correct=marked(diff.expected);input=marked(diff.actual,true)||'—';}
 else if(mode==='articles'){condition=`<div class='wrong-question' lang='de'><span class='wrong-test-slot'>der / die / das</span> ${e(row.word?.lemma||row.example.de)}</div>`;correct=marked(diff.expected);input=marked(diff.actual,true)||'—';}
 else if(mode==='vocabmeaning'||mode==='vocabinput'){
  if(mode==='vocabmeaning'){const selected=localizedReviewAnswer(vocabReview(row),getLocale(),id=>wordsById.get(id));input=`<del class='wrong-token'>${e(selected.text)||'—'}</del>`;answerLang=selected.locale||getLocale();}
  return `<p class='wrong-user-line wrong-answer-row wrong-only'><span class='wrong-answer-label'>${t('Wrong answer')}:</span> <span class='wrong-answer-value--wrong' lang='${answerLang}'>${input}</span></p>`;
 }
 else condition=`<div class='wrong-question' lang='de'>${e(q.sentence||q.prompt)}</div>`;
 if(row.example&&!['vocabinput','vocabmeaning','articles','verbforms',...LISTENING_MODES,...NOMINAL_MODES].includes(mode))condition+=`<p class='example-translation' lang='${getLocale()}'>${e(sentenceMeaning(row.example))}</p>`;
 return `${condition?['vocabinput','vocabmeaning'].includes(mode)?condition:`<div class='wrong-question-block'>${condition}</div>`:''}${duplicate?'':`<p class='wrong-correct-line wrong-answer-row'><span class='wrong-answer-label'>${t('Correct answer')}:</span> <span class='correct-answer' lang='${answerLang}'>${correct}</span></p>`}<p class='wrong-user-line wrong-answer-row'><span class='wrong-answer-label'>${t('Wrong answer')}:</span> <span class='wrong-answer-value--wrong' lang='${answerLang}'>${input}</span></p>`;
}
export function renderWrong(el,ctx) {
 const controls=createStudyControls(el,ctx),wordsById=new Map(ctx.words.map(word=>[word.id,word]));
 const detailWord=row=>wordsById.get(row.word?.id||row.wordId)||row.word;
 const nounWord=row=>row.quizMode==='adjendings'&&row.questionSnapshot?.noun?{...wordsById.get(row.questionSnapshot.noun.id),...row.questionSnapshot.noun,pos:'noun'}:null;
 const nounMarkup=(row,index)=>{const noun=nounWord(row);return noun?`<button type='button' class='wrong-word-block wrong-noun-block' data-open-noun='${index}' aria-label='${t('Word details')}: ${e(noun.lemma)}'><span class='wrong-main-word' lang='de'>${wordHeading(noun)}</span><span class='wrong-word-meaning' lang='${getLocale()}'>${e(wordMeaning(noun))}</span></button>`:'';};

 const filters=ctx.wrongFilters||={level:ctx.store.state.preferences.studyLevel,pos:'all',mode:'all',open:false};
 if(!ctx.catalog.levels.some(row=>row.id===filters.level))filters.level=ctx.store.state.preferences.studyLevel;
 let catalog;
 function draw(){
  stopMedia();const all=wrongEntries(ctx.units,ctx.store.state,ctx.words),rows=filterWrongEntries(all,filters),review=reviewItems(rows,catalog||(catalog=reviewCatalog(ctx.words,all)));
  const groups=[['level',t('Study level'),ctx.catalog.levels.map(l=>l.id)],['pos',t('Part of speech'),['all',...new Set(all.map(r=>r.type))]],['mode',t('Exercise type'),['all',...Object.keys(modeLabels).filter(mode=>mode===filters.mode||all.some(r=>wrongMode(r)===mode))]]];
  const label=(key,id)=>id==='all'?t('All'):key==='level'?studyLevelLabel(id):key==='mode'?t(modeLabels[id]):t(types[id]||{saved:'Saved exercise',other:'Other'}[id]||id);
  const counts=(key,id)=>filterWrongEntries(all,{...filters,[key]:id}).length;
  const filterMarkup=all.length?`<details class='filter-fold filter-fold--combined wrong-filter-panel' ${filters.open?'open':''}><summary class='filter-fold-sum filter-fold-sum--combined'><div class='filter-fold-sum-head'><span class='filter-fold-k filter-fold-k--panel'>${t('Filters')}</span></div><div class='filter-fold-sum-picks'>${groups.map(([key,title])=>`<span class='filter-fold-pick-l'>${title}</span><span class='filter-fold-pick-v'>${e(label(key,filters[key]))} (${counts(key,filters[key])})</span>`).join('')}</div></summary><div class='filter-fold-body filter-fold-split'>${groups.map(([key,title,ids],i)=>`${i?`<div class='filter-split-divider'></div>`:''}<div class='filter-split-head'>${title}</div><div class='wl-filter-row'>${ids.map(id=>`<button class='wl-filter ${filters[key]===id?'active':''}' data-wrong-filter='${key}' data-value='${e(id)}' aria-pressed='${filters[key]===id}'>${e(label(key,id))} (${counts(key,id)})</button>`).join('')}</div>`).join('')}</div></details>`:'';
  el.innerHTML=`<div class='wrong-heading'><h2>${t('Review')} (${rows.length}${rows.length!==all.length?' / '+all.length:''})</h2>${all.length?`<button class='text-button danger wrong-clear' id='clear-wrong'>${t('Clear all')}</button>`:''}</div>${filterMarkup}${all.length?`<button class='primary wrong-retest' id='retest-filtered' ${review.items.length?'':'disabled'}>${t('Re-test')} (${review.items.length})</button>${review.unavailable.length?`<p class='muted'>${review.unavailable.length} · ${t('Saved questions no longer available for re-test.')}</p>`:''}`:''}<div class='wrong-results'>${!rows.length?`<section class='panel empty-wrong'><div aria-hidden='true'>${all.length?'🔎':'🎉'}</div><h2>${t(all.length?'No mistakes match these filters.':'No wrong answers yet')}</h2><p>${t(all.length?'Choose different filters to see your saved mistakes.':'Your quiz mistakes appear here for review.')}</p></section>`:rows.map((row,i)=>`<section class='panel wrong-entry' data-wrong-id='${e(row.question.id)}' ${detailWord(row)?`data-open-word='${i}' tabindex='0' role='button'`:''}><div class='wrong-card-heading'><div class='wrong-card-tags'><span class='badge wrong-mode'>${t(modeLabels[wrongMode(row)])}</span>${row.word?`<span class='badge wrong-pos'>${e(typeLabel(row.word))}</span>`:''}<span class='badge wrong-level'>${e(studyLevelLabel(row.unit.level))}</span></div><div class='wrong-card-actions'><span class='wrong-count'>${t('Wrong attempts')}: ${row.wrongCount??1}</span><button class='text-button danger dismiss-wrong' data-dismiss='${i}' aria-label='${t('Remove this mistake')}'>×</button></div></div>${row.word?`<div class='wrong-word-block'><h2 class='wrong-main-word' lang='de'>${wordHeading(row.word)}</h2><p class='wrong-word-meaning' lang='${getLocale()}'>${e((['vocabinput','vocabmeaning'].includes(row.quizMode)?vocabReview(row).meaning:wordMeaning(row.word))||t('Translation not available.'))}</p></div>`:['vocabinput','vocabmeaning'].includes(row.quizMode)?`<h2 class='wrong-main-word' lang='de'>${e(vocabReview(row).word||t(row.question.prompt))}</h2><p class='wrong-word-meaning' lang='${getLocale()}'>${e(vocabReview(row).meaning||t('Translation not available.'))}</p>`:`<h2 class='wrong-main-word'>${e(row.quizMode?t(row.question.prompt):row.question.prompt)}</h2>`}${nounMarkup(row,i)}<div class="review-answer-details">${details(row,wordsById)}</div></section>`).join('')}</div>`;
  el.querySelectorAll('[data-open-word]').forEach(card=>{const open=()=>{const word=detailWord(rows[Number(card.dataset.openWord)]);if(word){card.focus({preventScroll:true});ctx.haptic();controls.open(word);}};card.onclick=event=>{if(!event.target.closest('button,a,input,select,summary'))open();};card.onkeydown=event=>{if(event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();open();}};});
  el.querySelectorAll('[data-open-noun]').forEach(button=>button.onclick=()=>{const noun=nounWord(rows[Number(button.dataset.openNoun)]);if(noun){ctx.haptic();controls.open(noun);}});
  const fold=el.querySelector('.filter-fold');if(fold)fold.ontoggle=()=>{filters.open=fold.open;};
  el.querySelectorAll('[data-wrong-filter]').forEach(b=>b.onclick=()=>{filters[b.dataset.wrongFilter]=b.dataset.value;ctx.haptic();draw();});
  el.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=()=>{const row=rows[Number(b.dataset.dismiss)];row.quizMode?ctx.store.dismissQuizWrong(row.quizMode,row.question.id):ctx.store.dismissWrong(row.unit.id,row.question.id);ctx.haptic();draw();ctx.updateStatus();});
  el.querySelector('#clear-wrong')?.addEventListener('click',()=>{if(!confirm(t('Are you sure you want to delete?')))return;all.forEach(r=>r.quizMode?ctx.store.dismissQuizWrong(r.quizMode,r.question.id):ctx.store.dismissWrong(r.unit.id,r.question.id));draw();ctx.updateStatus();});
  el.querySelector('#retest-filtered')?.addEventListener('click',()=>{if(!review.items.length)return;ctx.retestSession=createRetestSession(review.items);ctx.navigate('retest');});
 }
 draw();return()=>{controls.cleanup();stopMedia();};
}
