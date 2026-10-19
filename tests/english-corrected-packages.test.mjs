import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileEnglishCorrections,decisionDigest} from '../scripts/content/compile-english-corrections.mjs';
const raw=path=>readFileSync(new URL('../'+path,import.meta.url)),json=path=>JSON.parse(raw(path)),rows=path=>raw(path).toString().trim().split('\n').map(JSON.parse);
const folder='language-packages/sources/meaning-corrections/en-4.0.0/',old=json('language-packages/en-core-3.0.0.json'),core=json('language-packages/en-core-4.0.0.json');
const oldPairs=['en','ko'].map(locale=>json(`language-packages/en-${locale}-3.0.0.json`)),pairs=['en','ko'].map(locale=>json(`language-packages/en-${locale}-4.0.0.json`));
const decisions=['a','b','c'].flatMap(part=>rows(folder+part+'-decisions.jsonl')),sourceValidation=json(folder+'source-validation.json');
const active=new Map(core.entries.map(row=>[row.id,row])),retired=new Map(core.retiredEntries.map(row=>[row.id,row]));
test('English 4.0.0 resolves all findings and preserves every existing bilingual example',()=>{
 assert.equal(decisions.length,4347);assert.equal(sourceValidation.checked,4347);assert.deepEqual(sourceValidation.failures,[]);assert.equal(sourceValidation.decisionDigest,decisionDigest(decisions));assert.ok(decisions.every(row=>row.decision!=='hold'));
 assert.equal(core.entries.length,11977);assert.equal(core.retiredEntries.length,489);assert.equal(core.entries.filter(row=>row.example).length,139);
 for(const entry of old.entries.filter(row=>row.example)){
  assert.deepEqual(active.get(entry.id).example,entry.example);
  for(let i=0;i<2;i++)assert.equal(pairs[i].entries.find(row=>row.id===entry.id).exampleTranslation,oldPairs[i].entries.find(row=>row.id===entry.id).exampleTranslation);
 }
 for(const row of decisions){
  if(['correct','retain'].includes(row.decision))assert.ok(active.has(row.id));
  else{assert.ok(!active.has(row.id));assert.ok(retired.has(row.id));}
  if(row.decision==='replace'){const replacement=active.get(retired.get(row.id).replacementId);assert.ok(replacement);assert.notEqual(replacement.id,row.id);assert.equal(replacement.example,undefined);assert.equal(replacement.referenceExamples,undefined);assert.notEqual(retired.get(row.id).sameConcept,true);}
 }
 assert.ok(active.get('en-lex-016be22c6c1d49e60db4').aliases.includes('traveling'));
});
test('corrected dictionaries rebuild exactly from committed source-adjudication records',()=>{
 const rebuilt=compileEnglishCorrections({core:old,pairs:oldPairs,review:rows('language-packages/sources/meaning-reviews/en-3.0.0/entries.jsonl'),decisions,sourceValidation,version:'4.0.0'});
 assert.deepEqual(rebuilt.packages,[core,...pairs]);
 const archive=json('language-packages/sources/meaning-reviews/en-3.0.0/manifest.json');for(const source of archive.sourcePackages)assert.equal(createHash('sha256').update(raw(source.path)).digest('hex'),source.sha256);
});
test('regression cases use the corrected word senses in both explanation languages',()=>{
 const meanings=word=>{const entry=core.entries.find(row=>row.word===word&&row.partOfSpeech==='noun');assert.ok(entry,word);return pairs.map(pair=>pair.entries.find(row=>row.id===entry.id).meaning);};
 const spin=meanings('spin');assert.match(spin[0],/angular momentum/i);assert.match(spin[1],/각운동량/u);assert.doesNotMatch(spin[0],/hair/i);
 const smith=meanings('blacksmith');assert.match(smith[0],/person/i);assert.match(smith[1],/철|대장장이/u);
 const petal=meanings('petal');assert.match(petal[0],/flower/i);assert.match(petal[1],/꽃잎/u);
 const legislature=meanings('legislature');assert.match(legislature[0],/body/i);assert.match(legislature[1],/입법/u);
 assert.match(meanings('arc')[0],/curve|circle/i);assert.match(meanings('final')[0],/examination/i);
});
