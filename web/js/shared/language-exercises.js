import {gradePhraseGaps} from './phrase-gaps.js';
import {shuffle} from './vocabulary.js';
/** Bundled exercise rules; prompts and answers arrive only as validated package data. */
const EXERCISE_CATEGORIES=Object.freeze({
 reading:['Word Reading','한자 읽기'],onyomi:['On’yomi','음독'],kunyomi:['Kun’yomi','훈독'],okurigana:['Kanji and Okurigana','오쿠리가나'],
 forms:['Form Input','형태 입력'],particles:['Particles','조사'],counters:['Counters','조수사'],transitivity:['Transitive and Intransitive Verbs','타동사와 자동사'],kanji:['Confusable Kanji','헷갈리는 한자'],
 collocations:['Collocations','연어'],phrasal:['Phrasal Verbs','구동사'],patterns:['Verb Patterns','동사 구문'],articles:['Articles and Countability','관사와 가산성'],confusables:['Confusable Words','헷갈리는 단어'],roots:['Root Families','어근 모음'],
});
export const EXERCISE_ROUTES=Object.freeze({
 ja:{reading:['vocabmeaning','vocabinput'],onyomi:['vocabmeaning','vocabinput'],kunyomi:['vocabmeaning','vocabinput'],okurigana:['vocabmeaning','vocabinput'],kanji:['vocabmeaning','vocabinput'],transitivity:['vocabmeaning','vocabinput'],forms:['forms'],particles:['particles'],counters:['counters']},
 en:{collocations:['vocabmeaning','vocabinput'],phrasal:['vocabmeaning','vocabinput'],confusables:['vocabmeaning','vocabinput'],roots:['vocabmeaning','vocabinput'],patterns:['patterns'],articles:['articles']},
});
export const exerciseLabel=(id,locale='en')=>EXERCISE_CATEGORIES[id]?.[locale==='ko'?1:0]||id;
/** Sections may combine content categories without rewriting stored exercise identities. */
export const exerciseSectionCategories=(language,section)=>language==='en'&&section==='collocations'?['collocations','phrasal']:[section];
const removedCategories=Object.freeze({en:['articles','confusables','patterns'],ja:['collocations','transitivity','forms','particles','counters','kanji']});
export const isActiveExerciseCategory=(language,category)=>!removedCategories[language]?.includes(category);
export function exerciseModes(language){
 // Keep the package schema registry above readable for existing downloads and Review history.
 const categories=[...new Set(['collocations',...Object.keys(EXERCISE_ROUTES[language]||{})])].filter(id=>isActiveExerciseCategory(language,id)&&!(language==='en'&&id==='phrasal'));
 const icons={reading:'📚',onyomi:'音',kunyomi:'訓',okurigana:'✍️',kanji:'🔎',transitivity:'🔄',forms:'⌨️',particles:'📝',counters:'🔢',collocations:'🔗',phrasal:'🧩',confusables:'🔍',roots:'🌱',patterns:'📝',articles:'🔠'};
 return Object.fromEntries(categories.map(id=>[id,[language==='en'&&id==='collocations'?'Collocations & Phrasal Verbs':exerciseLabel(id),icons[id]||'📝','teal']]));
}

export function createExerciseQuestions(exercises,words,route,category,locale,random=Math.random){
 const byId=new Map(words.map(word=>[word.id,word]));
 return exercises.filter(row=>row.route===route&&(category==='all'||row.category===category)&&byId.has(row.entryId)).map(row=>({
  ...row,id:row.id,exercise:true,mode:route,locale,word:byId.get(row.entryId),
  options:row.options?shuffle(row.options.map((text,index)=>({id:String(index),text})),random):undefined,
  correctOption:row.options?String(row.options.indexOf(row.answer)):undefined,
 }));
}
export function exerciseAnswerCorrect(question,input){
 if(question.options)return input===question.correctOption;
 if(question.gapFill)return gradePhraseGaps(question.gapFill,input).correct;
 // Kana input methods may produce full-width Latin or katakana. Never strip kana endings.
 const fold=value=>String(value).normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu,' ').replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 return [question.answer,...(question.acceptedAnswers||[])].some(answer=>fold(answer)===fold(input));
}
export const JAPANESE_FORM_KINDS=Object.freeze({te:['Te Form','て형'],past:['Past','과거형'],negative:['Negative','부정형'],potential:['Potential','가능형'],passive:['Passive','수동형'],causative:['Causative','사역형'],'causative-passive':['Causative Passive','사역 수동형'],conditional:['Conditional','조건형'],volitional:['Volitional','의지형'],adjective:['Adjective','형용사']});
export const formKindLabel=(id,locale='en')=>JAPANESE_FORM_KINDS[id]?.[locale==='ko'?1:0]||id;
