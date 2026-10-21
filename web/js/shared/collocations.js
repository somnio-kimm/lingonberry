/** Compatible with the default vocabulary snapshots/Review; choices remain verb phrases. */
export function collocationQuestions(mode,words,locale='en'){
 const result=[];
 for(const word of words)for(const row of word.collocations||[]){
  const question={id:`${row.id}:${mode}:${locale}`,mode,word,locale,type:'expression',collocationId:row.id,phrase:row.phrase,
   prompt:mode==='vocabmeaning'?row.phrase:`${row.meaning}\n(${word.lemma||word.hanzi})`,answer:mode==='vocabinput'?row.phrase:row.meaning,
   acceptedAnswers:[row.phrase,...row.acceptedAnswers],example:{de:row.example,[locale]:row.exampleTranslation}};
  if(mode==='vocabmeaning')question.options=row.meaningChoices.map((text,i)=>({id:text===row.meaning?word.id:`${row.id}-option-${i}`,text,type:'expression',meanings:{[locale]:text}}));
  result.push(question);
 }
 return result;
}
export const collocationInstruction=(mode,locale)=>locale==='ko'?(mode==='vocabinput'?'괄호 안 단어를 사용하여 학습한 연어를 기본형으로 입력하세요.':'연어의 뜻을 선택하세요.'):(mode==='vocabinput'?'Type the studied collocation in dictionary form, using the word in brackets.':'Choose the meaning of the collocation.');
export function collocationAnswerCorrect(question,input){
 const fold=value=>String(value).normalize('NFKC').trim().toLocaleLowerCase().replace(/[’‘]/gu,"'").replace(/\s+/gu,' ');
 return question.acceptedAnswers.some(value=>fold(value)===fold(input));
}
export function collocationExercises(words,locale){
 return ['vocabinput','vocabmeaning'].flatMap(mode=>collocationQuestions(mode,words,locale).map(q=>({id:q.id.replace(/:/gu,'-'),entryId:q.word.id,category:'collocations',route:mode,collocationId:q.collocationId,phrase:q.phrase,prompt:q.prompt,answer:q.answer,acceptedAnswers:q.acceptedAnswers,
  ...(q.options?{options:q.options.map(option=>option.text)}:{}),instruction:collocationInstruction(mode,locale),explanation:`${q.phrase}\n${q.word.collocations.find(row=>row.id===q.collocationId).meaning}\n${q.example.de}\n${q.example[locale]}`})));
}

export const collocationSearchTerms=word=>(word.collocations||[]).flatMap(row=>[row.phrase,row.meaning]);
