import {APP_SETTING_KEYS} from '../shared/app-settings.js';
import {renderListeningView} from '../shared/listening-view.js';
import {listeningLabels} from '../shared/listening-text.js';
import {createJapaneseFurigana,renderJapaneseRuby} from '../shared/japanese-furigana.js';
import {joinGapAnswers} from '../shared/phrase-gaps.js';
import {bindTypingAnswer,bindTypingAnswers} from '../shared/typing-answer.js';
import {createMorphemeModel} from '../shared/morpheme-model.js';
import {renderStudySearch,renderStudyTabs,renderStudyReviewFilters} from '../shared/study-components.js';
import {renderMorphemeInventory} from '../shared/morpheme-view.js';
import {collocationSearchTerms} from '../shared/collocations.js';
import {renderCollocations,bindCollocationAudio,collocationPreview} from '../shared/collocation-view.js';
import {learnerOriginLabel} from '../shared/root-references.js';
import {prepareLanguageExercises,selectExerciseRow} from '../shared/exercise-pools.js';
import {exerciseLabel,exerciseModes,exerciseSectionCategories,createExerciseQuestions,exerciseAnswerCorrect,formKindLabel} from '../shared/language-exercises.js';
import {renderExerciseExplanation,renderExercisePrompt} from '../shared/exercise-view.js';
import {selectWordExample} from '../shared/word-example.js';
import {createReviewContentPolicy} from '../shared/review-content.js';
import {assignEnglishLevel} from '../shared/english-levels.js';
import {APP_NAME} from '../shared/app-config.js';
import {orderStudyModes} from '../shared/study-modes.js';
import {renderLexiconSentence} from '../shared/lexicon-sentence-view.js';
import {joinSentenceTiles} from '../shared/lexicon-sentences.js';
import {STUDY_TOPICS,matchesStudyTopic,studyTopicLabel} from '../shared/study-topics.js';
import {shuffle} from '../shared/vocabulary.js';
import {escapeHtml as e,showQuizBurst,scorePill} from '../shared/ui.js';
import {mountWordRows} from '../shared/word-rows.js';
import {DeviceSpeech} from '../shared/device-speech.js';
import {createLexiconStore} from '../shared/lexicon-store.js';
import {lexiconText} from '../shared/lexicon-text.js';
import {createLexiconQuestions} from '../shared/lexicon-questions.js';
import {studyProfiles,studyWords,matchesStudyLevel,displayStudyWord,studySpokenWord} from './study-profiles.js';
const commonModes={wordlist:['Word List','📖','blue'],flashcards:['Flashcards','🗂️','purple'],cloze:['Cloze','📝','green'],scramble:['Sentence Scramble','🧩','orange'],vocabinput:['Word Input','✍️','blue'],vocabmeaning:['Meaning Quiz','🎯','purple'],listening:['Dictation','🎧','teal']};

const typeName=word=>{const type=word.pos==='functional'?word.subtype:word.pos;return type?type[0].toUpperCase()+type.slice(1):'Expression';};
export function createPresentation({language,navigate,refresh,onPreferences}){
 const modes={...commonModes,...exerciseModes(language),...(language==='en'?{roots:['Root Families','🌱','green']}:{})};
 const screens={home:{title:'Study'},wrong:{title:'Review'},settings:{title:'Settings'},retest:{title:'Retest'},...Object.fromEntries(Object.entries(modes).map(([key,[title]])=>[key,{title}]))};
 const profile=studyProfiles[language],store=createLexiconStore(localStorage,profile),engine=createLexiconQuestions(profile);
 let morphemeModel,typing,listeningCleanup,japaneseFurigana;
 let reviewContent=createReviewContentPolicy(),study,words=[],exercises=[],previousQuestionId,byId=new Map(),question,feedback,input='',reviewQueue=null,reviewResults,card=0,flipped=false,order=[],chosenTokens=[],closeSheet=()=>{};
 const filters=new Map(),scores=new Map();
 const score=route=>{if(!scores.has(route))scores.set(route,{correct:0,total:0});return scores.get(route);};
 const recordScore=(route,correct)=>{score(route).total++;if(correct)score(route).correct++;};
 const locale=()=>store.state.preferences.uiLanguage,t=value=>lexiconText(locale(),value);
 const screenTitle=mode=>screens[mode]?.title||exerciseLabel(mode,locale());
 const preferences=()=>({theme:store.state.preferences.theme,uiLanguage:locale(),hapticEnabled:store.state.preferences.hapticEnabled,autoRemoveResolvedWrongs:store.state.preferences.autoRemoveResolvedWrongs});
 const haptic=()=>{if(store.state.preferences.hapticEnabled)navigator.vibrate?.(10);};
 const change=(name,value)=>{store.preference(name,value);onPreferences(preferences());};
 const fold=value=>{const s=String(value||'').normalize('NFKC').toLocaleLowerCase(language);return ['en','fr','es'].includes(language)?s.normalize('NFD').replace(/\p{M}/gu,''):s;};
 function resetQuestion(){if(question)previousQuestionId=question.id;question=undefined;feedback=undefined;input='';chosenTokens=[];}
 function heading(word){if(language==='ja')return `<span class="lexicon-word" lang="ja">${renderJapaneseRuby(displayStudyWord(word),word.pronunciation)}</span>`;return `<span class="lexicon-word" lang="${language}">${word.pronunciation&&word.pronunciation!==word.lemma?`<ruby>${e(displayStudyWord(word))}<rt>${e(word.pronunciation)}</rt></ruby>`:e(displayStudyWord(word))}</span>`;}
 function tags(word){return `<span class="wl-tag wl-hsk">${e(language==='en'?assignEnglishLevel(word):word.level)}</span><span class="wl-tag wl-pos">${e(t(typeName(word)))}</span>`;}
 async function speak(text,host,onEnd){const message=host.querySelector('.lexicon-audio-status');if(message)message.hidden=true;await DeviceSpeech.speak(text,{language:profile.speech,onEnd,onError:()=>{if(message){message.hidden=false;message.textContent=t('Speech Unavailable');}}});}
 function topicBadges(word){if(language!=='en')return '';return `<div class="lexicon-topic-tags">${word.tags.map(tag=>{const [kind,id]=tag.split(':');const labels=kind==='topic'?STUDY_TOPICS:null;return labels?.[id]?`<span class="wl-tag lexicon-mode">${e(studyTopicLabel(labels,id,locale()))}</span>`:'';}).join('')}</div>`;}
 function details(word){
  const example=selectWordExample(word,language);
  closeSheet();const sheet=document.createElement('div');sheet.className='detail-overlay study-overlay lexicon-detail';
  sheet.innerHTML=`<section class="detail-sheet study-detail-sheet" role="dialog" aria-modal="true" aria-label="${e(word.lemma)}"><div class="detail-sheet-head"><button class="detail-sheet-icon" data-close aria-label="${t('Close')}">×</button><div class="detail-sheet-head-center">${tags(word)}</div><button class="detail-sheet-icon" data-speak aria-label="${t('Speak Word')}">🔊</button></div><div class="study-sheet-core"><h2 class="study-headword">${heading(word)}</h2><p class="study-sheet-meaning">${e(word.studyMeaning)}</p>${topicBadges(word)}</div>${renderCollocations(word,locale())}<div class="study-status-title">${t('Change Study Status')}</div><div class="status-btns">${['new','learning','mastered'].map(status=>`<button data-status="${status}" class="status-btn ${store.wordStatus(word.id)===status?'active':''}"><span class="status-dot ${status}"></span>${t(status[0].toUpperCase()+status.slice(1))}</button>`).join('')}</div><div class="study-examples"><h3>${t('Examples')}</h3>${example?`<div class="study-example fc-example-block example-with-audio"><button class="example-speak word-listen" data-example="0" aria-label="${t('Speak Example')}">🔊</button><p class="example-sentence" lang="${language}">${language==='ja'?japaneseFurigana.renderSentence(example.text,word):e(example.text)}</p>${example.studyTranslation&&example.studyTranslation!==example.text?`<p class="muted">${e(example.studyTranslation)}</p>`:''}</div>`:`<p class="muted">${t('No Example Available')}</p>`}</div><p class="lexicon-audio-status muted" role="status" hidden></p></section>`;
  bindCollocationAudio(sheet,word,text=>speak(text,sheet));document.body.appendChild(sheet);const focus=document.activeElement;
  const key=event=>{if(event.key==='Escape')closeSheet();if(event.key==='Tab'){const buttons=[...sheet.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',key);
  closeSheet=()=>{DeviceSpeech.stop();document.removeEventListener('keydown',key);sheet.remove();focus?.focus();closeSheet=()=>{};};
  sheet.querySelector('[data-close]').onclick=closeSheet;sheet.onclick=event=>{if(event.target===sheet)closeSheet();};sheet.querySelector('[data-speak]').onclick=()=>speak(studySpokenWord(word,profile),sheet);
  sheet.querySelector('[data-example]')?.addEventListener('click',()=>speak(example.text,sheet));
  sheet.querySelectorAll('[data-status]').forEach(button=>button.onclick=()=>{store.setWordStatus(word.id,button.dataset.status);closeSheet();refresh();});sheet.querySelector('[data-close]').focus();
 }
 function state(route){if(!filters.has(route))filters.set(route,{query:'',pos:'all',status:'all',open:false,mode:'all',topic:'all',exercise:'all',formKind:'all',category:'all',questionType:'all',phraseCategory:'all'});return filters.get(route);}
 function topicControls(f){if(language!=='en')return '';return [['topic',t('Topic'),STUDY_TOPICS]].map(([key,label,options])=>`<label>${label}<select data-${key}><option value="all">${t('All')}</option>${Object.keys(options).map(id=>`<option value="${id}" ${f[key]===id?'selected':''}>${e(studyTopicLabel(options,id,locale()))}</option>`).join('')}</select></label>`).join('');}
 function pool(route){
  const f=state(route),query=fold(f.query);
  const list=words.filter(word=>matchesStudyLevel(word,store.state.preferences.studyLevel,profile)&&(f.pos==='all'||word.pos===f.pos)&&(f.status==='all'||store.wordStatus(word.id)===f.status)&&(language!=='en'||matchesStudyTopic(word.tags,f.topic))&&(!query||word.search.includes(query)));
  if(query){const rank=word=>word.searchLemma===query?0:word.searchAliases.includes(query)?1:word.searchLemma.startsWith(query)?2:3;list.sort((a,b)=>rank(a)-rank(b));}
  return list;
 }
 function exerciseControls(route){
  if(Object.hasOwn(commonModes,route))return '';
  const f=state(route),rows=featureRows(route),available=['choice','input'].filter(mode=>rows.some(row=>(row.options?'choice':'input')===mode));
  if(!available.includes(f.answerMode))f.answerMode=available.includes('choice')?'choice':available[0];
  const kinds=[...new Set(rows.map(row=>row.formKind).filter(Boolean))];
  return `${route==='roots'?rootViewTabs():''}${available.length>1?`<div class="form-mode-controls" role="group" aria-label="${t('Answer Mode')}">${available.map(mode=>`<button data-answer-mode="${mode}" aria-pressed="${f.answerMode===mode}">${t(mode==='choice'?'Selection':'Typing')}</button>`).join('')}</div>`:''}${phraseQuestionControls(route)}${kinds.length?`<div class="grammar-selectors"><label>${t('Form')}<select data-form-kind><option value="all">${t('All')}</option>${kinds.map(id=>`<option value="${id}" ${f.formKind===id?'selected':''}>${e(formKindLabel(id,locale()))}</option>`).join('')}</select></label></div>`:''}`;
 }
 function featureRows(route) {
  const f=state(route),categories=exerciseSectionCategories(language,route);
  return exercises.filter(row=>categories.includes(row.category)&&(f.phraseCategory==='all'||row.category===f.phraseCategory)&&(f.formKind==='all'||row.formKind===f.formKind)&&
   (f.questionType!=='gaps'||!!row.gapFill)&&(f.questionType!=='phrase'||!row.gapFill));
 }
 function phraseQuestionControls(route) {
  if(!['collocations','phrasal'].includes(route))return '';
  const f=state(route),categories=exerciseSectionCategories(language,route),rows=exercises.filter(row=>categories.includes(row.category));
  const types=categories.filter(id=>rows.some(row=>row.category===id));
  const type=types.length>1?`<label>${t('Phrase Type')}<select data-phrase-category><option value="all">${t('All')}</option>${types.map(id=>`<option value="${id}" ${f.phraseCategory===id?'selected':''}>${e(exerciseLabel(id,locale()))}</option>`).join('')}</select></label>`:'';
  const gaps=rows.some(row=>row.gapFill)?`<label>${t('Question Type')}<select data-question-type>${[['all','All'],['phrase','Standard'],['gaps','Sentence Gaps']].map(([value,label])=>`<option value="${value}" ${(f.questionType||'all')===value?'selected':''}>${t(label)}</option>`).join('')}</select></label>`:'';
  return type||gaps?`<div class="grammar-selectors">${type}${gaps}</div>`:'';
 }
 function rootViewTabs(){return renderStudyTabs({label:t('Root Families'),options:['browse','quiz'].map(value=>({value,label:t(value==='browse'?'Browse':'Practice')})),selected:state('roots').rootView||'browse',attribute:'data-root-view'});}
 function bindRootTabs(host){host.querySelectorAll('[data-root-view]').forEach(button=>button.onclick=()=>{state('roots').rootView=button.dataset.rootView;resetQuestion();refresh();});}
 function chooseFeatureQuestion(feature){
  const f=state(feature),list=pool(feature),rows=featureRows(feature);
  const available=['choice','input'].filter(mode=>rows.some(row=>(row.options?'choice':'input')===mode));if(!available.includes(f.answerMode))f.answerMode=available.includes('choice')?'choice':available[0];
  const row=selectExerciseRow(rows.filter(row=>(row.options?'choice':'input')===f.answerMode),list,{previousId:previousQuestionId});
  const q=row&&createExerciseQuestions([row],list,row.route,row.category,study.explanationLanguage)[0];return reviewContent.prepare(q?{...q,answerMode:f.answerMode,mode:feature}:undefined);
 }

 function controls(route){
  const f=state(route),levelWords=words.filter(word=>matchesStudyLevel(word,store.state.preferences.studyLevel,profile)),parts=['all',...new Set(levelWords.map(word=>word.pos))];
  const label=value=>t(value==='all'?'All':value==='functional'?'Expression':value[0].toUpperCase()+value.slice(1));
  const count=(key,value)=>levelWords.filter(word=>(key==='pos'?(value==='all'||word.pos===value)&&(f.status==='all'||store.wordStatus(word.id)===f.status):(value==='all'||store.wordStatus(word.id)===value)&&(f.pos==='all'||word.pos===f.pos))).length;
  const chips=(key,values)=>values.map(value=>`<button class="wl-filter ${f[key]===value?'active':''}" data-filter-${key}="${e(value)}" aria-pressed="${f[key]===value}">${e(label(value))} (${count(key,value)})</button>`).join('');
  return `<details class="study-filter-panel filter-fold filter-fold--combined" ${f.open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${t('Filters')}</span></div><div class="filter-fold-sum-picks"><span class="filter-fold-pick-l">${t('Study Status')}</span><span class="filter-fold-pick-v">${label(f.status)} (${count('status',f.status)})</span><span class="filter-fold-pick-l">${t('Part of Speech')}</span><span class="filter-fold-pick-v">${label(f.pos)} (${count('pos',f.pos)})</span></div></summary><div class="filter-fold-body filter-fold-split"><div class="filter-split-head">${t('Study Status')}</div><div class="wl-filter-row">${chips('status',['all','new','learning','mastered'])}</div><div class="filter-split-divider"></div><div class="filter-split-head">${t('Part of Speech')}</div><div class="wl-filter-row wl-tag-filter-row">${chips('pos',parts)}</div><div class="filter-split-divider"></div><div class="lexicon-filter-row"><label>${t('Study Level')}<select data-level-filter>${profile.levels.map(level=>`<option value="${level}" ${store.state.preferences.studyLevel===level?'selected':''}>${level}</option>`).join('')}</select></label>${topicControls(f)}</div></div></details>`;
 }
 function bindControls(host,route,onReset=refresh){const f=state(route),reset=()=>{f.open=!!host.querySelector('.filter-fold')?.open;card=0;order=[];resetQuestion();onReset();};for(const key of ['topic','exercise','form-kind']){const select=host.querySelector(`[data-${key}]`);if(select)select.onchange=event=>{f[key==='form-kind'?'formKind':key]=event.target.value;reset();};}host.querySelector('.filter-fold').ontoggle=event=>{if(event.target.isConnected)f.open=event.target.open;};host.querySelector('[data-level-filter]').onchange=event=>{change('studyLevel',event.target.value);reset();};for(const key of ['pos','status'])host.querySelectorAll(`[data-filter-${key}]`).forEach(button=>button.onclick=()=>{f[key]=button.getAttribute(`data-filter-${key}`);reset();});}
 function drawHome(host){host.innerHTML=`<section class="panel level-panel study-level-card"><h2>${t('Study Level')}</h2><div class="level-chips study-level-options${language==='en'?' english-level-options':''}">${profile.levels.map(level=>`<button class="level-chip" data-level="${level}" aria-pressed="${level===store.state.preferences.studyLevel}">${level}</button>`).join('')}</div></section><div class="menu-grid">${orderStudyModes(Object.keys(modes).filter(route=>!(language==='en'&&route==='articles')&&(Object.hasOwn(commonModes,route)||(route==='roots'?(study?.morphemes?.length||study?.families?.length||study?.practiceData?.rootFamilies?.length):exercises.some(row=>exerciseSectionCategories(language,route).includes(row.category)))))).map(route=>{const [title,icon,color]=modes[route];return`<button class="menu-card" data-route="${route}"><span class="menu-icon ${color}" aria-hidden="true">${icon}</span><span class="menu-label">${t(title)}</span></button>`;}).join('')}</div>`;
  host.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>{resetQuestion();navigate(button.dataset.route);});host.querySelectorAll('[data-level]').forEach(button=>button.onclick=()=>{change('studyLevel',button.dataset.level);card=0;order=[];resetQuestion();refresh();});}
 function drawWords(host,route){
  const f=state(route);host.innerHTML=`<div class="lexicon-view"><h2 class="section-title study-list-title">${t('Word List')}</h2>${renderStudySearch({id:'search-input',value:f.query,label:t('Search')})}${controls(route)}<div class="wl-list wl-list--wordlist" id="wordlist-results"></div></div>`;bindControls(host,route);let pager;
  const results=()=>{pager?.cleanup();pager=mountWordRows(host.querySelector('#wordlist-results'),pool(route),word=>`<div class="wl-row" data-word="${word.id}"><div class="wl-main" role="button" tabindex="0"><div class="wl-headword">${heading(word)}</div><div class="wl-meaning">${e(word.studyMeaning)}</div>${collocationPreview(word)}</div><div class="wl-trail">${tags(word)}<span class="wl-tag wl-st-${store.wordStatus(word.id)}">${t(store.wordStatus(word.id)[0].toUpperCase()+store.wordStatus(word.id).slice(1))}</span><button class="wl-speak" data-row-speak="${word.id}" aria-label="${t('Speak Word')}">🔊</button></div></div>`,{moreLabel:t('Show More Words'),emptyMarkup:`<div class="panel">${t('No Matching Words')}</div>`});};results();
  const search=host.querySelector('#search-input');search.oninput=()=>{f.query=search.value;results();};search.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing)search.blur();};
  const list=host.querySelector('#wordlist-results');list.onclick=event=>{const speaker=event.target.closest('[data-row-speak]');if(speaker){speak(studySpokenWord(byId.get(speaker.dataset.rowSpeak),profile),host);return;}const row=event.target.closest('[data-word]');if(row)details(byId.get(row.dataset.word));};list.onkeydown=event=>{if(['Enter',' '].includes(event.key)&&event.target.closest('[data-word]')){event.preventDefault();details(byId.get(event.target.closest('[data-word]').dataset.word));}};
  return()=>pager?.cleanup();
 }
 function drawCards(host,route){const list=pool(route),allowed=new Set(list.map(word=>word.id));if(!order.length||order.some(id=>!allowed.has(id)))order=list.map(word=>word.id);card%=Math.max(1,order.length);const word=byId.get(order[card]),example=word&&selectWordExample(word,language);
  const face=back=>`<div class="flashcard-${back?'back':'front'}" aria-hidden="${back!==flipped}" ${back!==flipped?'inert':''}><div class="fc-card-head"><button class="quiz-status-btn fc-card-status" data-card-status>${t('Study Status')}</button><div class="fc-head-center"><div class="fc-head-badges ${back?'':'fc-head-badges--mirror'}">${tags(word)}</div></div><button class="detail-sheet-icon detail-sheet-speak" data-card-speak aria-label="${t('Speak Word')}">🔊</button></div><div class="fc-card-main ${back?'fc-card-main-back':''}" role="button" tabindex="${back===flipped?'0':'-1'}" ${back===flipped?'data-flip':''} aria-label="${t('Tap to Flip')}"><div class="fc-core ${back?'':'fc-core--front'}"><div class="flashcard-word">${heading(word)}</div><div class="fc-meaning">${e(word.studyMeaning)}</div></div>${back&&example?`<div class="fc-examples"><div class="fc-example-block"><div class="example-sentence" lang="${language}">${language==='ja'?japaneseFurigana.renderSentence(example.text,word):e(example.text)}</div>${example.studyTranslation?`<div class="example-translation">${e(example.studyTranslation)}</div>`:''}</div></div>`:''}</div></div>`;
  host.innerHTML=`<div class="lexicon-view"><div class="fc-toolbar"><h2 class="section-title">${t('Flashcards')}</h2><div class="fc-tools"><button class="btn-small" data-shuffle>🔀 ${t('Shuffle')}</button><span id="flashcard-count">${order.length} ${t('Cards')}</span></div></div>${controls(route)}<div class="quiz-after-filter">${word?`<div class="flashcard-wrapper"><div class="flashcard ${flipped?'flipped':''}" data-word-id="${e(word.id)}">${face(false)}${face(true)}</div></div><div class="fc-navigation"><button class="fc-nav" data-prev-card aria-label="${t('Previous Word')}" ${order.length<=1?'disabled':''}>‹</button><button class="fc-nav" data-next-card aria-label="${t('Next Word')}" ${order.length<=1?'disabled':''}>›</button></div>`:`<section class="panel empty-wrong"><p>${t('No Matching Words')}</p></section>`}</div><p class="lexicon-audio-status muted" role="status" hidden></p></div>`;
  bindControls(host,route);host.querySelector('[data-shuffle]').onclick=()=>{order=shuffle(order,Math.random);card=0;flipped=false;refresh();};if(!word)return;
  const flip=()=>{flipped=!flipped;haptic();refresh();};host.querySelector('[data-flip]').onclick=flip;host.querySelector('[data-flip]').onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();flip();}};
  const move=direction=>{card=(card+direction+order.length)%order.length;flipped=false;refresh();};host.querySelector('[data-prev-card]').onclick=()=>move(-1);host.querySelector('[data-next-card]').onclick=()=>move(1);
  host.querySelectorAll('[data-card-status]').forEach(button=>button.onclick=()=>details(word));host.querySelectorAll('[data-card-speak]').forEach(button=>button.onclick=()=>speak(studySpokenWord(word,profile),host));
 }
 function chooseQuestion(mode){
  const list=pool(mode);let selected;
  if(!Object.hasOwn(commonModes,mode))return chooseFeatureQuestion(mode);
  if(['cloze','scramble'].includes(mode))selected=engine.createSentencePool(mode,list,study.explanationLanguage).choose(previousQuestionId);
  else selected=engine.createVocabularyPool(mode,list,study.explanationLanguage).choose(previousQuestionId);
  return reviewContent.prepare(selected);
 }
 function drawSentenceQuiz(host,route,mode){
  const retest=route==='retest';if(!question)question=retest?reviewQueue?.[0]?.question:chooseQuestion(mode);const q=question;
  host.innerHTML=`<div class="lexicon-view"><div class="sentence-quiz-header"><h2 class="section-title">${t(retest?'Retest':screenTitle(route))}</h2>${scorePill(score(route).correct,score(route).total)}</div>${retest?'':controls(route)}<div data-sentence-body></div></div>`;
  if(!retest)bindControls(host,route);const body=host.querySelector('[data-sentence-body]');if(!q){body.innerHTML=`<section class="panel">${t('No Questions Match')}</section>`;return;}
  const preference=mode+'ShowTranslation';
  const submit=()=>{if(feedback)return;const correct=engine.sentenceAnswerCorrect(q,mode==='cloze'?input:chosenTokens);const answer=mode==='cloze'?input:joinSentenceTiles(chosenTokens.map(id=>q.tokens[id]),language);store.record(q,answer,correct,retest);recordScore(route,correct);feedback=correct?'correct':'wrong';if(retest)reviewResults[correct?'correct':'wrong']++;haptic();showQuizBurst(correct);refresh();};
  const advance=skipped=>{if(retest){if(skipped)reviewResults.skipped++;reviewQueue.shift();}resetQuestion();refresh();};
  renderLexiconSentence(body,{question:q,feedback,selectedOption:input,chosenTokens,showTranslation:store.state.preferences[preference],showReading:store.state.preferences[mode+'ShowReading']!==false,t},{
   language,renderSentence:text=>japaneseFurigana?.renderSentence(text,q.word)||e(text),renderOption:option=>{const word=byId.get(option.id);return word&&option.text===word.lemma?renderJapaneseRuby(option.text,word.pronunciation):japaneseFurigana.renderSentence(option.text,word);},toggleReading:value=>{store.preference(mode+'ShowReading',value);refresh();},reset:()=>{chosenTokens=[];q.pool=shuffle(q.pool);refresh();},speak:()=>speak(q.sentence,host),choose:id=>{if(!chosenTokens.includes(id)){chosenTokens.push(id);refresh();}},remove:index=>{chosenTokens.splice(index,1);refresh();},select:id=>{input=id;submit();},toggle:value=>{store.preference(preference,value);refresh();},
   submit,skip:()=>advance(true),next:()=>advance(false),
  });
 }
 function drawDictation(host,route){
  const retest=route==='retest',saved=retest?reviewQueue[0].question:undefined;
  const translation=q=>q.kind==='word'?q.word.studyMeaning||q.example?.[q.locale]||'':language==='en'&&q.locale==='en'?'':q.sentence?.studyTranslation||q.example?.[q.locale]||'';
  const advance=skipped=>{if(retest){if(skipped)reviewResults.skipped++;reviewQueue.shift();}resetQuestion();refresh();};
  const session=saved?{question:saved,score:()=>score(route),onAnswer:correct=>{reviewResults[correct?'correct':'wrong']++;},onNext:()=>advance(false),onSkip:()=>advance(true)}:{};
  listeningCleanup=renderListeningView(host,{
   labels:listeningLabels(locale()),locale,warning:()=>store.warning?t('Storage Unavailable'):'',level:q=>q.word.level||q.word.cefr,
   questions:mode=>engine.listeningQuestions(mode,pool('listening'),study.explanationLanguage,words).map(q=>reviewContent.prepare(q)),
   filters:()=>controls('listening'),bindFilters:(el,next)=>bindControls(el,'listening',next),
   translation,hint:q=>language==='en'&&q.locale==='en'?q.word.studyMeaning||byId.get(q.word.id)?.studyMeaning||'':translation(q),answerMarkup:language==='ja'?q=>japaneseFurigana.renderQuestion(q):undefined,
   answerCorrect:engine.listeningAnswerCorrect,
   haptic:correct=>{haptic();showQuizBurst(correct);},
   record:(q,value,correct)=>{store.record(q,value,correct,retest);recordScore(route,correct);},
  },session);
  return listeningCleanup;
 }
 function drawQuiz(host,route){
  const retest=route==='retest';if(retest&&reviewQueue?.length===0){host.innerHTML=`<section class="panel retest-complete"><h2>${t('Retest Complete')}</h2><div class="retest-summary"><span>${t('Correct')}: ${reviewResults.correct}</span><span>${t('Wrong')}: ${reviewResults.wrong}</span><span>${t('Skipped')}: ${reviewResults.skipped}</span></div><button class="primary" id="retest-done" data-finish>${t('Next')}</button></section>`;host.querySelector('[data-finish]').onclick=()=>{reviewQueue=null;resetQuestion();navigate('wrong');};return;}
  const mode=retest?reviewQueue?.[0]?.question.mode:route;
  if(route==='listening'||mode?.startsWith('listen'))return drawDictation(host,route);
  if(['cloze','scramble'].includes(mode))return drawSentenceQuiz(host,route,mode);
  if(!question)question=retest?reviewQueue?.[0]?.question:chooseQuestion(mode);
  const q=question,meaning=q?.exercise?!!q.options:q?.mode==='vocabmeaning';
  host.innerHTML=`<div class="lexicon-view"><div class="sentence-quiz-header"><h2 class="section-title">${t(retest?'Retest':screenTitle(route))}</h2>${scorePill(score(route).correct,score(route).total)}</div>${!retest?exerciseControls(route)+controls(route):''}${q?`<div class="vocab-test quiz-after-filter"><section class="panel vocab-question lexicon-question ${q.exercise&&!q.options?'form-question':''} ${feedback||''}" data-question-word="${e(q.word.id)}" data-exercise-id="${q.exercise?e(q.id):''}">${q.exercise?renderExercisePrompt(q,{input:meaning?q.options.find(option=>option.id===input)?.text||'':input,checked:!!feedback,editable:!meaning&&!feedback}):`<p class="vocab-instruction">${t(meaning?'Choose the correct meaning.':'Type the word for this meaning.')}</p><div class="vocab-prompt" lang="${meaning?language:q.locale}">${meaning?e(displayStudyWord(q.word)):e(q.prompt)}</div>`}${meaning?`<div class="lexicon-options vocab-options">${q.options.map(option=>`<button class="vocab-choice ${feedback?(option.id===(q.exercise?q.correctOption:q.word.id)?'correct':option.id===input?'wrong':''):option.id===input?'selected':''}" data-option="${option.id}" ${feedback?'disabled':''}>${e(option.text)}</button>`).join('')}</div>`:q.gapFill?'':`<div class="vocab-answer-cell ${feedback||'active'}">${feedback?`<div role="status"><span class="vocab-correction" lang="${language}">${language==='ja'&&!q.exercise?renderJapaneseRuby(q.answer,q.word.pronunciation):e(q.answer)}</span>${feedback==='wrong'?`<del class="vocab-wrong" lang="${language}">${e(input)}</del>`:''}</div>`:`<input id="vocab-answer" type="text" inputmode="text" lang="${language}" enterkeyhint="done" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="120" aria-label="${t('Word Input')}" value="${e(input)}">`}</div>`}${feedback?renderExerciseExplanation(q):''}<p class="lexicon-audio-status vocab-speech-status" role="status" hidden></p></section>${feedback?`<div class="quiz-next-bar"><button class="primary" id="vocab-next" data-next>${t('Next')}</button></div>`:`<div class="quiz-action-bar">${meaning?'':`<button class="primary submit-pill" id="vocab-submit" data-submit ${!input.trim()?'disabled':''}>${t('Submit')}</button>`}<button class="btn-small" data-skip>${t('Skip')}</button></div>`}</div>`:`<section class="panel">${t('No Questions Match')}</section>`}${store.warning?`<p role="status">${t('Storage Unavailable')}</p>`:''}</div>`;
  const choicePanel=host.querySelector('.lexicon-question'),choiceOptions=choicePanel?.querySelector('.lexicon-options');if(choiceOptions)choicePanel.after(choiceOptions);
  if(q?.exercise){const badge=document.createElement('span');badge.className='wl-tag lexicon-mode';badge.textContent=exerciseLabel(q.category,locale())+(q.formKind?' · '+formKindLabel(q.formKind,locale()):'');const top=document.createElement('div');top.className='vocab-question-top';top.append(badge);choicePanel.prepend(top);}
  if(q&&!q.exercise){const top=document.createElement('div');top.className='vocab-question-top';top.innerHTML=`<span class="badge">${e(t(typeName(q.word)))} · ${e(q.locale.toUpperCase())}</span><button class="word-listen" data-quiz-speak aria-label="${t('Speak Word')}">🔊</button>`;choicePanel.prepend(top);top.querySelector('button').onclick=()=>speak(studySpokenWord(q.word,profile),host);}
  if(!retest){bindControls(host,route);for(const [selector,key]of [['question-type','questionType'],['phrase-category','phraseCategory']])host.querySelector(`[data-${selector}]`)?.addEventListener('change',event=>{state(route)[key]=event.target.value;resetQuestion();refresh();});bindRootTabs(host);host.querySelectorAll('[data-answer-mode]').forEach(button=>button.onclick=()=>{state(route).answerMode=button.dataset.answerMode;resetQuestion();refresh();});}if(!q)return;
  const finish=skipped=>{if(retest){if(skipped)reviewResults.skipped++;reviewQueue.shift();}resetQuestion();refresh();};
  host.querySelector('[data-next]')?.addEventListener('click',()=>finish(false));host.querySelector('[data-skip]')?.addEventListener('click',()=>finish(true));
  const submit=host.querySelector('[data-submit]'),field=host.querySelector('#vocab-answer');
  const gapFields=[...host.querySelectorAll('[data-phrase-gap]')];
  if(gapFields.length)typing=bindTypingAnswers(gapFields,{button:submit,onChange:values=>{input=joinGapAnswers(values);},onSubmit:checkAnswer,isActive:()=>q===question&&!feedback});
  if(field)typing=bindTypingAnswer(field,{
   button:submit,onChange:value=>{input=value;},onSubmit:checkAnswer,
   isActive:()=>q===question&&!feedback,
  });
  host.querySelectorAll('[data-option]').forEach(button=>button.onclick=()=>{input=button.dataset.option;checkAnswer();});
  function checkAnswer(){if(feedback||typing?.isComposing||!input.trim())return;field?.blur();gapFields.forEach(input=>input.blur());const correct=q.exercise?exerciseAnswerCorrect(q,input):engine.vocabularyAnswerCorrect(q,input);feedback=correct?'correct':'wrong';store.record(q,input,correct,retest);recordScore(route,correct);if(retest)reviewResults[correct?'correct':'wrong']++;haptic();showQuizBurst(correct);refresh();}
 }
 function drawReview(host){
  const f=state('wrong'),all=Object.values(store.state.wrongs).filter(row=>reviewContent.isCurrent(row.question));
  const wordFor=row=>byId.get(row.question.word.id)||row.question.word;
  const matches=(row,filters)=>{const word=wordFor(row),q=row.question;return matchesStudyLevel(word,filters.level,profile)&&(filters.pos==='all'||word.pos===filters.pos)&&(filters.status==='all'||store.wordStatus(word.id)===filters.status)&&(filters.mode==='all'||exerciseSectionCategories(language,filters.mode).includes(q.mode))&&(filters.category==='all'||(q.category||'vocabulary')===filters.category)&&(language!=='en'||matchesStudyTopic(word.tags,filters.topic));};
  const active={...f,level:store.state.preferences.studyLevel},rows=all.filter(row=>matches(row,active));
  const modeLabel=mode=>t(mode.startsWith('listen')?'Dictation':screenTitle(mode))+(mode.startsWith('listen')?' · '+t(mode==='listenword'?'Word':'Sentence'):'');
  const definitions=[['level','Study Level',profile.levels,id=>id],['pos','Part of Speech',['all',...new Set(all.map(row=>wordFor(row).pos))],id=>t(typeName({pos:id}))],['mode','Exercise Type',['all',...new Set(all.map(row=>row.question.mode))],modeLabel],['status','Study Status',['all','new','learning','mastered'],id=>t(id[0].toUpperCase()+id.slice(1))]];
  const categories=[...new Set(all.map(row=>row.question.category||'vocabulary'))];
  if(categories.length>1)definitions.push(['category','Type',['all',...categories],id=>id==='vocabulary'?t('Vocabulary'):exerciseLabel(id,locale())]);
  if(language==='en')definitions.push(['topic','Topic',['all',...Object.keys(STUDY_TOPICS)],id=>studyTopicLabel(STUDY_TOPICS,id,locale())]);
  const groups=definitions.map(([key,title,values,label])=>({key,title:t(title),selected:active[key],options:values.map(value=>({value,label:value==='all'?t('All'):label(value),count:all.filter(row=>matches(row,{...active,[key]:value})).length}))}));
  const answerDetails=row=>{const q=row.question,word=wordFor(row),choice=q.exercise?!!q.options:['vocabmeaning','cloze'].includes(q.mode),answer=choice?q.options.find(option=>option.id===row.input)?.text||row.input:row.input;
   const field=(label,html,correct=false)=>`<p class="wrong-answer-row ${correct?'wrong-correct-line':'wrong-user-line'}"><span class="wrong-answer-label">${t(label)}:</span> <span class="${correct?'correct-answer':'wrong-answer-value--wrong'}">${correct?html:`<del>${html}</del>`}</span></p>`;
   let prompt=q.exercise?renderExercisePrompt(q):q.mode==='cloze'?`<div class="wrong-question-block"><p class="wrong-question lexicon-review-question" lang="${language}">${e(q.sentence.slice(0,q.focus.start))}<span class="lexicon-blank wrong-test-slot wrong-test-blank"></span>${e(q.sentence.slice(q.focus.start+q.focus.text.length))}</p></div>`:'';
   const duplicate=[word.lemma,displayStudyWord(word)].includes(q.answer);
   const correct=(q.exercise||['cloze','scramble','listensentence'].includes(q.mode))&&!duplicate?field('Correct Answer',e(q.answer),true):'';
   return prompt+correct+field('Wrong Answer',e(answer))+(q.exercise?renderExerciseExplanation(q):'');
  };
  host.innerHTML=`<div class="lexicon-view"><div class="wrong-heading"><h2>${t('Review')} (${rows.length}${rows.length!==all.length?' / '+all.length:''})</h2>${all.length?`<button class="text-button danger wrong-clear" id="clear-wrong" data-clear>${t('Delete All')}</button>`:''}</div>${all.length?renderStudyReviewFilters({groups,open:f.open,title:t('Filters')}):''}${all.length?`<button class="primary wrong-retest" id="retest-filtered" data-retest ${rows.length?'':'disabled'}>${t('Retest')} (${rows.length})</button>`:''}<div class="wrong-results">${rows.length?rows.map(row=>{const q=row.question,word=wordFor(row);return `<section class="panel wrong-card wrong-entry" tabindex="0" role="button" data-review-word="${e(word.id)}"><div class="wrong-card-heading"><div class="wrong-card-tags"><span class="badge wrong-mode">${modeLabel(q.mode)}</span><span class="badge wrong-pos">${e(t(typeName(word)))}</span><span class="badge wrong-level">${e(word.level)}</span></div><div class="wrong-card-actions"><span class="wrong-count">${t('Wrong Attempts')}: ${row.count}</span><button class="del-wrong" data-remove="${e(row.id)}" aria-label="${t('Remove')}">×</button></div></div><div class="wrong-word-block"><div class="wrong-main-word">${heading(word)}</div><p class="wrong-word-meaning" lang="${e(study.explanationLanguage)}">${e(word.studyMeaning)}</p></div><div class="review-answer-details">${answerDetails(row)}</div></section>`;}).join(''):`<section class="panel empty-wrong"><div aria-hidden="true">${all.length?'🔎':'🎉'}</div><h2>${t(all.length?'No Mistakes Match These Filters':'No Wrong Answers')}</h2><p>${t('Keep Practising to Build Your Review List')}</p></section>`}</div></div>`;
  const fold=host.querySelector('.filter-fold');if(fold)fold.ontoggle=()=>{f.open=fold.open;};
  host.querySelectorAll('[data-review-filter]').forEach(button=>button.onclick=()=>{const key=button.dataset.reviewFilter,value=button.dataset.value;if(key==='level')change('studyLevel',value);else f[key]=value;refresh();});
  host.querySelector('[data-clear]')?.addEventListener('click',()=>{if(confirm(t('Are you sure you want to delete?'))){store.clearWrongs();refresh();}});
  host.querySelectorAll('[data-remove]').forEach(button=>button.onclick=event=>{event.stopPropagation();store.removeWrong(button.dataset.remove);refresh();});
  host.querySelectorAll('[data-review-word]').forEach(row=>{row.onclick=event=>{if(event.target.closest('button,a,input,select,summary'))return;const word=byId.get(row.dataset.reviewWord);if(word)details(word);};row.onkeydown=event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();row.click();}};});
  host.querySelector('[data-retest]')?.addEventListener('click',()=>{reviewQueue=JSON.parse(JSON.stringify(rows));reviewResults={correct:0,wrong:0,skipped:0};resetQuestion();navigate('retest');});
 }
 function drawRoots(host){
  const f=state('roots');if(f.rootView==='quiz')return drawQuiz(host,'roots');
  if(study.morphemes?.length)return renderMorphemeInventory(host,{model:morphemeModel,state:f,t,locale:locale(),tabs:rootViewTabs(),bindTabs:bindRootTabs,openWord:id=>details(byId.get(id)),tags});
  const all=f.allRoots!==false,allowed=new Set((all?words.filter(word=>(f.pos==='all'||word.pos===f.pos)&&(f.status==='all'||store.wordStatus(word.id)===f.status)):pool('roots')).map(word=>word.id));
  const families=(study.families||[]).filter(family=>(!f.rootKind||f.rootKind==='all'||(family.kind||'root')===f.rootKind)&&family.members.some(member=>allowed.has(member.entryId)));
  host.innerHTML=`<div class="lexicon-view"><h2 class="section-title study-list-title">${t('Root Families')}</h2>${rootViewTabs()}<p class="muted" data-root-count>${families.length} ${t('Families')} · ${new Set(families.flatMap(family=>family.members.map(member=>member.entryId))).size} ${t('Words')}</p><div class="grammar-selectors"><label>${t('Type')}<select data-root-kind>${['all','root','prefix','suffix'].map(kind=>`<option value="${kind}" ${(f.rootKind||'all')===kind?'selected':''}>${t(kind==='all'?'All':kind[0].toUpperCase()+kind.slice(1))}</option>`).join('')}</select></label></div><div class="form-mode-controls"><button data-root-scope="all" aria-pressed="${all}">${t('All Families')}</button><button data-root-scope="level" aria-pressed="${!all}">${t('Selected Study Level')}</button></div><div class="card study-search"><input id="root-search" class="input-field" type="search" placeholder="${t('Search')}" aria-label="${t('Search')}" value="${e(f.rootQuery||'')}" autocomplete="off" autocapitalize="none"></div>${controls('roots')}<div data-root-list class="study-reference-list"></div></div>`;
  const list=host.querySelector('[data-root-list]');let pager;const results=()=>{pager?.cleanup();const query=fold(f.rootQuery||'');const matching=families.filter(family=>!query||fold([family.root,...family.members.flatMap(member=>[member.word,member.note])].join(' ')).includes(query));pager=mountWordRows(list,matching,family=>`<section class="panel"><h3>${e(family.root)}${family.origin?` <small class="root-origin">${e(learnerOriginLabel(family.origin,locale()))}</small>`:''}</h3><p>${e(family.meaning)}</p>${family.members.map(member=>`<div class="wl-row root-member" data-root-entry="${e(member.entryId)}"><div class="wl-main"><button class="wl-headword root-member-trigger" data-root-word="${e(member.entryId)}">${e(member.word)}</button><div class="wl-meaning">${e(byId.get(member.entryId).studyMeaning)}</div>${member.parts?`<p class="root-member-history">${e(member.parts)}</p>`:''}${member.note!==byId.get(member.entryId).studyMeaning?`<p class="root-member-history">${e(member.note)}</p>`:''}</div><div class="wl-trail">${tags(byId.get(member.entryId))}${member.references?.length?`<a href="${e(member.references[0])}" target="_blank" rel="noopener noreferrer">${t('Source')}</a>`:''}</div></div>`).join('')}</section>`,{moreLabel:t('Show More Words'),emptyMarkup:`<section class="panel">${t('No Questions Match')}</section>`,initialCount:12,batchSize:12});};results();
  bindControls(host,'roots');bindRootTabs(host);host.querySelector('[data-root-kind]').onchange=event=>{f.rootKind=event.target.value;refresh();};if(all)host.querySelector('[data-level-filter]').disabled=true;host.querySelectorAll('[data-root-scope]').forEach(button=>button.onclick=()=>{f.allRoots=button.dataset.rootScope==='all';refresh();});list.onclick=event=>{if(event.target.closest('a'))return;const row=event.target.closest('[data-root-entry]');if(row)details(byId.get(row.dataset.rootEntry));};
  const search=host.querySelector('#root-search');search.oninput=()=>{f.rootQuery=search.value;results();};
  return()=>pager.cleanup();
 }
 function setStudy(value) {
  if (study===value) return;
  study=value;
  store.migrateEquivalentEntries(value?.retiredEntries);
  reviewContent=createReviewContentPolicy(value);
  if (reviewQueue) reviewQueue=reviewQueue.filter(row=>reviewContent.isCurrent(row.question));

  words=studyWords(value);
  for (const word of words) {
   word.search=fold([word.lemma,word.pronunciation,word.studyMeaning,...word.aliases,...collocationSearchTerms(word)].join(' '));
   word.searchLemma=fold(word.lemma);
   word.searchAliases=[word.pronunciation,...word.aliases].filter(Boolean).map(fold);
  }
  words.sort((left,right)=>left.lemma.localeCompare(right.lemma,language));
  exercises=prepareLanguageExercises(value,words);
  byId=new Map(words.map(word=>[word.id,word]));
  japaneseFurigana=language==='ja'?createJapaneseFurigana(words,value?.practiceData,value?.readingPractice):undefined;
  morphemeModel=value?.morphemes?.length?createMorphemeModel(value.morphemes,words):undefined;
  order=[];
  resetQuestion();
 }
 return {id:language,screens,settings:{values:preferences,change,haptic,reportContext:()=>({app:APP_NAME,studyLanguage:language,studyLevel:store.state.preferences.studyLevel}),reset:async()=>{DeviceSpeech.stop();store.reset();resetQuestion();return false;}},
  preferences,setPreferences(values){for(const key of APP_SETTING_KEYS)if(Object.hasOwn(values,key)&&store.state.preferences[key]!==values[key])store.preference(key,values[key]);},
  setStudy,
  title:route=>route==='home'?APP_NAME:t(screens[route]?.title||'Study'),tab:route=>t(screens[route]?.title||'Study'),
  render(route,host){listeningCleanup?.();listeningCleanup=undefined;typing?.destroy();typing=undefined;host.dataset.viewState='ready';if(route==='home')drawHome(host);else if(route==='wordlist')return drawWords(host,route);else if(route==='flashcards')drawCards(host,route);else if(route==='wrong')drawReview(host);else if(route==='roots')return drawRoots(host);else return drawQuiz(host,route)||(()=>{});return()=>{};},
  stop(){listeningCleanup?.();listeningCleanup=undefined;typing?.destroy();DeviceSpeech.stop();closeSheet();},
 };
}
