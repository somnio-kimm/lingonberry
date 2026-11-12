/** Study content and explanation language are independent; only English has a self pair. */
export const STUDY_LANGUAGES=Object.freeze(['de','en','es','fr','ja','ko','zh']);
/** Release availability is independent of registered languages and explanation support. */
export const AVAILABLE_STUDY_LANGUAGES=Object.freeze(['de','en','ja','zh']);
export const isStudyLanguageAvailable=language=>AVAILABLE_STUDY_LANGUAGES.includes(language);
export const isLanguageCode=value=>typeof value==='string'&&/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
export function allowsExplanation(study,explanation){
 return isLanguageCode(study)&&isLanguageCode(explanation)&&(study!==explanation||study==='en');
}
export function explanationMatrix(languages=STUDY_LANGUAGES){
 return languages.flatMap(targetLanguage=>languages.filter(language=>allowsExplanation(targetLanguage,language)).map(explanationLanguage=>({targetLanguage,explanationLanguage,id:targetLanguage+'-'+explanationLanguage})));
}
