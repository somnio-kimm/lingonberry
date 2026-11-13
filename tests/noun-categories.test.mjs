import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseStudyPartOfSpeech,studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';

for(const [source,expected]of [['plural noun','noun'],['proper noun','noun'],['noun','noun'],['verb','verb']])test(`${source} uses the ${expected} study category`,()=>assert.equal(normaliseStudyPartOfSpeech(source),expected));
test('noun meanings share one choice pool without altering original grammatical metadata',()=>{
 const entries=[{id:'parts',word:'parts',partOfSpeech:'plural noun',meaning:'body organs'},{id:'London',word:'London',partOfSpeech:'proper noun',meaning:'the capital of the United Kingdom'},{id:'book',word:'book',partOfSpeech:'noun',meaning:'a written volume'}],before=structuredClone(entries);
 const words=studyWords({targetLanguage:'en',explanationLanguage:'en',entries});assert.ok(words.every(word=>word.pos==='noun'));
 const questions=createLexiconQuestions(studyProfiles.en).createVocabularyPool('vocabmeaning',words,'en').all();assert.equal(questions.length,3);assert.ok(questions.every(q=>q.options.length===3&&q.options.every(option=>option.type==='noun')));assert.deepEqual(entries,before);
});
