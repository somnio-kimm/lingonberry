const LATIN_INITIALS=Object.freeze(Array.from({length:26},(_,index)=>String.fromCharCode(65+index)));
const KANA_ROWS=Object.freeze([
 ['あ','ぁあぃいぅうぇえぉお'],['か','かきくけこゕゖ'],['さ','さしすせそ'],['た','たちっつてと'],['な','なにぬねの'],
 ['は','はひふへほ'],['ま','まみむめも'],['や','ゃやゅゆょよ'],['ら','らりるれろ'],['わ','ゎわゐゑをん'],
]);
const readLatinInitial=text=>String(text??'').trim().normalize('NFKD').replace(/\p{M}/gu,'').toUpperCase().match(/^[A-Z]/u)?.[0]||'#';
function readKanaInitial(word){
 const supplied=String(word.pronunciation??word.reading??'').trim(),written=String(word.lemma??word.word??'').trim();
 const reading=supplied||(/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(written)?written:'');
 const first=reading.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu,'')[0];
 if(!first)return '#';
 const code=first.charCodeAt(0),kana=code>=0x30a1&&code<=0x30f6?String.fromCharCode(code-0x60):first;
 return KANA_ROWS.find(([,letters])=>letters.includes(kana))?.[0]||'#';
}
/** Use dictionary spelling/declared readings only; never infer a kanji pronunciation. */
export function readWordInitial(word,language){
 if(language==='ja')return readKanaInitial(word);
 if(language==='zh')return readLatinInitial(word.syllables?.[0]?.base??word.pronunciation??'');
 let headword=String(word.lemma??word.word??'').trim();
 if(language==='de'&&(word.pos==='noun'||word.partOfSpeech==='noun'))headword=headword.replace(/^(?:der|die|das|den|dem|des)\s+/iu,'');
 return readLatinInitial(headword);
}
/** A mounted view caches keys for immutable word objects without retaining old packages. */
export function createWordInitialIndex(language='en'){
 const keys=new WeakMap(),values=Object.freeze([...(language==='ja'?KANA_ROWS.map(([key])=>key):LATIN_INITIALS),'#']);
 function readInitial(word){if(!keys.has(word))keys.set(word,readWordInitial(word,language));return keys.get(word);}
 return {
  language,
  filter:(words,selected='all')=>selected==='all'?words:words.filter(word=>readInitial(word)===selected),
  readOptions(words){const counts=new Map(values.map(key=>[key,0]));for(const word of words){const key=readInitial(word);counts.set(key,(counts.get(key)||0)+1);}return [{value:'all',count:words.length},...values.map(value=>({value,count:counts.get(value)}))];},
 };
}
