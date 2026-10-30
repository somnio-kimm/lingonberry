import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compileReviewedExamples,exampleDigest} from '../scripts/content/reviewed-examples.mjs';
import {validatePackage,validateExplanation} from '../web/js/packages/schema.js';
import {createReviewContentPolicy} from '../web/js/shared/review-content.js';
const version='4.4.0',base=`language-packages/sources/examples/editions/${version}`;
const bytes=path=>readFile(new URL('../'+path,import.meta.url));
const json=async path=>JSON.parse(await bytes(path));
const rows=async path=>(await bytes(path)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const digest=value=>createHash('sha256').update(value).digest('hex');

test('Japanese completion retains the original corpus and binds every new bilingual example to independent review',async()=>{
 const proof=await json(base+'/ja-completion-report.json');
 assert.equal(proof.target,10000);assert.equal(proof.drafted,10000);assert.equal(proof.independentlyReviewed,10000);assert.equal(proof.fullCoverage,true);
 assert.deepEqual(proof.missingIds,[]);assert.deepEqual(proof.unreviewedIds,[]);assert.deepEqual(proof.findings,[]);
 for(const file of proof.files){const data=await bytes(file.path);assert.equal(data.length,file.bytes);assert.equal(digest(data),file.sha256);}
 const original=[];
 for(const descriptor of proof.sourcePackages){const data=await bytes(descriptor.url.replace(/^\//,''));assert.equal(data.length,descriptor.bytes);assert.equal(digest(data),descriptor.sha256);assert.equal(descriptor.sha256,proof.sourceSha256[descriptor.id]);original.push(JSON.parse(data));}
 const sourceCore=original.find(row=>row.id==='ja-core'),sourcePairs=['ja-en','ja-ko'].map(id=>original.find(row=>row.id===id));
 const authored=await rows(base+'/ja-completion-authored.jsonl'),reviews=await rows(base+'/ja-completion-reviews.jsonl'),inputs=await rows(base+'/ja-completion-bindings.jsonl'),ownership=await json(base+'/ja-completion-ownership.json');
 const expected=compileReviewedExamples({core:sourceCore,pairs:sourcePairs,authored,reviews,inputs,ownership,version}).packages;
 const actual=await Promise.all(['ja-core','ja-en','ja-ko'].map(id=>json(`language-packages/${id}-${version}.json`)));
 validatePackage(actual[0]);for(const pair of actual.slice(1))validateExplanation(actual[0],pair);
 assert.equal(actual[0].entries.length,12027);assert.deepEqual(actual[0].entries.map(row=>row.id),sourceCore.entries.map(row=>row.id));
 assert.ok(actual[0].entries.every(row=>row.example?.text?.trim()));
 for(let i=0;i<actual.length;i++)assert.deepEqual(actual[i].entries,expected[i].entries);
 const byId=new Map(actual[0].entries.map(row=>[row.id,row]));
 for(const old of sourceCore.entries)if(old.example)assert.deepEqual(byId.get(old.id),old);
 for(let i=0;i<sourcePairs.length;i++){
  const translations=new Map(actual[i+1].entries.map(row=>[row.id,row]));
  for(const old of sourcePairs[i].entries){assert.equal(translations.get(old.id).meaning,old.meaning);assert.ok(translations.get(old.id).exampleTranslation?.trim());}
 }
 const policy=createReviewContentPolicy({studyVersion:version,reviewInvalidations:actual[0].reviewInvalidations});
 for(const record of authored){
  const entry=byId.get(record.id),review=entry.example.provenance.editorialReview;
  assert.equal(review.status,'checked');assert.equal(review.nativeSpeakerReview,'pending');assert.equal(review.recordSha256,exampleDigest(record));
  assert.ok(review.reviewers.length&&review.reviewers.every(name=>name!==ownership[record.id]));
  assert.equal(entry.example.provenance.creator,record.provenance.creator);assert.equal(entry.example.provenance.license,record.provenance.license);
  if(record.headwordCorrection){assert.equal(entry.word,record.headwordCorrection.word);assert.equal(entry.pronunciation,record.headwordCorrection.pronunciation);assert.equal(policy.isCurrent({word:{id:entry.id},contentVersion:sourceCore.version}),false);assert.equal(policy.isCurrent(policy.prepare({word:{id:entry.id}})),true);}
 }
 assert.equal(actual[0].contentReview.nativeSpeakerReview,'pending');assert.match(actual[0].license.notice,/Lingonberry contributors/);
});
