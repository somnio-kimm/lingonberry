import {escapeHtml as e} from './ui.js';
const label=locale=>locale==='ko'?'연어':'Collocations';
export function collocationPreview(word){return word.collocations?.length?`<div class="collocation-preview">${e(word.collocations[0].phrase)}</div>`:'';}
export function renderCollocations(word,locale='en'){
 if(!word.collocations?.length)return '';
 return `<div class="study-examples study-collocations"><h3>${label(locale)}</h3>${word.collocations.map((row,i)=>`<div class="fc-example-block"><div class="collocation-phrase">${e(row.phrase)} <button type="button" class="word-listen" data-collocation-audio="${i}" aria-label="${locale==='ko'?'연어 듣기':'Speak Collocation'}">🔊</button></div><p class="example-translation">${e(row.meaning)}</p><p class="example-sentence example-with-audio">${e(row.example)} <button type="button" class="word-listen" data-collocation-example="${i}" aria-label="${locale==='ko'?'예문 듣기':'Speak Example'}">🔊</button></p><p class="example-translation">${e(row.exampleTranslation)}</p></div>`).join('')}</div>`;
}
export function bindCollocationAudio(host,word,speak){host.querySelectorAll('[data-collocation-example]').forEach(button=>button.onclick=()=>speak(word.collocations[Number(button.dataset.collocationExample)].example));host.querySelectorAll('[data-collocation-audio]').forEach(button=>button.onclick=()=>speak(word.collocations[Number(button.dataset.collocationAudio)].phrase));}
export function collocationPicker(locale,selected='vocabulary'){
 const ko=locale==='ko';return `<div class="grammar-selectors collocation-picker"><label>${ko?'문제 유형':'Exercise Type'}<select data-collocation-kind><option value="vocabulary" ${selected==='vocabulary'?'selected':''}>${ko?'단어':'Vocabulary'}</option><option value="collocations" ${selected==='collocations'?'selected':''}>${label(locale)}</option></select></label></div>`;
}
