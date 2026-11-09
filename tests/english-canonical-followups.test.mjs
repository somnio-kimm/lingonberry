import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnglishCanonicalFollowups,englishCanonicalContentDigest} from '../scripts/content/english-canonical-followups.mjs';

const target={id:'tenant',verdict:'pass',reviewedFields:{word:'tenant',partOfSpeech:'noun',
 meaningEn:'A person who rents a building.',meaningKo:'세입자',
 exampleText:'The tenant paid the rent.',exampleTranslation:'세입자가 임대료를 냈다.'},proposedLevel:'IELTS 4.0–6.5'};
const source={id:'business-tenant',verdict:'revise',mergeWith:'tenant',relatedSenseIssues:[{
 id:'tenant',issue:'Include organisations and rented land, not only people and buildings.',
}]};
const audit=(reviews,decisions=[],knownIds=new Set(['tenant','business-tenant']))=>
 auditEnglishCanonicalFollowups({reviews,decisions,knownIds});
const approval=(issue,row)=>({issueId:issue.id,targetId:row.id,targetDigest:englishCanonicalContentDigest(row),
 reviewer:'content-reviewer',verdict:'resolved',reason:'Read current broad tenant meaning and both rental contexts.'});

test('an active merge target does not silently satisfy a requested definition correction',()=>{
 const pending=audit([target,source]);
 assert.equal(pending.report.remaining.length,1);
 assert.equal(pending.issues[0].status,'needs-content-review');
 const corrected={...target,reviewedFields:{...target.reviewedFields,
  meaningEn:'A person or organisation renting land or premises.'}};
 assert.equal(audit([corrected,source],[approval(pending.issues[0],corrected)]).report.complete,true);
});

test('changed learner-facing meaning reopens a repair, while unrelated history does not',()=>{
 const issue=audit([target,source]).issues[0],decision=approval(issue,target);
 assert.equal(audit([{...target,reviewTimestamp:'later'},source],[decision]).report.complete,true);
 assert.equal(audit([{...target,reviewedFields:{...target.reviewedFields,meaningEn:'An owner.'}},source],[decision])
  .issues[0].status,'stale-or-invalid-decision');
});

test('repairs follow aliases to the final active meaning and wait for unreviewed targets',()=>{
 const alias={id:'old-tenant',verdict:'revise',mergeWith:'tenant'};
 const proposer={...source,relatedSenseIssues:[{id:'old-tenant',issue:'Include business renters.'}]};
 const known=new Set(['tenant','old-tenant','business-tenant']);
 const issue=audit([target,alias,proposer],[],known).issues[0];
 assert.equal(issue.resolvedTargetId,'tenant');
 assert.equal(audit([target,alias,proposer],[approval(issue,target)],known).report.complete,true);
 assert.equal(audit([proposer],[],known).issues[0].status,'awaiting-target-review');
});

test('excluded targets need no learner-facing repair and withdrawn notes retain archived decisions',()=>{
 const issue=audit([target,source]).issues[0];
 assert.equal(audit([{...target,verdict:'exclude'},source]).report.complete,true);
 const withdrawn={...source,relatedSenseIssues:[]};
 const result=audit([target,withdrawn],[approval(issue,target)]);
 assert.equal(result.report.archivedDecisions,1);
 assert.equal(result.report.complete,true);
});

test('legacy canonical recommendations are checked and unknown or malformed targets block completion',()=>{
 const legacy={...source,relatedSenseIssues:undefined,canonicalRecommendation:{meaningEn:'A broader meaning.'}};
 assert.equal(audit([target,legacy]).report.remaining.length,1);
 assert.equal(audit([target,{...source,relatedSenseIssues:[{issue:'No target.'}]}]).report.complete,false);
 assert.equal(audit([target,{...source,relatedSenseIssues:[{id:'missing',issue:'Unknown target.'}]}])
  .issues[0].status,'unknown-target');
});
