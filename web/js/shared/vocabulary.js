import {shuffle} from './random.js';
export {shuffle} from './random.js';
import {collocationQuestions,collocationAnswerCorrect} from './collocations.js';
// Vocabulary-only questions: no external definitions or sentence text is added.
export const VOCABULARY_MODES = Object.freeze(['vocabinput','vocabmeaning']);
export const vocabularyWord = word => word.lemma ?? word.hanzi ?? '';
export const normalize = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
const glossKey = value => normalize(value).toLocaleLowerCase().replace(/^to\s+/u, '').replace(/[.!。]+$/u, '');
export function vocabularyType(word) {
  if (word.pos) return word.pos === 'functional' ? word.subtype || '' : word.pos;
  const aliases = { n: 'noun', v: 'verb', a: 'adjective', d: 'adverb', q: 'classifier', m: 'numeral', r: 'pronoun', p: 'preposition', c: 'conjunction', u: 'particle', phrase: 'expression', idiom: 'expression' };
  return [...new Set(String(word.partOfSpeech || '').split(/\s*\/\s*/u).map(s => {
    const key = normalize(s).toLowerCase(); return aliases[key] || key;
  }).filter(Boolean))].sort().join('/');
}
export function vocabularyMeaning(word, locale) {
  if (typeof word.studyMeaning === 'string') return normalize(word.studyMeaning);
  const value = locale === 'ko' ? word.meaning_ko ?? word.meaningKo : word.meaning_en ?? word.meaningEn;
  return normalize(Array.isArray(value) ? value.join('; ') : value);
}
/** Shared pool algorithm; input spelling and grading are language policies. */
export function createVocabularyEngine({inputAnswer=vocabularyWord,gradeInput=(question,input)=>
  (question.acceptedAnswers||[question.answer]).some(answer=>normalize(input)===normalize(answer))}={}) {
function createVocabularyPool(mode, words, locale = 'en', category='vocabulary') {
  if(category==='collocations'){const questions=collocationQuestions(mode,words,words.find(word=>word.studyExplanationLanguage)?.studyExplanationLanguage||locale);return {all:()=>questions,choose(excludeId,random=Math.random){const pool=questions.length>1?questions.filter(q=>q.id!==excludeId):questions;const q=pool[Math.floor(random()*pool.length)];return q?.options?{...q,options:shuffle(q.options,random)}:q;}};}
  locale = words.find(word => word.studyExplanationLanguage)?.studyExplanationLanguage || locale;
  if (!VOCABULARY_MODES.includes(mode) || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) return {all:()=>[],choose:()=>undefined};
  const rows = words.map(word => {
    const text = vocabularyMeaning(word, locale), type = vocabularyType(word);
    const keys = [...new Set(text.split(/[;；]/u).map(glossKey).filter(Boolean))];
    return { word, text, type, keys, signature: keys.slice().sort().join('\u0001') };
  }).filter(row => row.word.id && vocabularyWord(row.word) && row.text && row.type);
  const groups = new Map(), synonyms = new Map(), homographs = new Map();
  for (const row of rows) {
    const synonymKey = row.type + '\u0000' + row.signature, homographKey = row.type + '\u0000' + vocabularyWord(row.word);
    if (!groups.has(row.type)) groups.set(row.type, []); groups.get(row.type).push(row);
    if (!synonyms.has(synonymKey)) synonyms.set(synonymKey, []); synonyms.get(synonymKey).push(row);
    if (!homographs.has(homographKey)) homographs.set(homographKey, new Set());
    for (const key of row.keys) homographs.get(homographKey).add(key);
  }
  function build(row,random) {
    const word = row.word, lemma = vocabularyWord(word);
    const question = { id: word.id + ':' + locale, mode, word, locale, type: row.type,
      prompt: mode === 'vocabinput' ? row.text : lemma,
      answer: mode === 'vocabinput' ? inputAnswer(word) : row.text,
      example: { de: lemma, en: vocabularyMeaning(word, 'en'), ko: vocabularyMeaning(word, 'ko') } };
    if (mode === 'vocabinput') {
      question.acceptedAnswers = [...new Set(synonyms.get(row.type + '\u0000' + row.signature).flatMap(({ word: w }) => {
        return [inputAnswer(w)];
      }))];
      return question;
    }
    const options = [{ id: word.id, text: row.text, type: row.type, meanings:{en:vocabularyMeaning(word,'en'),ko:vocabularyMeaning(word,'ko')} }];
    const blocked = new Set(homographs.get(row.type + '\u0000' + lemma));
    const group = groups.get(row.type), start = Math.floor(random() * group.length);
    for (let i = 0; i < group.length && options.length < 4; i++) {
      const other = group[(start + i) % group.length];
      if (vocabularyWord(other.word) === lemma || other.keys.some(key => blocked.has(key))) continue;
      options.push({ id: other.word.id, text: other.text, type: other.type, meanings:{en:vocabularyMeaning(other.word,'en'),ko:vocabularyMeaning(other.word,'ko')} });
      for (const key of other.keys) blocked.add(key);
    }
    if (options.length < 2) return null;
    question.options = shuffle(options, random);
    return question;
  }
  return {
    all(random=Math.random){return rows.map(row=>build(row,random)).filter(Boolean);},
    choose(excludeId,random=Math.random){
      const start=Math.floor(random()*rows.length);let previous;
      for(let i=0;i<rows.length;i++){const row=rows[(start+i)%rows.length];if(row.word.id+':'+locale===excludeId){previous=row;continue;}const question=build(row,random);if(question)return question;}
      return previous?build(previous,random)||undefined:undefined;
    },
  };
}
function vocabularyQuestions(mode,words,locale='en',random=Math.random){return createVocabularyPool(mode,words,locale).all(random);}

function vocabularyAnswerCorrect(question,input) {
  return question.mode==='vocabmeaning'?input===question.word.id:question.collocationId?collocationAnswerCorrect(question,input):gradeInput(question,input);
}
return {createVocabularyPool,vocabularyQuestions,vocabularyAnswerCorrect};
}
export { snapshotQuestion as snapshotVocabularyQuestion } from './question-snapshot.js';
export function validVocabularyQuestion(question) {
  return !!(question && VOCABULARY_MODES.includes(question.mode) && question.word?.id && vocabularyWord(question.word)
    && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(question.locale) && question.prompt && question.answer
    && (question.mode === 'vocabinput' ? Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0 && question.acceptedAnswers.every(answer => typeof answer === 'string' && answer.trim())
      : Array.isArray(question.options) && question.options.length >= 2 && question.options.every(option => option.type === question.type && option.id && option.text)
        && question.options.some(option => option.id === question.word.id)));
}
