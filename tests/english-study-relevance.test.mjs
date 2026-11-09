import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnglishStudyRelevance,ENGLISH_STUDY_POLICY_ID} from '../scripts/content/english-study-relevance.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';

const useful={id:'sanction-authorise',verdict:'pass',reviewedFields:{word:'sanction',meaningEn:'To officially authorise something.'}};
const minor={id:'sedan-fish-barrow',verdict:'pass',sourceVerified:true,
 reviewedFields:{word:'sedan',meaningEn:'A historical fish-carrying handbarrow.'}};
const decision=(row,verdict,reason)=>({id:row.id,reviewDigest:exampleDigest(row),reviewer:'scope-reviewer',
 policyId:ENGLISH_STUDY_POLICY_ID,verdict,reason});

test('an attested minor meaning cannot pass the usefulness gate solely because its source is verified',()=>{
 assert.equal(auditEnglishStudyRelevance([minor]).report.complete,false);
 const result=auditEnglishStudyRelevance([minor],[decision(minor,'exclude','Marginal historical equipment meaning outside useful-through-GRE scope.')]);
 assert.equal(result.report.complete,true);
 assert.equal(result.finalized[0].effectiveReview.disposition,'retire-low-study-relevance');
 assert.equal(result.finalized[0].effectiveReview.sourceVerified,true);
});
test('a useful advanced sense may be included despite being uncommon in conversation',()=>{
 const result=auditEnglishStudyRelevance([useful],[decision(useful,'include','Standard advanced academic authorisation meaning of sanction.')]);
 assert.equal(result.report.included,1);
 assert.equal(result.report.complete,true);
});
test('changed meaning or an older policy invalidates a saved relevance approval',()=>{
 const approval=decision(useful,'include','Useful advanced meaning.');
 assert.equal(auditEnglishStudyRelevance([{...useful,reviewedFields:{...useful.reviewedFields,meaningEn:'A different meaning.'}}],[approval]).report.complete,false);
 assert.equal(auditEnglishStudyRelevance([useful],[{...approval,policyId:'old-exhaustive-policy'}]).report.complete,false);
});
test('an individual new-policy judgement is accepted but existing excluded or merged entries are not reactivated',()=>{
 const current={...useful,studyRelevance:{policyId:ENGLISH_STUDY_POLICY_ID,verdict:'include',reason:'Useful current academic sense.'}};
 assert.equal(auditEnglishStudyRelevance([current]).report.complete,true);
 const excluded={...current,verdict:'exclude',disposition:'retire-low-study-relevance',excludedFromStudy:true};
 const result=auditEnglishStudyRelevance([excluded,{...current,id:'alias',mergeWith:current.id}]);
 assert.equal(result.report.inactive,2);
 assert.equal(result.report.included,0);
});
