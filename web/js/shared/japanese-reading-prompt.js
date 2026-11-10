import {findSentenceFocus} from './lexicon-sentences.js';
/** One reading target; normalise legacy headings/markers without changing the saved question. */
export function japaneseReadingPrompt(word,prompt){
 const lemma=String(word.lemma||word.word||'').normalize('NFC');
 let text=String(prompt||lemma).normalize('NFC').trim();
 if(text.startsWith(lemma+'\n'))text=text.slice(lemma.length+1).trim();
 for(const [left,right]of [['［','］'],['【','】'],['[',']']]){
  const token=left+lemma+right,start=text.indexOf(token);
  if(lemma&&start>=0)return {prompt:text.split(token).join(lemma),readingFocus:{start,text:lemma}};
 }
 const example=word.examples?.find(item=>item.text?.normalize('NFC').trim()===text);
 const focus=lemma&&text?findSentenceFocus({...word,lemma},{...example,text},'ja'):null;
 return focus?.text===lemma?{prompt:text,readingFocus:focus}:{prompt:lemma,readingFocus:{start:0,text:lemma}};
}

/** Use a translation only when it belongs to the sentence being displayed. */
export function japaneseReadingContext(word,prompt,curatedContext=''){
 const lemma=(word.lemma||word.word||'').normalize('NFC');
 if (prompt===lemma) return word.studyMeaning||'';
 const example=word.examples?.find(item=>item.text?.normalize('NFC').trim()===prompt);
 if (example?.studyTranslation?.trim()) return example.studyTranslation;
 return curatedContext===word.studyMeaning?'':curatedContext;
}
