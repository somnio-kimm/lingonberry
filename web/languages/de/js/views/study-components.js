import {groupHeadwords,headwordsForInventory,readHeadwordStatus,readWordSenses} from '../../../../js/shared/headwords.js';
import {renderStudyFilters} from '../../../../js/shared/study-components.js';
import {mountDictionarySheet} from '../../../../js/shared/dictionary-sheet.js';
import { studyLevelLabel } from '../app-definition.js';
import { escapeHtml as e } from '../../../../js/shared/ui.js';
import { t, getLocale, wordMeaning, sentenceMeaning } from '../core/i18n.js';
import { wordType } from '../core/dictionary.js';
import { studyTypes, wordHeading, filterStudyStatus } from '../core/words.js';
import { types } from '../core/word-types.js';
import { speakGerman, stopMedia } from '../core/media.js';
export const statusLabel=status=>t({new:'New',learning:'Learning',mastered:'Mastered'}[status]);
export const typeLabel=word=>t(types[wordType(word)]||wordType(word));
export const headwordTypeLabels=word=>[...new Set(readWordSenses(word).map(typeLabel))];
export const germanHeadwordStatus=(word,store)=>readHeadwordStatus(word,id=>store.wordStatus(id));
export const statusTag=(word,store)=>`<span class="wl-tag wl-st-${store.wordStatus(word.id)}">${statusLabel(store.wordStatus(word.id))}</span>`;
export function studyFilterMarkup(pool,store,status,pos,open=false,extraBody='',leading={},grouped=false) {
 const byType=pos==='all'?pool:pool.filter(w=>wordType(w)===pos);
 const byStatus=filterStudyStatus(pool,store,status);
 const count=list=>grouped?groupHeadwords(list).length:list.length;
 const statuses=['all','new','learning','mastered'].map(key=>[key,key==='all'?t('All'):statusLabel(key),count(filterStudyStatus(byType,store,key))]);
 const tags=['all',...studyTypes(pool)].map(key=>[key,key==='all'?t('All'):t(types[key]||key),count(key==='all'?byStatus:byStatus.filter(w=>wordType(w)===key))]);
 const group=(title,selected,rows)=>({title:t(title),selected,options:rows.map(([value,label,count])=>({value,label,count}))});
 return renderStudyFilters({title:t('Filters'),open,extraBody,...leading,status:group('Study status',status,statuses),pos:group('Part of speech',pos,tags)});
}
export function createStudyControls(host,ctx) {
 let dialog,closed=false;
 function speakWithStatus(text,message){
  speakGerman(text,()=>{},()=>{
   if(!closed&&message?.isConnected){
    message.hidden=false;
    message.textContent=t('German speech is unavailable. Download a German voice in the phone’s speech settings.');
   }
  });
 }
 function speak(word){
  const text=word.pos==='noun'&&word.article?word.article+' '+word.lemma:word.lemma;
  speakWithStatus(text,dialog?.overlay.querySelector('.study-audio-status')||host.querySelector('.study-audio-status'));
 }
 function open(word,onDone,{nextButton,onClose}={}){
  word=headwordsForInventory(ctx.words).expand(word);
  dialog?.dispose();
  dialog=mountDictionarySheet({
   word,language:'de',locale:getLocale(),labelledBy:'study-word-title',meaning:wordMeaning(word),
   tags:`<span class="detail-badge detail-badge-hsk">${e(studyLevelLabel(word.cefr))}</span>${headwordTypeLabels(word).map(label=>`<span class="detail-badge detail-badge-pos">${e(label)}</span>`).join('')}`,
   heading:`<h2 id="study-word-title" class="study-headword" lang="de">${wordHeading(word)}</h2>`,
   audioStatusClass:'study-audio-status',nextButton,
   labels:{
    close:t('Close'),speakWord:t('Speak word'),speakExample:t('Listen to sentence'),
    examples:t('Examples'),changeStatus:t('Change study status'),status:statusLabel,
   },
   renderExample:example=>`<div class="example-sentence" lang="de">${e(example.text)}</div>`,
   readTranslation:sentenceMeaning,status:germanHeadwordStatus(word,ctx.store),statusAttribute:'data-word-status',
   speakWord:()=>speak(word),
   speakExample(text,overlay){
    const message=overlay.querySelector('.study-audio-status');
    message.hidden=true;
    speakWithStatus(text,message);
   },
   speakCollocation:text=>speakGerman(text),
   stopSpeech:stopMedia,
   saveStatus(status){
    for(const sense of readWordSenses(word))ctx.store.setWordStatus(sense.id,status);
    ctx.haptic();
    onDone?.();
    ctx.updateStatus();
   },
   onDismiss:()=>{dialog=undefined;onDone?.();},
   onClose,
   focusFallback:()=>host.querySelector('#search-input,#fc-shuffle'),
  });
  return dialog.close;
 }
 return {speak,open,cleanup(){closed=true;if(!dialog?.dispose())stopMedia();dialog=undefined;}};
}
