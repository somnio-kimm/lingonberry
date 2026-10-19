import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileMeaningCorrections,decisionDigest} from '../scripts/content/compile-meaning-corrections.mjs';
import {findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
const raw=path=>readFileSync(new URL('../'+path,import.meta.url)),json=path=>JSON.parse(raw(path)),rows=path=>raw(path).toString().trim().split('\n').map(JSON.parse);
const folder='language-packages/sources/meaning-corrections/ja-4.0.0/',old=json('language-packages/ja-core-3.0.0.json'),core=json('language-packages/ja-core-4.0.0.json');
const oldPairs=['en','ko'].map(locale=>json(`language-packages/ja-${locale}-3.0.0.json`)),pairs=['en','ko'].map(locale=>json(`language-packages/ja-${locale}-4.0.0.json`));
const decisions=['a','b','c','d'].flatMap(part=>rows(folder+part+'-decisions.jsonl')),sourceValidation=json(folder+'source-validation.json');
const active=new Map(core.entries.map(row=>[row.id,row])),retired=new Map(core.retiredEntries.map(row=>[row.id,row]));
const entryFor=index=>active.get(old.entries[index].id)||active.get(retired.get(old.entries[index].id)?.replacementId);
const meanings=index=>pairs.map(pair=>pair.entries.find(row=>row.id===entryFor(index).id).meaning);
test('all Japanese entries receive explicit review and complete English/Korean meanings without changing JLPT levels',()=>{
 assert.equal(decisions.length,12027);assert.equal(sourceValidation.checked,12027);assert.deepEqual(sourceValidation.failures,[]);assert.equal(sourceValidation.decisionDigest,decisionDigest(decisions));assert.ok(decisions.every(row=>row.decision!=='hold'));
 assert.equal(core.entries.length,12027);assert.deepEqual(core.exam,old.exam);assert.equal(core.entries.filter(row=>row.example).length,2027);
 for(const decision of decisions){const entry=entryFor(decision.index);assert.ok(entry);assert.equal(entry.level,old.entries[decision.index].level);assert.ok(entry.pronunciation);assert.ok(meanings(decision.index).every(value=>value.trim()));if(decision.decision==='replace'){assert.notEqual(entry.id,decision.id);assert.notEqual(retired.get(decision.id).sameConcept,true);}else assert.equal(entry.id,decision.id);}
});
test('Japanese corrections rebuild exactly and keep the original packages and unchanged examples intact',()=>{
 assert.deepEqual(compileMeaningCorrections({core:old,pairs:oldPairs,decisions,sourceValidation,version:'4.0.0'}).packages,[core,...pairs]);
 for(const source of json('language-packages/sources/meaning-reviews/ja-3.0.0/manifest.json').sourcePackages)assert.equal(createHash('sha256').update(raw(source.path)).digest('hex'),source.sha256);
 const edits=new Map(decisions.map(row=>[row.id,row]));
 for(const original of old.entries.filter(row=>row.example)){
  const edit=edits.get(original.id),entry=entryFor(edit.index);
  if(edit.example){assert.equal(entry.example.text,edit.example.text);for(let i=0;i<2;i++)assert.equal(pairs[i].entries.find(row=>row.id===entry.id).exampleTranslation,edit.example[['en','ko'][i]]);}
  else{assert.deepEqual(entry.example,original.example);for(let i=0;i<2;i++)assert.equal(pairs[i].entries.find(row=>row.id===entry.id).exampleTranslation,oldPairs[i].entries.find(row=>row.id===original.id).exampleTranslation);}
  if(findSentenceFocus({lemma:original.word},original.example,'ja'))assert.ok(findSentenceFocus({lemma:entry.word},entry.example,'ja'),'lost sentence focus: '+entry.word);
 }
});
test('Japanese regression meanings and readings correct cultural transfers and malformed definitions',()=>{
 assert.match(meanings(11638)[0],/older brother/i);assert.match(meanings(11638)[1],/형/u);assert.match(meanings(11638)[1],/오빠/u);assert.doesNotMatch(meanings(11638)[0],/only by a girl/i);
 assert.match(meanings(11643)[1],/누나/u);assert.match(meanings(11643)[1],/언니/u);assert.match(meanings(11660)[0],/else/i);
 assert.match(meanings(11814)[0],/ball/i);assert.doesNotMatch(meanings(11814)[0],/puck/i);
 assert.equal(entryFor(11916).pronunciation,'なかほど');assert.ok(!entryFor(11916).aliases.includes('ちゅうほど'));assert.equal(entryFor(11597).pronunciation,'こうのとり');assert.ok(!entryFor(11597).aliases.includes('こうとのり'));
 assert.equal(entryFor(11610).pronunciation,'はすは');assert.equal(entryFor(11475).pronunciation,'しばらく');
 assert.match(meanings(11421)[0],/schizophrenia/i);assert.doesNotMatch(meanings(11421)[0],/split personality/i);assert.match(meanings(11586)[0],/chilblains/i);
 assert.match(meanings(2645)[0],/Japanese/i);assert.match(meanings(2645)[0],/janggi/i);
});
