import {renderStudyMeaning} from './meaning-display.js';
import {renderStudyIcon} from './study-icons.js';
import {escapeHtml as e} from './ui.js';
import {readDictionaryMeanings} from './word-example.js';
/** Canonical German/Chinese study patterns. Geometry and colours live in study-theme.css. */
export function renderStudySearch({id,value='',label='Search',controls='',afterInput=''}){
 return `<div class="card study-search">${controls}<input id="${e(id)}" class="input-field" type="search" inputmode="text" enterkeyhint="search" placeholder="${e(label)}" aria-label="${e(label)}" value="${e(value)}" autocomplete="off" autocapitalize="none">${afterInput}</div>`;
}
export function renderStudySearchWithFilters({id,value,label,filters}){
 return renderStudySearch({id,value,label,afterInput:`<div class="study-search-filters">${filters}</div>`});
}
/** Use native disclosure so opening a clue preserves the answer field and keyboard state. */
export function renderStudyHint({label,body,summaryId}){
 if(!body)return '';
 return `<details class="study-hint"><summary${summaryId?` id="${e(summaryId)}"`:''}>${e(label)}</summary><div class="study-hint-content">${body}</div></details>`;
}

/** The vocabulary quiz adds its own Next button to the normal dictionary sheet. */
export function appendStudySheetNext(overlay,nextButton,closeSelector){
 if(!nextButton)return;
 const actions=overlay.ownerDocument.createElement('div');
 actions.className='quiz-next-bar';
 actions.append(nextButton);
 overlay.querySelector('.detail-sheet').append(actions);
 overlay.setAttribute('data-vocab-result','');
 overlay.querySelector(closeSelector).setAttribute('data-close-vocab-result','');
}

/** The existing dictionary sheet borrows the quiz's Next action while open. */
export function bindQuizWordDetails(trigger,nextButton,open){
 const slot=nextButton.parentElement;
 let closeSheet,active=true;
 trigger.onclick=()=>{
  if(!active||closeSheet)return;
  closeSheet=open({nextButton,onClose:()=>{
   closeSheet=undefined;
   if(!active)return;
   slot.append(nextButton);
   trigger.focus({preventScroll:true});
  }});
 };
 if(trigger.tagName!=='BUTTON')trigger.onkeydown=event=>{
  if(event.target===trigger&&['Enter',' '].includes(event.key)){event.preventDefault();trigger.click();}
 };
 return ()=>{
  active=false;
  trigger.onclick=null;trigger.onkeydown=null;
  closeSheet?.();
 };
}

export function renderStudyUsageLabel(word,partOfSpeech,showReading=false){
 const parts=[e(partOfSpeech),showReading&&e(word.pronunciation),renderStudyMeaning(word.studyMeaning,word)];
 return parts.filter(Boolean).join(' · ');
}

function renderSenseNumber(number){
 return number?`<span class="study-sense-number">${number}. </span>`:'';
}

export function renderDictionaryMeanings(word,language,meaning){
 const lines=readDictionaryMeanings(word,language,meaning);
 return lines.map((line,index)=>renderSenseNumber(lines.length>1&&index+1)+e(line)).join('<br>');
}

export function renderStudyExampleLabel({word,number},renderUsage){
 return renderSenseNumber(number)+renderUsage(word);
}

export function renderStudyExamples(rows,{title,speakLabel,renderExample,renderUsage,readTranslation=example=>example.studyTranslation,noExample=''}){
 if(!rows.some(row=>row.example)&&!noExample)return '';
 const multipleUsages=new Set(rows.map(row=>row.word)).size>1;
 return `<div class="study-examples"><h3>${e(title)}</h3>${rows.map((row,index)=>{
  const {word,example,number}=row;
  const usage=number||(multipleUsages&&rows[index-1]?.word!==word)?`<p class="study-sense-label">${renderStudyExampleLabel(row,renderUsage)}</p>`:'';
  if(!example)return usage+(noExample?`<p class="muted">${e(noExample)}</p>`:'');
  const translation=readTranslation(example);
  return `${usage}<div class="study-example fc-example-block example-with-audio" data-sense-id="${e(word.id)}"><button type="button" class="example-speak word-listen" data-example="${index}" aria-label="${e(speakLabel)}">🔊</button>${renderExample(example,word)}${translation&&translation!==example.text?`<div class="example-translation">${e(translation)}</div>`:''}</div>`;
 }).join('')}</div>`;
}

export function renderStudyTabs({label,options,selected,attribute,variant='form'}){
 if(!/^data-[a-z]+(?:-[a-z]+)*$/u.test(attribute))throw new Error('Study tabs require a safe data attribute');
 if(!['form','listening'].includes(variant))throw new Error('Unknown study tabs variant');
 return `<div class="${variant==='listening'?'listening-mode-controls':'form-mode-controls'}" role="group" aria-label="${e(label)}">${options.map(({value,label})=>`<button type="button" ${variant==='listening'?'class="btn-small" ':''}${attribute}="${e(value)}" aria-pressed="${selected===value}">${e(label)}</button>`).join('')}</div>`;
}
export function renderStudyQuizHeader({title}){
 return `<div class="vocab-quiz-header"><div class="section-title">${e(title)}</div></div>`;
}
export function renderStudyReferenceHeading({word,origin}){
 return `<header class="study-reference-header"><h3 class="study-reference-heading">${e(word)}</h3>${origin?`<p class="study-reference-origin root-origin">${e(origin)}</p>`:''}</header>`;
}

/** Standard Review answer geometry; callers supply escaped or trusted rendered values. */
export function renderStudyReviewAnswer({label,valueHtml,correct=false,lang='',strike=true,only=false}){
 return `<p class="wrong-answer-row ${correct?'wrong-correct-line':'wrong-user-line'}${only?' wrong-only':''}"><span class="wrong-answer-label">${e(label)}:</span> <span class="${correct?'correct-answer':'wrong-answer-value--wrong'}"${lang?` lang="${e(lang)}"`:''}>${!correct&&strike?`<del>${valueHtml}</del>`:valueHtml}</span></p>`;
}

const filterOptionLabel=({label,count})=>count===undefined?e(label):`${e(label)} (${e(count)})`;
export function renderStudyFilterPick(title,value,valueAttribute=''){
 return `<span class="filter-fold-pick-l">${e(title)}</span><span class="filter-fold-pick-v" ${valueAttribute}>${value}</span>`;
}
const filterDivider='<div class="filter-split-divider"></div>';
export function renderStudyFilterTags({options,selected,attribute}){
 if(!/^data-[a-z]+(?:-[a-z]+)*$/u.test(attribute))throw new Error('Study filters require a safe data attribute');
 return options.map(option=>{
  const active=selected===option.value;
  return `<button type="button" class="wl-filter ${active?'active':''}" ${attribute}="${e(option.value)}" aria-pressed="${active}" ${option.disabled&&!active?'disabled':''}>${filterOptionLabel(option)}</button>`;
 }).join('');
}

export function renderStudyTagFilterGroup({title,options,selected,attribute}){
 return `<div class="filter-split-head">${e(title)}</div><div class="wl-filter-row" role="group" aria-label="${e(title)}">${renderStudyFilterTags({options,selected,attribute})}</div>`;
}

export function renderStudyFilterPanel({title,open=false,picks='',body}){
 return `<details class="filter-fold filter-fold--combined study-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${e(title)}</span></div>${picks?`<div class="filter-fold-sum-picks">${picks}</div>`:''}</summary><div class="filter-fold-body filter-fold-split">${body}</div></details>`;
}

/** Shared Study filters for status and part of speech. Extra controls use the same panel. */
export function renderStudyFilters({title,status,pos,open=false,extraBody='',beforeGroups='',beforePicks=''}){
 const picks=beforePicks+[status,pos].map(group=>{
  const selected=group.options.find(option=>option.value===group.selected)||group.options[0];
  return renderStudyFilterPick(group.title,filterOptionLabel(selected));
 }).join('');
 const body=[beforeGroups,renderStudyTagFilterGroup({...status,attribute:'data-f'}),renderStudyTagFilterGroup({...pos,attribute:'data-tag'}),extraBody].filter(Boolean).join(filterDivider);
 return renderStudyFilterPanel({title,open,picks,body});
}

/** Combined filter geometry shared with the established Review screens. */
export function renderStudyReviewFilters({groups,open=false,title='Filters'}){
 return `<details class="filter-fold filter-fold--combined wrong-filter-panel" ${open?'open':''}><summary class="filter-fold-sum filter-fold-sum--combined"><div class="filter-fold-sum-head"><span class="filter-fold-k filter-fold-k--panel">${e(title)}</span></div><div class="filter-fold-sum-picks">${groups.map(group=>`<span class="filter-fold-pick-l">${e(group.title)}</span><span class="filter-fold-pick-v">${e(group.options.find(option=>option.value===group.selected)?.label||'')}</span>`).join('')}</div></summary><div class="filter-fold-body filter-fold-split">${groups.map((group,index)=>`${index?'<div class="filter-split-divider"></div>':''}<div class="filter-split-head">${e(group.title)}</div><div class="wl-filter-row">${group.options.map(option=>`<button class="wl-filter ${group.selected===option.value?'active':''}" data-review-filter="${e(group.key)}" data-value="${e(option.value)}" aria-pressed="${group.selected===option.value}">${e(option.label)} (${e(option.count)})</button>`).join('')}</div>`).join('')}</div></details>`;
}

/** Reset belongs beside the answer area, separate from Submit / Skip. */
export function renderStudyReset({label,id,attribute}){
 if(attribute&&!/^data-[a-z]+(?:-[a-z]+)*$/u.test(attribute))throw new Error('Reset requires a safe data attribute');
 return `<button type="button" class="study-reset" ${id?`id="${e(id)}"`:''} ${attribute?`${attribute}`:''} aria-label="${e(label)}" title="${e(label)}">${renderStudyIcon('reset')}</button>`;
}
