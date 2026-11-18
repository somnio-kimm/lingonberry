import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {snapshotQuestion} from '../web/js/shared/question-snapshot.js';
import {clozeSentenceTranslation} from '../web/js/shared/cloze-translation.js';
import {findTranslationFocus} from '../web/js/shared/translation-focus.js';
import {renderTranslationTarget} from '../web/js/shared/translation-target-view.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
test('the reported published go-by-bus example aligns before and after snapshot storage',async()=>{
 const [core,pair]=await Promise.all([read('language-packages/en-core-7.0.5.json'),read('language-packages/en-ko-7.0.6.json')]),study=assembleStudy(core,pair),words=studyWords(study),target=words.find(word=>word.id==='en-lex-6727e5f60d8b9c67155d'),other=words.find(word=>word.lemma==='come');assert.equal(target.studyMeaning,'가다');
 const question=createLexiconQuestions(studyProfiles.en).createSentencePool('cloze',[target,other],'ko').all(()=>.2).find(question=>question.word.id===target.id);assert.ok(question);assert.equal(question.sentence,'I go to school by bus.');
 for(const q of [question,snapshotQuestion(question)]){
  const before=structuredClone(q),text=clozeSentenceTranslation(q);assert.equal(text,'저는 버스로 학교에 가요.');const spans=findTranslationFocus({text,word:q.word,locale:q.locale,studyLanguage:'en'});assert.deepEqual(spans,[{start:11,text:'가요'}]);assert.ok(renderTranslationTarget(text,{word:q.word,locale:q.locale,studyLanguage:'en'}).includes('data-translation-target>가요</span>'));assert.deepEqual(q,before);
 }
});
