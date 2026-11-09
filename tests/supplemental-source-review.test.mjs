import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSupplementalSources} from '../scripts/content/supplemental-source-review.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';

const review = {id:'source-question', reviewer:'sense-reviewer', verdict:'revise', needsSourceResolution:true,
 reviewedFields:{word:'bank',partOfSpeech:'noun',meaningEn:'A financial institution.',meaningKo:'은행',
  exampleText:'The bank approved the loan.',exampleTranslation:'은행이 대출을 승인했다.'},
 proposedLevel:'IELTS 1.0–3.5',levelRationale:'Everyday money sense.'};
const closure = {id:review.id,reviewDigest:exampleDigest(review),reviewer:'source-reviewer',
 verdict:'verify-as-reviewed',reason:'Independently verified the exact financial sense.',
 evidenceUrls:['https://example.com/dictionary/bank']};

test('a source doubt blocks completion even when the sense review otherwise passes',()=>{
 assert.equal(auditSupplementalSources([review],[]).report.complete,false);
 assert.equal(auditSupplementalSources([review],[closure]).report.complete,true);
});
test('a source access failure or an overturned exclusion still needs independent source closure',()=>{
 const pending={...review,needsSourceResolution:false,disposition:'source-verification-pending'};
 assert.equal(auditSupplementalSources([pending],[]).report.expected,1);
 const restored={...review,needsSourceResolution:false,sourceQA:{previousExclusionOverturned:true}};
 assert.equal(auditSupplementalSources([restored],[]).report.expected,1);
});
test('restoring a previously flagged record does not silently erase its source review requirement',()=>{
 const restored={...review,needsSourceResolution:false,disposition:'corrected'};
 const result=auditSupplementalSources([restored],[],new Set(),new Set([review.id]));
 assert.equal(result.report.expected,1);
 assert.equal(result.report.complete,false);
 const missing=auditSupplementalSources([],[],new Set(),new Set([review.id]));
 assert.equal(missing.report.complete,false);
 assert.equal(missing.report.errors.length,1);
});
test('changed content or the same reviewer cannot close a source flag',()=>{
 assert.equal(auditSupplementalSources([{...review,reason:'changed'}],[closure]).report.complete,false);
 assert.equal(auditSupplementalSources([review],[{...closure,reviewer:review.reviewer}]).report.complete,false);
});
test('an exclusion is applied to active data and a supported correction has its own effective content',()=>{
 const retired=auditSupplementalSources([review],[{...closure,verdict:'confirm-exclusion'}]);
 assert.equal(retired.finalized[0].effectiveReview.excludedFromStudy,true);
 assert.equal(retired.finalized[0].effectiveReview.disposition,'retire-unsupported');
 const restored={...closure,verdict:'correct-and-keep',reviewedFields:{...review.reviewedFields,meaningKo:'금융 기관'},
  proposedLevel:review.proposedLevel,levelRationale:review.levelRationale,practiceEligible:false};
 const result=auditSupplementalSources([{...review,excludedFromStudy:true}],[{...restored,
  reviewDigest:exampleDigest({...review,excludedFromStudy:true})}]);
 assert.equal(result.report.complete,true);
 assert.equal(result.finalized[0].effectiveReview.excludedFromStudy,false);
 assert.equal(result.finalized[0].effectiveReview.reviewedFields.meaningKo,'금융 기관');
 assert.equal(result.finalized[0].effectiveReview.practiceEligible,false);
});
test('retired source findings require closure but semantic duplicate merges do not create source findings',()=>{
 const retired={...review,needsSourceResolution:false,verdict:'retire',disposition:'retire-unsupported'};
 assert.equal(auditSupplementalSources([retired],[]).report.expected,1);
 assert.equal(auditSupplementalSources([{...retired,mergeWith:'canonical'}],[]).report.expected,0);
 assert.equal(auditSupplementalSources([retired],[],new Set([retired.id])).report.expected,0);
});
test('a new exclusion disposition cannot bypass the source review queue',()=>{
 const misbound={...review,needsSourceResolution:false,disposition:'retire-misbound-source',excludeFromActivePlan:true};
 assert.equal(auditSupplementalSources([misbound],[]).report.expected,1);
 const duplicate={...misbound,disposition:'merge-duplicate'};
 assert.equal(auditSupplementalSources([duplicate],[]).report.expected,0);
});
test('a relevance exclusion does not pretend that an attested minor meaning is unsupported',()=>{
 const minor={...review,needsSourceResolution:false,verdict:'exclude',disposition:'retire-low-study-relevance'};
 assert.equal(auditSupplementalSources([minor],[]).report.expected,0);
 assert.equal(auditSupplementalSources([{...minor,disposition:'exclude-minor-sense'}],[]).report.expected,0);
 const known=new Set([minor.id]);
 const scopeClosure={...closure,reviewDigest:exampleDigest(minor),verdict:'exclude-study-scope',
  reason:'Attested historical curiosity is outside the useful-through-GRE study scope.',evidenceUrls:[]};
 const result=auditSupplementalSources([minor],[scopeClosure],new Set(),known);
 assert.equal(result.report.complete,true);
 assert.equal(result.finalized[0].effectiveReview.disposition,'retire-low-study-relevance');
});
test('a source correction cannot release an incomplete translation or unsupported level',()=>{
 const corrected={...closure,verdict:'correct-and-keep',reviewedFields:{...review.reviewedFields,meaningKo:''},
  proposedLevel:review.proposedLevel,levelRationale:review.levelRationale};
 assert.equal(auditSupplementalSources([review],[corrected]).report.complete,false);
 corrected.reviewedFields=review.reviewedFields;
 corrected.proposedLevel='IELTS 8.5+';
 assert.equal(auditSupplementalSources([review],[corrected]).report.complete,false);
});

test('retiring a predictable inflection is a study-scope choice, while a recorded finding still needs closure',()=>{
 const form={id:'espoused-form',reviewer:'author',verdict:'revise',disposition:'retire-redundant-inflection',excludedFromStudy:true,
  reason:'Keep the base espouse meaning rather than another ordinary participle card.'};
 const fresh=auditSupplementalSources([form],[]);
 assert.equal(fresh.report.expected,0);assert.equal(fresh.report.complete,true);
 const recorded=auditSupplementalSources([form],[],new Set(),new Set([form.id]));
 assert.deepEqual(recorded.report.remaining,[form.id]);assert.equal(recorded.report.complete,false);
});

test('an accepted-source review with an explicit current study exclusion does not invent a source finding',()=>{
 const scope={id:'regional-dish',reviewer:'author',verdict:'revise',excludedFromStudy:true,
  studyRelevance:{policyId:'english-useful-through-gre-2026-11-08',verdict:'exclude',reason:'Narrow local dish name outside broad study scope.'}};
 assert.equal(auditSupplementalSources([scope],[]).report.expected,0);
 assert.deepEqual(auditSupplementalSources([scope],[],new Set(),new Set([scope.id])).report.remaining,[scope.id]);
 assert.equal(auditSupplementalSources([{...scope,sourceDoubt:{reason:'Actual unresolved source question.'}}],[]).report.expected,1);
 assert.equal(auditSupplementalSources([{...scope,studyRelevance:{...scope.studyRelevance,policyId:'unknown'}}],[]).report.expected,1);
 assert.equal(auditSupplementalSources([{...scope,disposition:'retire-unsupported'}],[]).report.expected,1);
});
