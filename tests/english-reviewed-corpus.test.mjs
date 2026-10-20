import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareEnglishReview,summariseEnglishReview} from '../scripts/content/english-meaning-review.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const json=path=>JSON.parse(read(path));
const folder='language-packages/sources/meaning-reviews/en-3.0.0/';
test('full English review covers each unchanged published entry exactly once',()=>{
 const manifest=json(folder+'manifest.json');
 const records=read(folder+'entries.jsonl').toString().trim().split('\n').map(JSON.parse);
 const entries=prepareEnglishReview(json('language-packages/en-core-3.0.0.json'),json('language-packages/en-en-3.0.0.json'),json('language-packages/en-ko-3.0.0.json'));
 const summary=summariseEnglishReview(entries,records,{requireComplete:true});
 assert.equal(summary.reviewed,12016);assert.equal(summary.remaining,0);assert.deepEqual(summary.counts,manifest.counts);
 assert.equal(manifest.publicationReady,false);assert.equal(manifest.linguisticApproval,false);
 for(const item of manifest.sourcePackages)assert.equal(createHash('sha256').update(read(item.path)).digest('hex'),item.sha256);
 for(const row of records){
  const original=entries[row.index];assert.equal(row.word,original.word);assert.equal(row.pos,original.pos);
  assert.ok(['english_review_part1','english_review_part2','english_review_part3'].includes(row.reviewer));
  if(row.status!=='accepted'){assert.deepEqual(row.original,{en:original.en,ko:original.ko});assert.deepEqual(row.source,original.source);}
 }
});
test('independent source checks retain matching source digests and reuse attribution',()=>{
 const checks=read(folder+'independent-source-checks.jsonl').toString().trim().split('\n').map(JSON.parse);
 const records=new Map(read(folder+'entries.jsonl').toString().trim().split('\n').map(JSON.parse).map(row=>[row.id,row]));
 assert.equal(checks.length,14);
 for(const check of checks){assert.equal(check.digest,records.get(check.id).digest);assert.ok(check.finding);assert.ok(check.sources.length);for(const source of check.sources){assert.equal(source.license,'CC-BY-SA-4.0');assert.ok(source.url.startsWith('https://en.wiktionary.org/wiki/'));assert.ok(source.historyUrl.includes('action=history'));assert.match(source.snapshotSha256,/^[a-f0-9]{64}$/u);}}
});
