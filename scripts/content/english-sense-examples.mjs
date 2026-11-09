import {studyWords} from '../../web/js/presentation/study-profiles.js';
import {selectWordExample} from '../../web/js/shared/word-example.js';

const fold = text => text.normalize('NFKC').trim().toLowerCase()
 .replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ');

/** Check the examples learners actually see, including dictionary fallbacks. */
export function auditEnglishSenseExamples(study) {
 const groups = new Map();
 const combinedMeanings = study.entries.filter(entry => new Set((entry.meanings || []).map(fold)).size > 1)
  .map(entry => entry.id);
 for (const word of studyWords(study)) {
  const spelling = fold(word.lemma);
  if (!groups.has(spelling)) groups.set(spelling, []);
  groups.get(spelling).push(word);
 }
 const missingExamples = [], repeatedExamples = [];
 let repeatedHeadwords = 0, entriesUnderRepeatedHeadwords = 0, acrossLevels = 0;
 for (const words of groups.values()) {
  if (words.length < 2) continue;
  repeatedHeadwords++;
  entriesUnderRepeatedHeadwords += words.length;
  if (new Set(words.map(word => word.level)).size > 1) acrossLevels++;
  const examples = new Map();
  for (const word of words) {
   const example = selectWordExample(word, 'en');
   if (!example) {
    missingExamples.push(word.id);
    continue;
   }
   const sentence = fold(example.text), meaning = fold(word.studyMeaning);
   const previous = examples.get(sentence);
   if (previous && (previous.meaning !== meaning || previous.pos !== word.pos)) {
    repeatedExamples.push({word:word.lemma, ids:[previous.id, word.id]});
   } else if (!previous) {
    examples.set(sentence, {id:word.id, meaning, pos:word.pos});
   }
  }
 }
 return {repeatedHeadwords, entriesUnderRepeatedHeadwords, acrossLevels, missingExamples, repeatedExamples, combinedMeanings};
}
