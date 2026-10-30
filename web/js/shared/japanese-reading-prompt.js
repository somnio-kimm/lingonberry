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
 const focus=lemma&&text?findSentenceFocus({...word,lemma},{text},'ja'):null;
 return focus?.text===lemma?{prompt:text,readingFocus:focus}:{prompt:lemma,readingFocus:{start:0,text:lemma}};
}
