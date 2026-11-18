import {escapeHtml as e} from './ui.js';
import {findTranslationFocus} from './translation-focus.js';
/** Escaped projection only: neither translation nor stored question is modified. */
export function renderTranslationTarget(text,{word,locale,studyLanguage,focus}={}){
 const value=String(text??''),spans=findTranslationFocus({text:value,word,locale,studyLanguage,focus});let cursor=0,html='';
 for(const span of spans){html+=e(value.slice(cursor,span.start))+`<span class="translation-target" data-translation-target>${e(span.text)}</span>`;cursor=span.start+span.text.length;}
 return html+e(value.slice(cursor));
}
