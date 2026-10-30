/** Dictionary-driven readings; never infer on/kun labels or split a compound's kanji. */
export const normaliseKana=value=>String(value||'').normalize('NFKC').replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const kana=/^[ぁ-ゖー]+$/u;
export function japaneseReadings(word){return [...new Set([word.pronunciation].map(normaliseKana).filter(value=>kana.test(value)))];}
export function splitOkurigana(word){
 const match=/^([\p{Script=Han}々]+)([ぁ-ゖ]+)$/u.exec(String(word.lemma||'').normalize('NFC'));
 if(!match||!/[\p{Script=Han}]/u.test(match[1]))return;
 const reading=normaliseKana(word.pronunciation),ending=match[2];
 if(!kana.test(reading)||!reading.endsWith(ending)||reading.length<=ending.length)return;
 return [{text:match[1],reading:reading.slice(0,-ending.length),kind:'kanji'},{text:ending,reading:ending,kind:'kana'}];
}
/** Written forms explicitly present in the installed dictionary, indexed by whole-word reading. */
export function indexJapaneseSpellings(words){
 const result=new Map();
 for(const word of words)for(const reading of japaneseReadings(word)){
  if(!result.has(reading))result.set(reading,new Set());
  for(const spelling of [word.lemma,...(word.aliases||[])])if(/[\p{Script=Han}]/u.test(spelling)&&/^[\p{Script=Han}々ぁ-ゖー]+$/u.test(spelling))result.get(reading).add(spelling.normalize('NFC'));
 }
 return result;
}
/** Reverse an attested whole-word reading; KANJIDIC dots preserve valid single-kanji boundary variants. */
export function createOkuriganaSpellingQuestion(word,locale,{kanji=new Map(),spellings=new Map()}={}){
 const segments=splitOkurigana(word);if(!segments)return;
 const [group,ending]=segments,reading=normaliseKana(word.pronunciation),answers=new Set([word.lemma]);
 for(const alias of word.aliases||[])if(/[\p{Script=Han}]/u.test(alias)&&/^[\p{Script=Han}々ぁ-ゖー]+$/u.test(alias))answers.add(alias.normalize('NFC'));
 for(const raw of kanji.get(group.text)?.kun||[]){
  if(!/^[ぁ-ゖー]+(?:\.[ぁ-ゖー]+)?$/u.test(raw)||normaliseKana(raw.replace('.',''))!==reading)continue;
  answers.add(group.text+(raw.includes('.')?normaliseKana(raw.split('.')[1]):''));
 }
 for(const spelling of spellings.get(reading)||[])if(spelling.match(/^[\p{Script=Han}々]+/u)?.[0]===group.text)answers.add(spelling);
 const acceptedAnswers=[...answers].filter(answer=>answer!==word.lemma),ko=locale==='ko';
 const context=[...answers].some(answer=>String(word.studyMeaning||'').includes(answer))?'':word.studyMeaning;
 return {id:`okurigana-spelling-${word.id}`,entryId:word.id,route:'vocabinput',category:'okurigana',boundaryKind:'spelling',context,prompt:reading,answer:word.lemma,acceptedAnswers,segments,
  instruction:ko?'한자와 올바른 오쿠리가나를 사용해 단어 전체를 입력하세요.':'Write the complete word using kanji and the correct okurigana.',
  explanation:(ko?`${reading} → ${word.lemma}\n한자: ${group.text} (${group.reading}) · 오쿠리가나: ${ending.text}`:`${reading} → ${word.lemma}\n${group.text} carries ${group.reading}; write ${ending.text} after it.`)+(acceptedAnswers.length?`\n${ko?'허용되는 다른 표기':'Also accepted'}: ${acceptedAnswers.join(' / ')}`:'')};
}
export function createJapaneseReadingExercises(words,locale,policy,spellingData={spellings:indexJapaneseSpellings(words)}){
 if(policy?.version!==1)return [];
 const excluded=new Set(policy.excludedSpellings),variants=new Map((policy.variants||[]).map(row=>[row.entryId,row.readings]));
 const bySpelling=new Map();for(const word of words){const readings=bySpelling.get(word.lemma)||new Set();for(const reading of japaneseReadings(word))readings.add(reading);bySpelling.set(word.lemma,readings);}
 const ko=locale==='ko',rows=[];
 for(const word of words){
  if(excluded.has(word.lemma)||bySpelling.get(word.lemma).size>1&&!variants.has(word.id))continue;
  const readings=[...new Set([...japaneseReadings(word),...(variants.get(word.id)||[]).map(normaliseKana)])];if(!readings.length||!/[\p{Script=Han}]/u.test(word.lemma))continue;
  const example=word.examples?.find(item=>item.text?.includes(word.lemma)&&!normaliseKana(item.text).includes(readings[0]));
  const context=normaliseKana(word.studyMeaning).includes(readings[0])?'':word.studyMeaning;
  rows.push({id:`reading-${word.id}`,entryId:word.id,route:'vocabinput',category:'reading',context,prompt:example?`${word.lemma}\n${example.text}`:word.lemma,answer:readings[0],acceptedAnswers:readings.slice(1),instruction:ko?'표시된 단어 전체의 읽기를 히라가나로 입력하세요.':'Type the reading of the complete displayed word in hiragana.',explanation:`${word.lemma} → ${readings.join(' / ')}\n${word.studyMeaning||''}`});
  const spelling=createOkuriganaSpellingQuestion(word,locale,spellingData);if(spelling)rows.push(spelling);
 }
 return rows;
}
