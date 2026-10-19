import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareEnglishReview,summariseEnglishReview} from '../scripts/content/english-meaning-review.mjs';
const core={entries:[{id:'spin',word:'spin',partOfSpeech:'noun',provenance:{kind:'licensed-adaptation'}},{id:'go',word:'go',partOfSpeech:'verb',provenance:{kind:'app-authored'}}]};
const en={entries:[{id:'spin',meaning:'Hair spray.'},{id:'go',meaning:'To move to another place.'}]},ko={entries:[{id:'spin',meaning:'입자의 각운동량.'},{id:'go',meaning:'다른 곳으로 이동하다.'}]};
const entries=prepareEnglishReview(core,en,ko);
const accepted=index=>({index,id:entries[index].id,digest:entries[index].digest,status:'accepted',issues:[],proposed:{}});
const correction={...accepted(0),status:'correction-proposed',issues:['sense-mismatch'],reason:'The English definition describes hair spray, while the Korean definition describes particle spin.',proposed:{en:'An intrinsic form of angular momentum possessed by particles.'}};
test('review totals count actual entry records without approving proposals',()=>{
 const partial=summariseEnglishReview(entries,[correction]);assert.equal(partial.reviewed,1);assert.equal(partial.remaining,1);assert.equal(partial.complete,false);assert.equal(partial.counts['correction-proposed'],1);
 assert.throws(()=>summariseEnglishReview(entries,[correction],{requireComplete:true}),/Incomplete/);
 const full=summariseEnglishReview(entries,[correction,accepted(1)],{requireComplete:true});assert.equal(full.complete,true);assert.equal(full.publicationReady,false);assert.equal(full.linguisticApproval,false);
});
test('reviews reject changed content, repeated IDs and unsupported approvals',()=>{
 assert.throws(()=>summariseEnglishReview(entries,[accepted(1),accepted(1)]),/Duplicate/);
 assert.throws(()=>summariseEnglishReview(entries,[{...accepted(1),digest:'old'}]),/Stale/);
 assert.throws(()=>summariseEnglishReview(entries,[{...accepted(1),proposed:{en:'Changed.'}}]),/Accepted entry/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,reason:''}]),/rationale/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,proposed:{}}]),/proposed change/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,proposed:{en:42}}]),/proposed field/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,index:'0'}]),/review index/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,proposed:{action:'publish'}}]),/proposed action/);
 assert.throws(()=>summariseEnglishReview(entries,[{...correction,proposed:{action:'reconcile-duplicate',relatedIndex:99}}]),/related entry/);
 assert.equal(summariseEnglishReview(entries,[{...correction,status:'unresolved',proposed:{action:'reconcile-duplicate',relatedIndex:1}}]).counts.unresolved,1);
 const changed=prepareEnglishReview(core,{entries:[en.entries[0],{...en.entries[1],meaning:'To depart.'}]},ko);assert.notEqual(changed[1].digest,entries[1].digest);
});
test('published corpus review binds all 12016 bilingual meanings to their stable IDs',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../language-packages/'+name,import.meta.url)));
 const rows=prepareEnglishReview(read('en-core-3.0.0.json'),read('en-en-3.0.0.json'),read('en-ko-3.0.0.json'));
 assert.equal(rows.length,12016);assert.equal(new Set(rows.map(row=>row.id)).size,12016);assert.ok(rows.every(row=>/^[a-f0-9]{64}$/u.test(row.digest)));
 assert.equal(rows[3005].word,'spin');assert.equal(rows[3005].digest,'54def22dd8399150fcc2b5cfb35271c6e7bd29bacc7c5da179cfaf112aa19af2');
});
