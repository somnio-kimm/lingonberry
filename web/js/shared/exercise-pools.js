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

/** Select lightweight source rows first; materialise only the question shown on screen. */
export function selectExerciseRow(exercises,words,{route,category='all',formKind='all',previousId,includeVocabulary=false,random=Math.random}){
 const ids=new Set(words.map(word=>word.id)),groups=new Map();
 for(const row of exercises){if(row.route!==route||!ids.has(row.entryId)||(category!=='all'&&row.category!==category)||(formKind!=='all'&&row.formKind!==formKind))continue;const key=category==='all'&&route.startsWith('vocab')?row.category:'exercise';const group=groups.get(key)||[];group.push(row);groups.set(key,group);}
 if(includeVocabulary)groups.set('vocabulary',[null]);
 const values=[...groups.values()];if(!values.length)return undefined;const group=values[Math.floor(random()*values.length)];
 const available=group.length>1?group.filter(row=>row?.id!==previousId):group;
 return available[Math.floor(random()*available.length)];
}
