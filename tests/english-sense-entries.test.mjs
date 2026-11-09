import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords,studyProfiles,matchesStudyLevel} from '../web/js/presentation/study-profiles.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {fixture,explanationFixture} from './package-fixture.js';

const common='IELTS 1.0–3.5',specialist='IELTS 8.5–9.0';
const core=fixture({id:'en-core',targetLanguage:'en',entries:[
 {id:'pedestrian-person',word:'pedestrian',partOfSpeech:'noun',level:common,
  example:{text:'The pedestrian waited at the crossing.'}},
 {id:'pedestrian-unoriginal',word:'pedestrian',partOfSpeech:'adjective',level:specialist,
  example:{text:'The critic found the plot pedestrian.'}},
]}).data;
const pairs=Object.fromEntries(['en','ko'].map(locale=>{
 const pair=explanationFixture(core,locale).data;
 const meanings=locale==='en'?['A person travelling on foot.','Ordinary and lacking imagination.']:['보행자','평범한, 진부한'];
 pair.entries.forEach((entry,index)=>{entry.meaning=meanings[index];});
 return [locale,pair];
}));

for(const locale of ['en','ko'])test(`same-spelling senses retain separate entries, levels and examples in ${locale} explanations`,()=>{
 const words=studyWords(assembleStudy(core,pairs[locale]));
 assert.equal(words.length,2);
 assert.deepEqual(words.map(word=>word.lemma),['pedestrian','pedestrian']);
 const atLevel=level=>words.filter(word=>matchesStudyLevel(word,level,studyProfiles.en));
 assert.deepEqual(atLevel(common).map(word=>word.id),['pedestrian-person']);
 assert.deepEqual(atLevel(specialist).map(word=>word.id),['pedestrian-unoriginal']);
 assert.equal(atLevel(common)[0].examples[0].text,'The pedestrian waited at the crossing.');
 assert.equal(atLevel(specialist)[0].examples[0].text,'The critic found the plot pedestrian.');
 assert.notEqual(atLevel(common)[0].studyMeaning,atLevel(specialist)[0].studyMeaning);
});

test('learning one sense does not mark its same-spelling advanced sense as learned',()=>{
 const entries=new Map();
 const storage={getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value)};
 const store=createLexiconStore(storage,studyProfiles.en);
 store.setWordStatus('pedestrian-person','mastered');
 assert.equal(store.wordStatus('pedestrian-person'),'mastered');
 assert.equal(store.wordStatus('pedestrian-unoriginal'),'new');
 const reloaded=createLexiconStore(storage,studyProfiles.en);
 assert.equal(reloaded.wordStatus('pedestrian-person'),'mastered');
 assert.equal(reloaded.wordStatus('pedestrian-unoriginal'),'new');
});
