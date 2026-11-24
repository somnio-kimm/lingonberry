import {renderStudyMeaning} from './meaning-display.js';
import {readQuestionTranslationFocus} from './translation-focus.js';
import {bindQuizWordDetails,renderStudyReset} from './study-components.js';
import {renderTranslationTarget} from './translation-target-view.js';
import {escapeHtml as e} from './ui.js';
import {renderPhraseGapSentence} from './phrase-gap-view.js';
import {clozeSentenceTranslation} from './cloze-translation.js';
/** German/Chinese sentence-card structure; adapters own content, readings and persisted answers. */
export function renderLexiconSentence(host,{question:q,feedback,selectedOption,input='',chosenTokens,showTranslation,showReading,t,translation:translationText,translationVisible},actions){
 const cloze=q.mode==='cloze',checked=!!feedback,chosen=new Set(chosenTokens),japanese=actions.language==='ja';
 const reading=actions.reading??japanese;
 const showWordDetails=cloze&&checked&&actions.openDetails;
 const typing=cloze&&q.answerMode==='input';
 const contentLocale=q.locale||q.word.studyExplanationLanguage||actions.uiLanguage;
 const englishSelf=actions.language==='en'&&contentLocale==='en';
 const allowTranslation=!englishSelf;
 const showDisplayToggle=reading||(!cloze&&allowTranslation);
 const annotate=text=>reading&&showReading?actions.renderSentence(text):e(text);
 const answer=checked?annotate(q.answer):'______';
 const blank=`<span class="lexicon-blank ${checked?'cloze-answer correct':''}">${cloze&&japanese&&showReading&&!checked&&q.focus?.text===q.word.lemma?`<ruby>${answer}<rt>${e(q.word.pronunciation||'')}</rt></ruby>`:answer}</span>`;
 const selected=q.options?.find(option=>option.id===selectedOption);
 const sentence=(cloze?actions.renderCloze?.({question:q,checked,showReading}):undefined)??(cloze&&q.gapFill?renderPhraseGapSentence(q,{input:typing?input:selected?.text||'',checked,showMistakes:typing&&feedback==='wrong',editable:typing&&!checked,uiLanguage:actions.uiLanguage,variant:'sentence'}):
  cloze?annotate(q.sentence.slice(0,q.focus.start))+blank+annotate(q.sentence.slice(q.focus.start+q.focus.text.length)):checked?annotate(q.sentence):'');
 const tile=(id,attribute,index=id)=>`<button class="flow-chip scramble-chip ${attribute==='data-return'?'chosen':''}" lang="${e(actions.language)}" ${attribute}="${index}" ${checked?'disabled':''}>${actions.renderTile?actions.renderTile(q.tokens[id],id):`<span class="scramble-chip-hanzi">${annotate(q.tokens[id])}</span>`}</button>`;
 const meaning=translationText??(cloze?(englishSelf?q.word.studyMeaning:clozeSentenceTranslation(q)):q.example.studyTranslation);
 const translationFocus=readQuestionTranslationFocus(q);
 const translation=meaning&&(cloze||allowTranslation)&&(translationVisible??(cloze||reading||showTranslation||checked))?`<div class="sentence-translation" lang="${e(contentLocale)}">${cloze&&!englishSelf?renderTranslationTarget(meaning,{word:q.word,locale:contentLocale,studyLanguage:actions.language,focus:translationFocus}):e(meaning)}</div>`:'';
 const speaker=cloze?'':`<button class="speak-btn" data-sentence-speak aria-label="${t('Speak Example')}">🔊</button>`;
 host.innerHTML=`<div class="quiz-after-filter"><section class="panel sentence-question lexicon-question ${cloze?'cloze-question':'scramble-question'} ${feedback||''}${showWordDetails?' cloze-word-details':''}" data-question-word="${e(q.word.id)}">${showDisplayToggle||speaker?`<div class="cloze-tools">${showDisplayToggle?`<div class="cloze-pinyin-control"><span id="sentence-display-label">${t(reading?'Show Reading':'Show Translation')}</span><button class="toggle-switch toggle-compact ${(reading?showReading:showTranslation)?'on':''}" ${reading?'data-show-reading':'data-show-translation'} role="switch" aria-checked="${!!(reading?showReading:showTranslation)}" aria-labelledby="sentence-display-label"></button></div>`:''}${speaker}</div>`:''}${cloze||checked?`<div class="sentence-quiz-text ${cloze?'cloze-sentence':'scramble-sentence'} ${checked?'answered':''}" ${showWordDetails?'role="button" tabindex="0" aria-haspopup="dialog" data-open-cloze-word':''} lang="${e(actions.language)}">${sentence}</div>`:''}${translation}${speaker?'<p class="lexicon-audio-status muted" role="status" hidden></p>':''}</section>
 ${cloze&&!typing?`<div class="cloze-options">${q.options.map(option=>`<button class="opt-btn ${checked?(option.id===(q.correctOption??q.word.id)?'option-correct':option.id===selectedOption?'option-wrong':''):''}" data-cloze-option="${e(option.id)}" data-option="${e(option.id)}" ${checked?'disabled':''}><span class="cloze-option-word" lang="${e(actions.language)}">${checked&&actions.renderOption?actions.renderOption(option):e(option.text)}</span>${checked&&actions.renderOptionBase?actions.renderOptionBase(option):''}${checked&&option.meaning?`<small class="cloze-option-meaning" lang="${e(contentLocale)}">${renderStudyMeaning(option.meaning)}</small>`:''}</button>`).join('')}</div>`:cloze?'':`<section class="panel scramble-answer"><div class="scramble-answer-heading"><div class="scramble-answer-label">${t('Your Answer')}:</div>${!checked?renderStudyReset({label:t('Reset'),attribute:'data-sentence-reset'}):''}</div><div class="flow-row chosen-row">${chosenTokens.map((id,index)=>tile(id,'data-return',index)).join('')}</div></section><section class="panel scramble-pool"><div class="flow-row">${q.pool.filter(id=>!chosen.has(id)).map(id=>tile(id,'data-tile')).join('')}</div></section>`}
 ${checked?`<div class="quiz-next-bar"><button class="primary" data-sentence-next>${t('Next')}</button></div>`:`<div class="quiz-action-bar">${!cloze||typing?`<button class="primary submit-pill" data-sentence-submit ${(typing?!input.trim():!chosenTokens.length)?'disabled':''}>${t('Submit')}</button>`:''}<button class="btn-small" data-sentence-skip>${t('Skip')}</button></div>`}</div>`;
 const bind=(selector,callback)=>host.querySelectorAll(selector).forEach(button=>button.onclick=callback);
 bind('[data-sentence-speak]',()=>actions.speak?.());
 bind('[data-tile]',event=>actions.choose(Number(event.currentTarget.dataset.tile)));
 bind('[data-return]',event=>actions.remove(Number(event.currentTarget.dataset.return)));
 bind('[data-cloze-option]',event=>actions.select(event.currentTarget.dataset.clozeOption));
 bind('[data-show-translation]',()=>actions.toggle(!showTranslation));
 bind('[data-show-reading]',()=>actions.toggleReading(!showReading));
 bind('[data-sentence-reset]',actions.reset);bind('[data-sentence-submit]',actions.submit);
 bind('[data-sentence-skip]',actions.skip);
 let disposeDetails,questionCard;
 if(showWordDetails){
  const trigger=host.querySelector('[data-open-cloze-word]');
  const next=host.querySelector('[data-sentence-next]');
  disposeDetails=bindQuizWordDetails(trigger,next,options=>actions.openDetails(q.word,options));
  questionCard=host.querySelector('.cloze-word-details');
  questionCard.onclick=event=>{
   if(!event.target.closest('button,a,[data-open-cloze-word]'))trigger.click();
  };
 }
 bind('[data-sentence-next]',()=>{disposeDetails?.();actions.next?.();});
 return()=>{
  disposeDetails?.();
  if(questionCard)questionCard.onclick=null;
  host.querySelectorAll('button').forEach(button=>button.onclick=null);
 };
}
