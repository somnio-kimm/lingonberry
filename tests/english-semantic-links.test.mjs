import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnglishSemanticLinks} from '../scripts/content/english-semantic-links.mjs';

const review = (id,extra={}) => ({id,verdict:'pass',...extra});
const audit = (reviews,ids=reviews.map(row=>row.id)) =>
 auditEnglishSemanticLinks({knownIds:new Set(ids),reviews});

test('an explicit duplicate proposal remains pending until its independently reviewed merge exists',()=>{
 const canonical=review('insulator',{duplicateSenseIds:['heat-insulator']});
 assert.equal(audit([canonical],['insulator','heat-insulator']).report.remaining[0].status,'awaiting-review');
 assert.equal(audit([canonical,review('heat-insulator')]).report.remaining[0].status,'needs-adjudication');
 assert.equal(audit([canonical,review('heat-insulator',{mergeWith:'insulator'})]).report.complete,true);
});

test('legacy structured fields and repeated proposals are consolidated into one pending equivalence',()=>{
 const canonical=review('kanji',{
  equivalentRelatedSenseIds:['individual-kanji'],
  additionalDuplicateSenseIds:['individual-kanji'],
  mergeProposals:[{retireDuplicate:'individual-kanji',mergeWith:'kanji'}],
 });
 const result=audit([canonical,review('individual-kanji')]);
 assert.equal(result.report.claims,1);
 assert.equal(result.report.remaining[0].duplicateId,'individual-kanji');
 assert.equal(result.report.complete,false);
});

test('source-attested but study-excluded duplicates need no fabricated progress alias',()=>{
 const excluded=id=>review(id,{verdict:'retire',disposition:'retire-low-study-relevance'});
 const result=audit([
  {...excluded('hazard-creep'),duplicateSenseIds:['narrow-hazard-creep']},excluded('narrow-hazard-creep'),
 ]);
 assert.equal(result.links[0].status,'duplicate-excluded');
 assert.equal(result.report.complete,true);
});

test('transitive merges must terminate in an active sense rather than a cycle or retired target',()=>{
 const canonical=review('broad',{duplicateSenseIds:['specific']});
 assert.equal(audit([canonical,review('specific',{mergeWith:'intermediate'}),
  review('intermediate',{mergeWith:'broad'})]).report.complete,true);
 assert.equal(audit([{...canonical,mergeWith:'specific'},review('specific',{mergeWith:'broad'})])
  .links[0].status,'merge-cycle');
 assert.equal(audit([{...canonical,verdict:'retire'},review('specific',{mergeWith:'broad'})])
  .links[0].status,'canonical-not-active');
});

test('self claims, unknown IDs and malformed duplicate lists block completion',()=>{
 for(const extra of [{duplicateSenseIds:['same']},{duplicateSenseIds:['missing']},
  {duplicateSenseIds:'wrong-shape'}]) assert.equal(audit([review('same',extra)]).report.complete,false);
});

test('identical active reviewed meanings are flagged even when neither author proposed a merge',()=>{
 const fields={word:'quote',partOfSpeech:'noun',meaningEn:'A price estimate.'};
 const original=review('original',{reviewedFields:fields});
 const extra=review('extra',{reviewedFields:{...fields,meaningEn:'A price estimate'}});
 const pending=audit([original,extra]);
 assert.equal(pending.links[0].field,'identical-reviewed-meaning');
 assert.equal(pending.report.complete,false);
 assert.equal(audit([original,{...extra,mergeWith:'original'}]).report.complete,true);
 assert.equal(audit([original,{...extra,verdict:'exclude'}]).report.complete,true);
 assert.equal(audit([original,{...extra,reviewedFields:{...fields,meaningEn:'Words repeated from another person.'}}])
  .report.complete,true);
});

test('a primary gerund can merge into a new noun sense only after the new target is active',()=>{
 const gerund=review('stopping',{mergeWith:'stop-halt'});
 const ids=['stopping','stop-halt'];
 assert.equal(audit([gerund],ids).report.remaining[0].status,'awaiting-review');
 const added={id:'stop-halt',verdict:'add',reviewedFields:{word:'stop',partOfSpeech:'noun',meaningEn:'An end or temporary pause in movement or activity.'}};
 assert.equal(audit([gerund,added],ids).report.complete,true);
 assert.equal(audit([gerund,{...added,verdict:'exclude'}],ids).report.remaining[0].status,'canonical-not-active');
});
