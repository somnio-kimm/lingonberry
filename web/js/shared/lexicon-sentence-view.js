import {escapeHtml as e} from './ui.js';
/** German/Chinese sentence-card structure; adapters own content, readings and persisted answers. */
export function renderLexiconSentence(host,{question:q,feedback,selectedOption,chosenTokens,showTranslation,showReading,t},actions){
 const cloze=q.mode==='cloze',checked=!!feedback,chosen=new Set(chosenTokens),japanese=actions.language==='ja';
 const allowTranslation=!(actions.language==='en'&&q.locale==='en');
 const annotate=text=>japanese&&showReading?actions.renderSentence(text):e(text);
 const answer=checked?annotate(q.answer):'______';
 const blank=`<span class="lexicon-blank ${checked?'cloze-answer correct':''}">${cloze&&japanese&&showReading&&!checked&&q.focus.text===q.word.lemma?`<ruby>${answer}<rt>${e(q.word.pronunciation||'')}</rt></ruby>`:answer}</span>`;
 const sentence=cloze?annotate(q.sentence.slice(0,q.focus.start))+blank+annotate(q.sentence.slice(q.focus.start+q.focus.text.length)):checked?annotate(q.sentence):'';
 const tile=(id,attribute,index=id)=>`<button class="flow-chip scramble-chip ${attribute==='data-return'?'chosen':''}" lang="${e(actions.language)}" ${attribute}="${index}" ${checked?'disabled':''}><span class="scramble-chip-hanzi">${annotate(q.tokens[id])}</span></button>`;
 const translation=allowTranslation&&(japanese||showTranslation||checked)?`<div class="sentence-translation" lang="${e(q.locale)}">${e(q.example.studyTranslation)}</div>`:'';
 host.innerHTML=`<div class="quiz-after-filter"><section class="panel sentence-question lexicon-question ${!cloze?'scramble-question':''} ${feedback||''}" data-question-word="${e(q.word.id)}"><div class="cloze-tools"><button class="speak-btn" data-sentence-speak aria-label="${t('Speak Example')}">🔊</button>${japanese||allowTranslation?`<div class="cloze-pinyin-control"><span id="sentence-display-label">${t(japanese?'Show Reading':'Show Translation')}</span><button class="toggle-switch toggle-compact ${(japanese?showReading:showTranslation)?'on':''}" ${japanese?'data-show-reading':'data-show-translation'} role="switch" aria-checked="${!!(japanese?showReading:showTranslation)}" aria-labelledby="sentence-display-label"></button></div>`:''}</div>${cloze||checked?`<div class="sentence-quiz-text ${checked?'answered':''}" lang="${e(actions.language)}">${sentence}</div>`:''}${translation}<p class="lexicon-audio-status muted" role="status" hidden></p></section>
 ${cloze?`<div class="cloze-options">${q.options.map(option=>`<button class="opt-btn ${checked?(option.id===q.word.id?'option-correct':option.id===selectedOption?'option-wrong':''):''}" data-cloze-option="${e(option.id)}" ${checked?'disabled':''}><span class="cloze-option-word" lang="${e(actions.language)}">${checked&&japanese?actions.renderOption(option):e(option.text)}</span>${checked?`<small class="cloze-option-meaning" lang="${e(q.locale)}">${e(option.meaning)}</small>`:''}</button>`).join('')}</div>`:`<section class="panel scramble-answer"><div class="scramble-answer-label">${t('Your Answer')}:</div><div class="flow-row chosen-row">${chosenTokens.map((id,index)=>tile(id,'data-return',index)).join('')||`<span class="muted">${t('Tap words to build the sentence.')}</span>`}</div></section><section class="panel scramble-pool"><div class="flow-row">${q.pool.filter(id=>!chosen.has(id)).map(id=>tile(id,'data-tile')).join('')}</div></section>`}
 ${checked?`<div class="quiz-next-bar"><button class="primary" data-sentence-next>${t('Next')}</button></div>`:`${!cloze?`<div class="sentence-reset-controls"><button class="btn-small" data-sentence-reset>${t('Reset')}</button></div>`:''}<div class="quiz-action-bar">${!cloze?`<button class="primary submit-pill" data-sentence-submit ${!chosenTokens.length?'disabled':''}>${t('Submit')}</button>`:''}<button class="btn-small" data-sentence-skip>${t('Skip')}</button></div>`}</div>`;
 host.querySelector('[data-sentence-speak]').onclick=()=>actions.speak?.();
 host.querySelectorAll('[data-tile]').forEach(button=>button.onclick=()=>actions.choose(Number(button.dataset.tile)));
 host.querySelectorAll('[data-return]').forEach(button=>button.onclick=()=>actions.remove(Number(button.dataset.return)));
 host.querySelectorAll('[data-cloze-option]').forEach(button=>button.onclick=()=>actions.select(button.dataset.clozeOption));
 host.querySelector('[data-show-translation]')?.addEventListener('click',()=>actions.toggle(!showTranslation));
 host.querySelector('[data-show-reading]')?.addEventListener('click',()=>actions.toggleReading(!showReading));
 host.querySelector('[data-sentence-reset]')?.addEventListener('click',actions.reset);
 host.querySelector('[data-sentence-submit]')?.addEventListener('click',actions.submit);
 host.querySelector('[data-sentence-skip]')?.addEventListener('click',actions.skip);
 host.querySelector('[data-sentence-next]')?.addEventListener('click',actions.next);
}
