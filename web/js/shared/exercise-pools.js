import {isActiveExerciseCategory} from './language-exercises.js';
import {createRootPractice} from './root-practice.js';
import {collocationExercises} from './collocations.js';
import {createReadingChoices} from './reading-choices.js';
import {createDictionaryExercises} from './dictionary-practice.js';
import {createJapaneseReadingExercises,createOkuriganaSpellingQuestion,indexJapaneseSpellings} from './japanese-reading.js';
/** Build per-study data once. Curated questions take precedence over generic reading prompts. */
export function prepareLanguageExercises(study,words){
 const active=row=>isActiveExerciseCategory(study?.targetLanguage,row.category);
 const japanese=study?.targetLanguage==='ja',spellingData=japanese?{kanji:new Map((study?.practiceData?.kanji||[]).map(row=>[row.literal,row])),spellings:indexJapaneseSpellings(words)}:undefined,byId=japanese?new Map(words.map(word=>[word.id,word])):undefined;
 const curated=[],converted=new Set();
 for(const row of (study?.exercises||[]).filter(active)){
  if(japanese&&row.category==='okurigana'&&row.boundaryKind!=='spelling'){
   if(converted.has(row.entryId))continue;converted.add(row.entryId);const word=byId.get(row.entryId);
   const replacement=word&&createOkuriganaSpellingQuestion(word,study.explanationLanguage,spellingData);if(replacement)curated.push(replacement);
  }else curated.push(row);
 }
 const key=row=>[row.route,row.category,row.entryId,row.kanji||'',row.formKind||'',row.subKind||'',row.collocationId||'',row.rootFamilyId||'',row.boundaryKind||'reading'].join(':');
 const covered=new Set(curated.map(key));
 const generated=[...(isActiveExerciseCategory(study?.targetLanguage,'collocations')?collocationExercises(words,study?.explanationLanguage):[]),...createRootPractice(study,words),...(study?.targetLanguage==='ja'?createDictionaryExercises(study,words,{includeForms:isActiveExerciseCategory(study.targetLanguage,'forms')}):[]),...(study?.targetLanguage==='ja'?createJapaneseReadingExercises(words,study.explanationLanguage,study.readingPractice,spellingData):[])];
 const rows=[...curated,...generated.filter(row=>active(row)&&!covered.has(key(row)))];
 return study?.targetLanguage==='ja'?[...rows,...createReadingChoices(rows,words,study.explanationLanguage,spellingData.spellings)]:rows;
}
/** Pick within one specialist feature after its form/answer-mode filters are applied. */
export function selectExerciseRow(exercises,words,{category='all',previousId,random=Math.random}) {
 const ids=new Set(words.map(word=>word.id));
 const eligible=exercises.filter(row=>ids.has(row.entryId)&&(category==='all'||row.category===category));
 const different=eligible.filter(row=>row.id!==previousId);
 const candidates=different.length?different:eligible;
 return candidates[Math.floor(random()*candidates.length)];
}
