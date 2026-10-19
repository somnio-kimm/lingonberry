import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignEnglishLevel,normaliseEnglishSelection,ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';
import {studyWords,studyProfiles,matchesStudyLevel} from '../web/js/presentation/study-profiles.js';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';

test('legacy English editorial tiers populate the four requested groups',()=>{
 for(const [tier,level,expected] of [
  ['foundation','1.0','IELTS 1.0–3.5'],['everyday','3.0','IELTS 1.0–3.5'],
  ['independent','5.0','IELTS 4.0–6.5'],['advanced','6.5','IELTS 7.0–8.0'],['precision','8.0','IELTS 8.5–9.0'],
 ]){
  assert.equal(assignEnglishLevel({level,grammar:{studyTier:tier}}),expected);
  assert.equal(assignEnglishLevel({level,studyTier:tier}),expected,'saved Review snapshot');
  assert.equal(assignEnglishLevel({level}),expected,'old source without tier metadata');
 }
 assert.equal(assignEnglishLevel({level:'IELTS 7.0–8.0',grammar:{studyTier:'precision'}}),'IELTS 7.0–8.0','explicit group wins');
});

test('all published English entries retain identity, examples and source data',()=>{
 const core=JSON.parse(readFileSync(new URL('../language-packages/en-core-3.0.0.json',import.meta.url)));
 const original=JSON.stringify(core),words=studyWords(core),counts=Object.fromEntries(ENGLISH_LEVELS.map(level=>[level,0]));
 assert.equal(words.length,12016);assert.equal(new Set(words.map(word=>word.id)).size,12016);
 words.forEach((word,index)=>{assert.ok(ENGLISH_LEVELS.includes(word.level));counts[word.level]++;assert.equal(word.id,core.entries[index].id);assert.equal(word.lemma,core.entries[index].word);assert.equal(word.examples[0]?.text,core.entries[index].example?.text);});
 assert.deepEqual(Object.values(counts),[2002,2501,3005,4508]);assert.equal(JSON.stringify(core),original);
 assert.ok(ENGLISH_LEVELS.every(level=>words.some(word=>word.level===level&&word.examples.length)));
});

test('saved half-band selections choose the containing range without losing progress',()=>{
 for(const [savedLevel,expected] of [
  ['1.0','IELTS 1.0–3.5'],['3.5','IELTS 1.0–3.5'],['4.0','IELTS 4.0–6.5'],['6.5','IELTS 4.0–6.5'],
  ['7.0','IELTS 7.0–8.0'],['8.0','IELTS 7.0–8.0'],['8.5','IELTS 8.5–9.0'],['9.0','IELTS 8.5–9.0'],
  ['all','all'],['IELTS 7.0–8.0','IELTS 7.0–8.0'],['bad','IELTS 1.0–3.5'],
 ]){
  const saved={version:1,wordStatus:{go:'mastered'},wrongs:{q:{question:{word:{id:'go',lemma:'go',level:'1.0'}},input:'went',count:3}},preferences:{studyLevel:savedLevel}};
  const data=new Map([['learn-language.en.lexicon.v1',JSON.stringify(saved)]]);
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const store=createLexiconStore(storage,studyProfiles.en);
  assert.equal(store.state.preferences.studyLevel,expected);assert.deepEqual(store.state.wrongs,saved.wrongs);assert.deepEqual(store.state.wordStatus,saved.wordStatus);
  store.preference('studyLevel',expected);assert.equal(createLexiconStore(storage,studyProfiles.en).state.preferences.studyLevel,expected);
  assert.equal(matchesStudyLevel(store.state.wrongs.q.question.word,'IELTS 1.0–3.5',studyProfiles.en),true,'legacy Review snapshot remains filterable');
 }
 for(const invalid of [null,undefined,0,'','0.0','9.5','3.9'])assert.equal(normaliseEnglishSelection(invalid),'IELTS 1.0–3.5');
});
