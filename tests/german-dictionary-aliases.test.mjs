import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {dictionaryEntries} from '../web/languages/de/js/core/dictionary.js';
import {vocabularyQuestions,vocabularyAnswerCorrect} from '../web/languages/de/js/core/vocabulary-tests.js';
const entries=[
 {id:'station',word:'Internationale Raumstation',article:'die',partOfSpeech:'noun',level:'C1',grammar:{related_forms:['ISS'],source_related_forms:['archived-station-form']}},
 {id:'know',word:'wissen',partOfSpeech:'verb',level:'C1'},
 {id:'yoghurt',word:'Joghurt',article:'der',aliases:['Jogurt'],partOfSpeech:'noun',level:'B1'},
 {id:'employee',word:'Angestellte',article:'der',partOfSpeech:'noun',level:'B2',grammar:{dictionaryLemma:'Angestellter'}},
];
function buildWords(locale){
 const core=fixture({entries}).data;
 const meanings={en:['International Space Station','to know','yoghurt','employee'],ko:['국제우주정거장','알다','요구르트','직원']};
 const pair=explanationFixture(core,locale,{entries:entries.map((entry,i)=>({id:entry.id,meaning:meanings[locale][i]}))}).data;
 return germanWords(assembleStudy(core,pair));
}
for(const locale of ['en','ko'])test(`German ${locale} dictionary finds active abbreviations, spelling aliases and canonical lemmas`,()=>{
 const words=buildWords(locale),before=JSON.stringify(words),find=query=>dictionaryEntries(words,{query}).map(word=>word.id);
 assert.deepEqual(find('ISS'),['station']); // Exact abbreviation precedes the substring in wissen.
 assert.deepEqual(find(' jogurt '),['yoghurt']);
 assert.deepEqual(find('Angestellter'),['employee']);
 assert.deepEqual(find('archived-station-form'),[]);
 assert.equal(JSON.stringify(words),before);
});
test('German alias search preserves level and part-of-speech filters and legacy search text',()=>{
 const words=buildWords('en');
 assert.deepEqual(dictionaryEntries(words,{query:'ISS',level:'B1'}),[]);
 assert.deepEqual(dictionaryEntries(words,{query:'ISS',pos:'verb'}).map(word=>word.id),['know']);
 assert.deepEqual(dictionaryEntries(words,{query:'ISS',level:'C1',pos:'noun'}).map(word=>word.id),['station']);
 const cached={...words[0],_search:'legacy cached text'};
 assert.deepEqual(dictionaryEntries([cached],{query:'is'}).map(word=>word.id),['station']);
});
test('German dictionary lookup forms do not become accepted Word Input answers',()=>{
 const words=buildWords('en'),questions=vocabularyQuestions('vocabinput',words,'en');
 const station=questions.find(q=>q.word.id==='station'),employee=questions.find(q=>q.word.id==='employee');
 assert.equal(vocabularyAnswerCorrect(station,'die Internationale Raumstation'),true);
 for(const answer of ['ISS','die ISS','Internationale Raumstation'])assert.equal(vocabularyAnswerCorrect(station,answer),false);
 assert.equal(vocabularyAnswerCorrect(employee,'der Angestellte'),true);
 assert.equal(vocabularyAnswerCorrect(employee,'der Angestellter'),false);
});
