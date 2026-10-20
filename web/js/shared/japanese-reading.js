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
export function createJapaneseReadingExercises(words,locale,policy){
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
  const segments=splitOkurigana(word);if(!segments)continue;
  const [kanji,ending]=segments,accepted=readings.filter(value=>value.endsWith(ending.text)&&value.length>ending.text.length).map(value=>value.slice(0,-ending.text.length));
  rows.push({id:`okurigana-${word.id}`,entryId:word.id,route:'vocabinput',category:'okurigana',boundaryKind:'reading',context,prompt:`${word.lemma} → ${kanji.text}【　】${ending.text}`,answer:kanji.reading,acceptedAnswers:accepted,segments,instruction:ko?`${kanji.text}에 해당하는 읽기만 입력하세요. 뒤에 적힌 ${ending.text}는 입력하지 마세요.`:`Type only the reading of ${kanji.text}. Leave the written ${ending.text} ending out.`,explanation:ko?`${kanji.text} = ${kanji.reading}. ${ending.text}는 이미 가나로 적힌 부분입니다.`:`${kanji.text} = ${kanji.reading}. ${ending.text} is already written in kana.${accepted.length>1?' Accepted readings: '+accepted.join(' / '):''}`});
  rows.push({id:`ending-${word.id}`,entryId:word.id,route:'vocabinput',category:'okurigana',boundaryKind:'ending',context,prompt:`${readings[0]} → ${kanji.text}【　】`,answer:ending.text,segments,instruction:ko?'한자 뒤에 직접 적어야 하는 가나 부분만 입력하세요.':'Type only the kana that must be written after the kanji.',explanation:ko?`${word.lemma}: ${kanji.text}는 ${kanji.reading}, 뒤에 적는 가나는 ${ending.text}입니다.`:`${word.lemma}: ${kanji.text} carries ${kanji.reading}; write ${ending.text} after it.`});
 }
 return rows;
}
