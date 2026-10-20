import {createJapaneseReadingExercises} from './japanese-reading.js';
/** Build per-study data once. Curated questions take precedence over generic reading prompts. */
export function prepareLanguageExercises(study,words){
 const curated=study?.exercises||[];
 if(study?.targetLanguage!=='ja')return curated;
 const covered=new Set(curated.map(row=>`${row.category}:${row.entryId}:${row.boundaryKind||'reading'}`));
 return [...curated,...createJapaneseReadingExercises(words,study.explanationLanguage,study.readingPractice).filter(row=>!covered.has(`${row.category}:${row.entryId}:${row.boundaryKind||'reading'}`))];
}
export function countExerciseTypes(exercises,words,route,formKind='all'){
 const ids=new Set(words.map(word=>word.id)),counts=new Map();
 for(const row of exercises)if(row.route===route&&ids.has(row.entryId)&&(formKind==='all'||row.formKind===formKind))counts.set(row.category,(counts.get(row.category)||0)+1);
 return counts;
}
