import {ENGLISH_LEVELS,assignEnglishLevel,normaliseEnglishSelection} from '../shared/english-levels.js';
/** Executable capabilities stay bundled; package definitions/examples are data only. */
const cefr=['A1','A2','B1','B2','C1','C2'];
export const studyProfiles=Object.freeze({
 ja:{id:'ja',exam:'JLPT',levels:['N5','N4','N3','N2','N1'],speech:'ja-JP',reading:true},
 ko:{id:'ko',exam:'TOPIK',levels:['1','2','3','4','5','6'],speech:'ko-KR'},
 en:{id:'en',exam:'IELTS',levels:ENGLISH_LEVELS,speech:'en-GB',normaliseLevel:normaliseEnglishSelection},
 es:{id:'es',exam:'DELE',levels:cefr,speech:'es-ES',nounArticles:true},
 fr:{id:'fr',exam:'DELF / DALF',levels:cefr,speech:'fr-FR',nounArticles:true},
});
export function matchesStudyLevel(word,selected,profile){
 const level=profile.levels.includes(selected)?selected:profile.levels[0];
 return (profile.id==='en'?assignEnglishLevel(word):word.level)===level;
}
export function normaliseStudyAnswer(value){return String(value??'').normalize('NFC').trim().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ');}
export function displayStudyWord(word){return word.article?word.article+(/[’']$/u.test(word.article)?'':' ')+word.lemma:word.lemma;}
export const studySpokenWord=(word,profile)=>profile.id==='ja'&&word.pronunciation?word.pronunciation:displayStudyWord(word);
export function studyInputAnswers(word,profile){
 const values=profile.nounArticles&&word.pos==='noun'&&word.article
  ?[word.article,...(word.acceptedArticles||[])].map(article=>article+(/[’']$/u.test(article)?'':' ')+word.lemma)
  :[word.lemma,...(word.aliases||[])];
 return [...new Set(values.map(normaliseStudyAnswer))];
}
export function studyWords(study){
 if(!study)return [];
 return study.entries.map(entry=>({id:entry.id,lemma:entry.word,level:study.targetLanguage==='en'?assignEnglishLevel(entry):entry.level,cefr:study.targetLanguage==='en'?assignEnglishLevel(entry):entry.level,pos:entry.partOfSpeech,subtype:entry.grammar?.subtype,article:entry.article,
  pronunciation:entry.pronunciation,aliases:entry.aliases||[],acceptedArticles:entry.grammar?.acceptedArticles||[],studyTier:entry.grammar?.studyTier,tags:entry.tags||[],
  referenceExamples:entry.referenceExamples||[],exampleStatus:entry.exampleStatus,studyMeaning:entry.meaning,studyExplanationLanguage:study.explanationLanguage,
  examples:[entry.example,...(entry.additionalExamples||[])].filter(Boolean).map(example=>({...example,de:example.text,studyTranslation:example.translation,[study.explanationLanguage]:example.translation})),
 }));
}
