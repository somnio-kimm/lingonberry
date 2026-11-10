import {formAlternatives} from './form-alternatives.js';
export const nominalGenders=['masculine','feminine','neuter','plural'];
export const adjectiveEndings= {
 strong:{nom:['er','e','es','e'],acc:['en','e','es','e'],dat:['em','er','em','en'],gen:['en','er','en','er']},
 weak:{nom:['e','e','e','en'],acc:['en','e','e','en'],dat:['en','en','en','en'],gen:['en','en','en','en']},
 mixed:{nom:['er','e','es','en'],acc:['en','e','es','en'],dat:['en','en','en','en'],gen:['en','en','en','en']},
};
function declineAdjective(lemma,ending){
 if(!ending||['rosa','lila'].includes(lemma))return [lemma];
 if(lemma==='allein')return [];
 const stems=lemma==='hoch'?['hoh']:lemma==='teuer'?['teur','teuer']:/el$/u.test(lemma)?[lemma.slice(0,-2)+'l']:/e$/u.test(lemma)?[lemma.slice(0,-1)]:[lemma];
 return stems.map(stem=>stem+ending);
}
export function generateAdjectiveForms(lemma,grammaticalCase,gender,pattern){
 const ending=adjectiveEndings[pattern]?.[grammaticalCase]?.[nominalGenders.indexOf(gender)];
 return ending===undefined||lemma==='allein'?[]:declineAdjective(lemma,ending);
}
function findDegreeForms(word,{degree,ending}){
 if(ending==='adverbial')return formAlternatives(word.superlative);
 if(ending&&word.predicative_only)return [];
 const stems=degree==='positive'?[word.lemma,...(word.aliases||[])]:degree==='comparative'?formAlternatives(word.comparative):formAlternatives(word.superlative).flatMap(value=>/^am (\S+)en$/u.exec(value)?.[1]||[]);
 return stems.flatMap(stem=>declineAdjective(stem,ending));
}
/** Keep every possible analysis; a distractor must work for all of them. */
export function findAdjectiveFocusPatterns(word,text){
 const patterns=[];
 for(const degree of ['positive','comparative','superlative'])for(const ending of ['','e','er','es','en','em',...(degree==='superlative'?['adverbial']:[])]){
  const pattern={degree,ending};if(findDegreeForms(word,pattern).some(form=>form===text||form[0]?.toLocaleUpperCase('de')+form.slice(1)===text))patterns.push(pattern);
 }
 return patterns;
}
export function pickAdjectiveFocusOption(word,patterns){
 if(!patterns.length)return null;
 let common;
 for(const pattern of patterns){const forms=findDegreeForms(word,pattern);common=common===undefined?new Set(forms):new Set([...common].filter(form=>forms.includes(form)));if(!common.size)return null;}
 return [...common][0]||null;
}
