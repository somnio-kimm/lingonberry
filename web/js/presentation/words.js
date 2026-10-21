const markTone={'\u0304':1,'\u0301':2,'\u030c':3,'\u0300':4};
const initials=['','b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'];
const finals=['a','o','e','ai','ei','ao','ou','an','en','ang','eng','ong','i','ia','ie','iao','iu','ian','in','iang','ing','iong','u','ue','ua','uo','uai','ui','uan','un','uang','ueng','ü','üe','üan','ün','er'];
const possible=new Set(initials.flatMap(initial=>finals.map(final=>initial+final)));
function syllable(marked) {
 let tone=0;let base='';
 for(const char of marked.normalize('NFD')) {if(markTone[char])tone=markTone[char];else base+=char;}
 return {base:base.normalize('NFC').toLowerCase(),tone};
}
export function wordSyllables(word,pronunciation) {
 const chars=[...word];
 const tokens=String(pronunciation||'').trim().split(/[\s'’]+/).filter(Boolean);
 if(tokens.length===chars.length)return tokens.map((token,i)=>({hanzi:chars[i],...syllable(token)}));
 const marked=tokens.join('');
 function split(rest,count) {
  if(!count)return rest?'':[];
  for(let n=Math.min(6,rest.length);n>0;n--) {
   const candidate=rest.slice(0,n), parsed=syllable(candidate);
   if(!possible.has(parsed.base))continue;
   const remaining=split(rest.slice(n),count-1);
   if(Array.isArray(remaining))return [parsed,...remaining];
  }
  return null;
 }
 const parsed=split(marked,chars.length);
 return parsed?parsed.map((value,i)=>({hanzi:chars[i],...value})):[];
}
const stripArticleNotes=value=>typeof value==='string'?value.replace(/\((?:der|die|das|den|dem|des)\)[ \t]*/giu,''):value;
function cleanGermanArticleNotation(entry){
 // Old downloaded packages retain dictionary notation alongside a separate article.
 if(entry.partOfSpeech!=='noun'||!/^\((?:der|die|das)\)\s+/iu.test(entry.word))return entry;
 const cleanExample=example=>{
  if(!example)return example;
  const focus=example.focus?{...example.focus,text:stripArticleNotes(example.focus.text)}:null;
  if(focus&&Number.isInteger(focus.start))focus.start=stripArticleNotes(example.text.slice(0,focus.start)).length;
  return {...example,text:stripArticleNotes(example.text),...(focus?{focus}:{})};
 };
 const grammar={...entry.grammar};
 if(grammar.declension)grammar.declension=Object.fromEntries(Object.entries(grammar.declension).map(([key,forms])=>[key,Array.isArray(forms)?forms.map(stripArticleNotes):stripArticleNotes(forms)]));
 if(grammar.related_forms)grammar.related_forms=grammar.related_forms.map(stripArticleNotes);
 return {...entry,word:stripArticleNotes(entry.word),grammar,example:cleanExample(entry.example),
  ...(entry.additionalExamples?{additionalExamples:entry.additionalExamples.map(cleanExample)}:{})};
}
export function germanWords(study) {
 return study.entries.map(source=>{const entry=cleanGermanArticleNotation(source);return {
  ...entry.grammar,id:entry.id,lemma:entry.word,sense_id:entry.grammar?.sense_id||entry.id,cefr:entry.level||'A1',pos:entry.partOfSpeech,
  article:entry.article,gender:entry.grammar?.gender||({der:'masculine',die:'feminine',das:'neuter'}[entry.article]),
  meaning_en:study.explanationLanguage==='en'?(entry.meanings||[entry.meaning]):[],meaning_ko:study.explanationLanguage==='ko'?(entry.meanings||[entry.meaning]):[],
  studyMeaning:entry.meaning,studyExplanationLanguage:study.explanationLanguage,collocations:entry.collocations||[],
  examples:[...(entry.example?[entry.example]:[]),...(entry.additionalExamples||[])].map(example=>({...example,de:example.text,studyTranslation:example.translation,[study.explanationLanguage]:example.translation})),
 };});
}
export function chineseWords(study) {
 return study.entries.map(entry=>({
  ...entry.grammar,id:entry.id,hanzi:entry.word,hskLevel:Number(entry.level)||1,
  syllables:entry.syllables||wordSyllables(entry.word,entry.pronunciation),partOfSpeech:entry.partOfSpeech,
  meaningEn:study.explanationLanguage==='en'?entry.meaning:'',meaningKo:study.explanationLanguage==='ko'?entry.meaning:'',
  studyMeaning:entry.meaning,studyExplanationLanguage:study.explanationLanguage,collocations:entry.collocations||[],
  sentences:[...(entry.example?[entry.example]:[]),...(entry.additionalExamples||[])].map(example=>({...example,hanzi:example.text,pinyin:example.pronunciation||'',studyTranslation:example.translation,meaningEn:study.explanationLanguage==='en'?example.translation:'',meaningKo:study.explanationLanguage==='ko'?example.translation:''})),
 }));
}
