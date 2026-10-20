import {createDictionaryExercises} from './dictionary-practice.js';
import {createJapaneseReadingExercises} from './japanese-reading.js';
/** Build per-study data once. Curated questions take precedence over generic reading prompts. */
export function prepareLanguageExercises(study,words){
 const curated=study?.exercises||[];
 const key=row=>[row.route,row.category,row.entryId,row.kanji||'',row.formKind||'',row.subKind||'',row.boundaryKind||'reading'].join(':');
 const covered=new Set(curated.map(key));
 const generated=[...createDictionaryExercises(study,words),...(study?.targetLanguage==='ja'?createJapaneseReadingExercises(words,study.explanationLanguage,study.readingPractice):[])];
 return [...curated,...generated.filter(row=>!covered.has(key(row)))];
}
export function countExerciseTypes(exercises,words,route,formKind='all'){
 const ids=new Set(words.map(word=>word.id)),counts=new Map();
 for(const row of exercises)if(row.route===route&&ids.has(row.entryId)&&(formKind==='all'||row.formKind===formKind))counts.set(row.category,(counts.get(row.category)||0)+1);
 return counts;
}
