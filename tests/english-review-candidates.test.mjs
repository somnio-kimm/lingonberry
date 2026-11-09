import test from 'node:test';
import assert from 'node:assert/strict';
import {collectEnglishReviewCandidates, englishSenseId, auditEnglishReviewCandidateDecisions, englishExistingReviewDigest, applyEnglishCandidateDecisions} from '../scripts/content/english-review-candidates.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';

const river = {word:'bank',partOfSpeech:'noun',meaningEn:'The land beside a river.',meaningKo:'강둑',
 exampleText:'We sat on the bank beside the river.',exampleTranslation:'우리는 강가의 둑에 앉았다.',
 proposedLevel:'IELTS 4.0–6.5',levelRationale:'Everyday landscape sense.'};
const money = {...river,id:'bank-finance',meaningEn:'A financial institution.'};
const collect = (reviews,sourceFinalized=[]) => collectEnglishReviewCandidates({inputs:[money],reviews,sourceFinalized});

test('a new meaning gets a separate ID that does not change when its level changes',()=>{
 const result=collect([{id:money.id,additionalSenseCandidates:[river]}]);
 assert.equal(result.candidates.length,1);
 assert.notEqual(result.candidates[0].id,money.id);
 assert.equal(englishSenseId(river),englishSenseId({...river,proposedLevel:'IELTS 7.0–8.0'}));
 assert.deepEqual(result.candidates[0].existingMatches,[]);
});
test('source alternatives and sense proposals are collected with every attribution binding intact',()=>{
 const source={id:money.id,resolution:{supportedAlternatives:[river]},crossReview:{reviewer:'source-reviewer'}};
 const result=collect([{id:money.id,separateAlternative:{...river,meaning:river.meaningKo,englishMeaning:river.meaningEn}}],[source]);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].origins.length,2);
 assert.ok(result.candidates[0].origins.every(row=>row.originDigest&&row.candidateDigest));
 assert.equal(result.candidates[0].reviewStatus,'pending-semantic-review');
});
test('an existing meaning is linked to its original ID rather than silently duplicated or merged',()=>{
 const result=collect([{id:money.id,additionalSenseCandidates:[money]}]);
 assert.deepEqual(result.candidates[0].existingMatches,[money.id]);
 assert.equal(result.candidates[0].reviewStatus,'pending-semantic-review');
});
test('missing examples and conflicting proposed levels remain visible to the reviewer',()=>{
 const result=collect([{id:money.id,additionalSenseCandidates:[river,{...river,proposedLevel:'IELTS 7.0–8.0'},
  {...river,exampleTranslation:''}]}]);
 assert.equal(result.errors.length,1);
 assert.deepEqual(result.candidates[0].levelConflicts,['IELTS 7.0–8.0']);
});
test('recognition-only source examples stay out of scored sentence practice',()=>{
 const result=collect([{id:money.id,additionalSenseCandidates:[{...river,practiceEligible:false}]}]);
 assert.equal(result.candidates[0].practiceEligible,false);
});
test('new meanings cannot count as reviewed until an independent decision binds their actual content',()=>{
 const candidate=collect([{id:money.id,reviewer:'author',additionalSenseCandidates:[river]}]).candidates[0];
 const decision={id:candidate.id,candidateDigest:exampleDigest(candidate),reviewer:'reviewer',verdict:'add',
  reviewedFields:river,proposedLevel:river.proposedLevel,levelRationale:river.levelRationale,reason:'The landscape sense and sentence are distinct from banking.'};
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[]).report.complete,false);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision]).report.complete,true);
 assert.equal(auditEnglishReviewCandidateDecisions([{...candidate,meaningKo:'변경됨'}],[decision]).report.complete,false);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[{...decision,reviewer:'author'}]).report.complete,false);
});
test('equivalent proposals link to a known record and cannot create a second card with its ID',()=>{
 const candidate=collect([{id:money.id,additionalSenseCandidates:[money]}]).candidates[0];
 const decision={id:candidate.id,candidateDigest:exampleDigest(candidate),reviewer:'reviewer',verdict:'reuse',
  canonicalId:money.id,reason:'This is the existing financial-institution meaning.'};
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision],new Set([money.id])).report.complete,true);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[{...decision,canonicalId:'missing'}],new Set([money.id])).report.complete,false);
 const added={...decision,verdict:'add',reviewedFields:money,proposedLevel:money.proposedLevel,levelRationale:money.levelRationale};
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[added],new Set([candidate.id])).report.complete,false);
});
test('two proposals can share an independently approved new card without order dependence or alias cycles',()=>{
 const first=collect([{id:money.id,reviewer:'author',additionalSenseCandidates:[river]}]).candidates[0];
 const second={...first,id:'another-proposal',meaningEn:'The ground at the side of a river.'};
 const added={id:first.id,candidateDigest:exampleDigest(first),reviewer:'reviewer',verdict:'add',
  reviewedFields:river,proposedLevel:river.proposedLevel,levelRationale:river.levelRationale,reason:'River-edge sense is distinct.'};
 const reused={id:second.id,candidateDigest:exampleDigest(second),reviewer:'reviewer',verdict:'reuse',
  canonicalId:first.id,reason:'Same river-edge sense as the approved new card.'};
 assert.equal(auditEnglishReviewCandidateDecisions([first,second],[reused,added]).report.complete,true);
 assert.equal(auditEnglishReviewCandidateDecisions([first,second],[reused,{...added,verdict:'reuse',canonicalId:second.id}]).report.complete,false);
 assert.equal(auditEnglishReviewCandidateDecisions([first,second],[reused,{...added,proposedLevel:'unsupported'}]).report.complete,false);
});
test('a newly noticed common meaning is queued without overwriting the original meaning or approving itself',()=>{
 const result=collectEnglishReviewCandidates({inputs:[money],reviews:[],sourceFinalized:[],
  extraProposals:[{parentId:money.id,reviewer:'author',candidate:river}]});
 assert.equal(result.candidates.length,1);
 assert.deepEqual(result.candidates[0].existingMatches,[]);
 assert.equal(money.meaningEn,'A financial institution.');
 const candidate=result.candidates[0];
 const decision={id:candidate.id,candidateDigest:exampleDigest(candidate),reviewer:'author',verdict:'add',
  reviewedFields:river,proposedLevel:river.proposedLevel,levelRationale:river.levelRationale,reason:'Own authored meaning.'};
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision]).report.complete,false);
});

test('a source proposal promoted into a primary ID is reused without a self-alias or primary overwrite',()=>{
 const id=englishSenseId(river),candidate={...river,id,origins:[{reviewer:'source-author'}]};
 const primary={id,verdict:'revise',reviewer:'primary-reviewer',reviewedFields:river,proposedLevel:river.proposedLevel};
 const decision={id,candidateDigest:exampleDigest(candidate),reviewer:'independent-reviewer',verdict:'reuse',canonicalId:id,
  canonicalDigest:englishExistingReviewDigest(primary),reason:'Personally compared the current primary and source proposal; same riverbank meaning.'};
 const result=auditEnglishReviewCandidateDecisions([candidate],[decision],new Set([id]),[primary]);
 assert.equal(result.report.complete,true);
 const effective=applyEnglishCandidateDecisions(new Map([[id,primary]]),result.finalized);
 assert.equal(effective.size,1);assert.deepEqual(effective.get(id).reviewedFields,river);
 assert.equal(effective.get(id).mergeWith,undefined);
 const changed={...primary,reviewedFields:{...river,meaningEn:'A different meaning.'}};
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision],new Set([id]),[changed]).report.complete,false);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision],new Set([id]),[{...primary,verdict:'exclude'}]).report.complete,false);
});

test('declining a colliding proposal does not retire an independently accepted primary',()=>{
 const id=englishSenseId(river),candidate={...river,id,origins:[]};
 const primary={id,verdict:'revise',reviewedFields:river};
 const decision={id,candidateDigest:exampleDigest(candidate),reviewer:'independent-reviewer',verdict:'exclude',reason:'No additional card; preserve the accepted primary.'};
 const result=auditEnglishReviewCandidateDecisions([candidate],[decision],new Set([id]));
 assert.equal(result.report.complete,true);
 assert.equal(applyEnglishCandidateDecisions(new Map([[id,primary]]),result.finalized).get(id).verdict,'revise');
 assert.equal(applyEnglishCandidateDecisions(new Map(),result.finalized,new Set([id])).has(id),false);
});

test('a promoted source ID already merged by primary review keeps its bound existing alias',()=>{
 const id=englishSenseId(river),candidate={...river,id,origins:[]};
 const primary={id,verdict:'revise',mergeWith:'existing-bank',reviewedFields:river};
 const canonical={id:'existing-bank',verdict:'revise',reviewedFields:river,proposedLevel:river.proposedLevel};
 const decision={id,candidateDigest:exampleDigest(candidate),reviewer:'independent-reviewer',verdict:'reuse',canonicalId:canonical.id,
  existingReviewDigest:englishExistingReviewDigest(primary),canonicalDigest:englishExistingReviewDigest(canonical),reason:'Read both primary alias and active canonical; same landscape sense.'};
 const ids=new Set([id,canonical.id]);
 const result=auditEnglishReviewCandidateDecisions([candidate],[decision],ids,[primary,canonical]);
 assert.equal(result.report.complete,true);
 assert.equal(applyEnglishCandidateDecisions(new Map([[id,primary],[canonical.id,canonical]]),result.finalized).get(id).mergeWith,canonical.id);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[{...decision,existingReviewDigest:undefined}],ids,[primary,canonical]).report.complete,false);
 assert.equal(auditEnglishReviewCandidateDecisions([candidate],[decision],ids,[{...primary,mergeWith:'somewhere-else'},canonical]).report.complete,false);
});
