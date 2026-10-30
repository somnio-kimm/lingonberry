import {isActiveExerciseCategory} from './language-exercises.js';
import {createRootPractice} from './root-practice.js';
import {collocationExercises} from './collocations.js';
import {createReadingChoices} from './reading-choices.js';
import {createDictionaryExercises} from './dictionary-practice.js';
import {createJapaneseReadingExercises} from './japanese-reading.js';
/** Build per-study data once. Curated questions take precedence over generic reading prompts. */
export function prepareLanguageExercises(study,words){
 const active=row=>isActiveExerciseCategory(study?.targetLanguage,row.category);
 const curated=(study?.exercises||[]).filter(active);
 const key=row=>[row.route,row.category,row.entryId,row.kanji||'',row.formKind||'',row.subKind||'',row.collocationId||'',row.rootFamilyId||'',row.boundaryKind||'reading'].join(':');
 const covered=new Set(curated.map(key));
 const generated=[...(isActiveExerciseCategory(study?.targetLanguage,'collocations')?collocationExercises(words,study?.explanationLanguage):[]),...createRootPractice(study,words),...(study?.targetLanguage==='ja'?createDictionaryExercises(study,words,{includeForms:isActiveExerciseCategory(study.targetLanguage,'forms')}):[]),...(study?.targetLanguage==='ja'?createJapaneseReadingExercises(words,study.explanationLanguage,study.readingPractice):[])];
 const rows=[...curated,...generated.filter(row=>active(row)&&!covered.has(key(row)))];
 return study?.targetLanguage==='ja'?[...rows,...createReadingChoices(rows,words,study.explanationLanguage)]:rows;
}
/** Pick within one specialist feature after its form/answer-mode filters are applied. */
export function selectExerciseRow(exercises,words,{category='all',previousId,random=Math.random}) {
 const ids=new Set(words.map(word=>word.id));
 const eligible=exercises.filter(row=>ids.has(row.entryId)&&(category==='all'||row.category===category));
 const different=eligible.filter(row=>row.id!==previousId);
 const candidates=different.length?different:eligible;
 return candidates[Math.floor(random()*candidates.length)];
}
