import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assignIeltsTopics} from '../scripts/content/ielts-topics.mjs';
import {isCircularDefinition} from '../scripts/build-broad-multilingual-packages.mjs';
import {STUDY_TOPICS,matchesStudyTopic} from '../web/js/shared/study-topics.js';
import {studyWords,studyProfiles} from '../web/js/presentation/study-profiles.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
for(const language of ['ja','ko','en','es','fr'])test(`${language}: broad dictionary preserves starter IDs and isolates unfinished examples`,async()=>{
 const core=await read(`language-packages/${language}-core-2.0.0.json`),old=await read(`language-packages/${language}-core-1.0.0.json`),en=await read(`language-packages/${language}-en-2.0.0.json`),ko=await read(`language-packages/${language}-ko-2.0.0.json`);
 const entries=new Map(core.entries.map(row=>[row.id,row]));
 for(const entry of old.entries){const updated=entries.get(entry.id);assert.equal(updated.word,entry.word);assert.deepEqual(updated.example,entry.example);assert.equal(updated.level,entry.level);}
 for(const pos of ['noun','verb','adjective','adverb'])assert.ok(core.entries.filter(row=>row.partOfSpeech===pos).length>100,pos);
 for(let i=0;i<core.entries.length;i++){const entry=core.entries[i];assert.equal(en.entries[i].id,entry.id);assert.equal(ko.entries[i].id,entry.id);if(!entry.example){assert.equal(entry.exampleStatus,'bilingual-example-pending');assert.ok(entry.provenance.source.url.startsWith('https://krdict.korean.go.kr/'));}if(entry.referenceExamples&&language!=='ko')assert.ok(entry.grammar.senseAlignment.score>=2);if(language==='en')assert.equal(isCircularDefinition(entry.word,en.entries[i].meaning),false);}
 const words=studyWords({...core,explanationLanguage:'ko'}),engine=createLexiconQuestions(studyProfiles[language]),sentences=engine.listeningQuestions('listensentence',words);
 assert.equal(sentences.length,old.entries.length);assert.equal(engine.listeningQuestions('listenword',words).length,core.entries.length);
 assert.equal(core.contentReview.examplesPending,core.entries.length-sentences.length);
});
test('English topics filter legacy packages independently of exam tags',()=>{
 const shared=assignIeltsTopics({word:'teacher',meaning:'A person who teaches at a school.'});
 const research=assignIeltsTopics({word:'hypothesis',meaning:'A testable explanation used in research.'});
 const travel=assignIeltsTopics({word:'reservation',meaning:'An arrangement to keep a hotel room.'});
 assert.equal(matchesStudyTopic(shared,'education'),true);assert.equal(matchesStudyTopic(shared,'travel'),false);
 assert.equal(matchesStudyTopic(research,'research'),true);assert.equal(matchesStudyTopic(travel,'travel'),true);
 for(const tags of [shared,research,travel]){
  assert.equal(matchesStudyTopic(tags,'all'),true);
  for(const tag of tags.filter(tag=>tag.startsWith('topic:')))assert.ok(STUDY_TOPICS[tag.slice(6)]);
 }
 assert.equal(matchesStudyTopic(undefined,'research'),false);
});
test('English definitions cannot simply repeat the headword',()=>{
 assert.equal(isCircularDefinition('school','A school.'),true);assert.equal(isCircularDefinition('eat','To eat.'),true);assert.equal(isCircularDefinition('school','A place where children are taught.'),false);
});

test('Japanese dictation speaks the selected reading of an ambiguous headword',()=>{
 const word={id:'ja-life',lemma:'生',pronunciation:'せい',aliases:['せい']};const engine=createLexiconQuestions(studyProfiles.ja);const [question]=engine.listeningQuestions('listenword',[word]);assert.equal(question.spokenText,'せい');assert.equal(engine.listeningAnswerCorrect(question,'生'),true);assert.equal(engine.listeningAnswerCorrect(question,'せい'),true);assert.equal(engine.listeningAnswerCorrect(question,'なま'),false);
});
