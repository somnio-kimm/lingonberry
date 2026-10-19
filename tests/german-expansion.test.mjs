import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {convertGermanRows,displayHeadword} from '../scripts/build-german-package.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {wordHeading} from '../web/languages/de/js/core/words.js';
import {vocabularyInputAnswer} from '../web/languages/de/js/core/vocabulary-tests.js';
import {validateExplanation} from '../web/js/packages/schema.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const core=await read('language-packages/de-core-3.0.0.json');
const english=await read('language-packages/de-en-3.0.0.json');
const korean=await read('language-packages/de-ko-3.0.0.json');
const evidence=await read('language-packages/sources/goethe-headword-evidence.json');
const original=await read('language-packages/de-core-2.0.0.json');
const byId=new Map(core.entries.map(row=>[row.id,row]));
test('all 88 imported article-note headwords display and accept clean German nouns',()=>{
 const affected=core.entries.filter(row=>/^\((der|die|das)\) /u.test(row.word));
 assert.equal(affected.length,88);
 const words=new Map(germanWords(assembleStudy(core,english)).map(word=>[word.id,word]));
 for(const entry of affected){
  const word=words.get(entry.id);
  assert.equal(word.article,entry.article);
  assert.doesNotMatch(wordHeading(word),/\((der|die|das)\)/u);
  assert.equal(vocabularyInputAnswer(word),entry.article+' '+entry.word.slice(entry.word.indexOf(')')+2));
  for(const example of word.examples)assert.doesNotMatch(example.de,/\((der|die|das|den|dem|des)\)/u);
 }
 assert.equal(byId.get('de-ref-0559304c77c8cdf8898e').word,'(das) Arabisch');
});
test('German expansion exceeds 10,000 distinct headwords without losing archived IDs or examples',()=>{
 assert.ok(new Set(core.entries.map(row=>row.word)).size>10000);
 for(const old of original.entries){const entry=byId.get(old.id);assert.ok(entry,old.id);assert.equal(entry.word,old.word);assert.deepEqual(entry.example,old.example);assert.deepEqual(entry.additionalExamples,old.additionalExamples);}
 assert.equal(new Set(core.entries.map(row=>row.id)).size,core.entries.length);
});
test('every explicit Goethe headword match uses its earliest list and unmatched entries use editorial upper bands',()=>{
 const lexemes=new Set(core.entries.map(row=>row.grammar.dictionaryLemma));
 for(const words of Object.values(evidence.headwords))for(const word of Object.keys(words))assert.ok(lexemes.has(word),word);
 for(const row of core.entries){
  const word=row.grammar.dictionaryLemma,matches=['A1','A2','B1'].filter(level=>evidence.headwords[level][word]);
  if(matches.length){assert.equal(row.level,matches[0],word);assert.equal(row.grammar.cefr_basis,'goethe-headword-match');}
  else {assert.ok(['B2','C1','C2'].includes(row.level),word);assert.equal(row.grammar.cefr_basis,'editorial-frequency-tier');}
 }
 assert.ok(evidence.headwords.A1.geöffnet);
 assert.ok(evidence.headwords.A1.geschlossen);
 assert.equal(evidence.headwords.B1.wusch,undefined);
 assert.match(core.contentReview.levelBasis,/not official CEFR/);
});
test('English and Korean meanings and example translations cover every study entry',()=>{
 for(const pair of [english,korean]){
  validateExplanation(core,pair);
  const words=germanWords(assembleStudy(core,pair));
  assert.equal(words.length,core.entries.length);
  assert.ok(words.every(row=>row.studyMeaning.trim()&&row.examples.every(example=>example.de.trim()&&example.studyTranslation.trim())));
 }
 const en=new Map(english.entries.map(row=>[row.id,row.meaning])),ko=new Map(korean.entries.map(row=>[row.id,row.meaning]));
 const sign=core.entries.find(row=>row.grammar.dictionaryLemma==='Schild');
 assert.match(en.get(sign.id),/sign/);assert.match(ko.get(sign.id),/표지판/);assert.doesNotMatch(ko.get(sign.id),/접시/);
});
test('new content retains attribution and draft status with explanations kept outside the core',()=>{
 assert.match(core.license.notice,/Robyn Speer/);assert.match(core.license.notice,/SUBTLEX/);assert.match(core.license.identifier,/CC-BY-SA-4.0/);
 for(const row of core.entries){
  for(const key of ['meaning_en','meaning_ko','source_meanings_ko','_ko','ko_bridge_definition_en'])assert.equal(row.grammar[key],undefined);
  assert.equal(row.example.en,undefined);assert.equal(row.example.ko,undefined);
  if(row.id.startsWith('de-ref-')){assert.ok(row.provenance.url);assert.ok(row.provenance.history_url);assert.ok(row.example.source);assert.match(row.example.source.review,/pending/);}
 }
 assert.equal(core.contentReview.nativeSpeakerReview,'pending');
});
test('noun display uses the nominative phrase while retaining the source dictionary lemma',()=>{
 assert.equal(displayHeadword({id:'de-ref-1',pos:'noun',lemma:'Angestellter',article:'der',declension:{nom:['der Angestellte','die Angestellten']}}),'Angestellte');
 assert.equal(displayHeadword({id:'de-ref-2',pos:'noun',lemma:'transitives Verb',article:'das'}),'transitive Verb');
 assert.equal(displayHeadword({id:'de-ref-3',pos:'noun',lemma:'Buch',article:'das'}),'Buch');
});
test('package conversion refuses a translation cache for a different sentence',()=>{
 const row={id:'de-test',lemma:'lernen',pos:'verb',cefr:'A1',meaning_en:['learn'],meaning_ko:['배우다'],examples:[{de:'Ich lerne Deutsch.'}],level_evidence:{matchedLists:[]}};
 assert.throws(()=>convertGermanRows([row],{'de-test:0':{text:'Wrong sentence.',en:'I learn German.',ko:'독일어를 배워요.'}}),/Missing reviewed translation draft/);
});
