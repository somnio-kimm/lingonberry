/** Bundled exercise rules; prompts and answers arrive only as validated package data. */
export const EXERCISE_CATEGORIES=Object.freeze({
 reading:['Word Reading','단어 읽기'],onyomi:['On’yomi','음독'],kunyomi:['Kun’yomi','훈독'],okurigana:['Kanji and Okurigana','한자와 오쿠리가나'],
 forms:['Form Input','형태 입력'],particles:['Particles','조사'],counters:['Counters','조수사'],transitivity:['Transitive and Intransitive Verbs','타동사와 자동사'],kanji:['Confusable Kanji','헷갈리는 한자'],
 collocations:['Collocations','연어'],phrasal:['Phrasal Verbs','구동사'],patterns:['Verb Patterns','동사 구문'],articles:['Articles and Countability','관사와 가산성'],confusables:['Confusable Words','헷갈리는 단어'],roots:['Root Families','어근 모음'],
});
export const EXERCISE_ROUTES=Object.freeze({
 ja:{reading:['vocabinput'],onyomi:['vocabinput'],kunyomi:['vocabinput'],okurigana:['vocabinput'],kanji:['vocabmeaning','vocabinput'],transitivity:['vocabmeaning','vocabinput'],forms:['forms'],particles:['particles'],counters:['counters']},
 en:{collocations:['vocabmeaning','vocabinput'],phrasal:['vocabmeaning','vocabinput'],confusables:['vocabmeaning','vocabinput'],roots:['vocabmeaning','vocabinput'],patterns:['patterns'],articles:['articles']},
});
export const exerciseLabel=(id,locale='en')=>EXERCISE_CATEGORIES[id]?.[locale==='ko'?1:0]||id;
export function exerciseCategories(exercises,route){return [...new Set(exercises.filter(row=>row.route===route).map(row=>row.category))];}
export function exerciseModes(language){return Object.fromEntries(Object.values(EXERCISE_ROUTES[language]||{}).flat().filter(route=>!route.startsWith('vocab')).map(route=>[route,[exerciseLabel(route),'📝','teal']]));}
export function createExerciseQuestions(exercises,words,route,category,locale){
 const byId=new Map(words.map(word=>[word.id,word]));
 return exercises.filter(row=>row.route===route&&(category==='all'||row.category===category)&&byId.has(row.entryId)).map(row=>({
  ...row,id:row.id,exercise:true,mode:route,locale,word:byId.get(row.entryId),
  options:row.options?.map((text,index)=>({id:String(index),text})),
  correctOption:row.options?String(row.options.indexOf(row.answer)):undefined,
 }));
}
export function exerciseAnswerCorrect(question,input){
 if(question.options)return input===question.correctOption;
 // Kana input methods may produce full-width Latin or katakana. Never strip kana endings.
 const fold=value=>String(value).normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/gu,' ').replace(/[ァ-ヶ]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 return [question.answer,...(question.acceptedAnswers||[])].some(answer=>fold(answer)===fold(input));
}
export function chooseExerciseQuestion(questions,previousId,random=Math.random){const candidates=questions.length>1?questions.filter(q=>q.id!==previousId):questions;return candidates[Math.floor(random()*candidates.length)];}
