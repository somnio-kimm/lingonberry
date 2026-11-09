import {exampleDigest} from './reviewed-examples.mjs';
import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';
import {resolveEnglishCanonicalId} from './english-semantic-links.mjs';

const text = value => typeof value === 'string' && value.trim();
const fields = ['relatedSenseIssues','relatedSenseRepair','relatedSenseClarification',
 'relatedSenseCorrections','relatedSenseRecommendations','canonicalRecommendation','canonicalRecommendations'];

/** Bind an editorial repair to learner-facing semantics rather than unrelated journal metadata. */
export function englishCanonicalContentDigest(row) {
 return exampleDigest({id:row.id,reviewedFields:row.reviewedFields ?? null,
  proposedLevel:row.proposedLevel ?? null,excluded:isEnglishReviewExcluded(row),
  mergeWith:row.mergeWith || null,aliases:[...new Set(row.aliases || [])].sort(),
  focus:row.focus ?? null,practiceEligible:row.practiceEligible !== false});
}

/** A valid alias target must also satisfy outstanding content corrections, not just exist. */
export function auditEnglishCanonicalFollowups({reviews, knownIds, decisions=[]}) {
 const byId = new Map(reviews.map(row=>[row.id,row]));
 const issues = new Map(), errors = [], seen = new Set();
 for (const row of reviews) for (const field of fields) {
  if (row[field] === undefined || row[field] === null) continue;
  const notes = Array.isArray(row[field]) ? row[field] : [row[field]];
  for (const raw of notes) {
   const note = typeof raw === 'string' ? {issue:raw} : raw;
   const targetId = note?.id || note?.targetId || (field.startsWith('canonical') ? row.mergeWith || row.id : null);
   if (!note || typeof note !== 'object' || !Object.keys(note).length || !text(targetId)) {
    errors.push({id:row.id,field,error:'Canonical repair note needs a target ID and content'});
    continue;
   }
   const body={proposerId:row.id,field,targetId,note};
   const id='en-repair-'+exampleDigest(body).slice(0,24);
   issues.set(id,{id,...body});
  }
 }
 const approvals = new Map();let archivedDecisions = 0;
 for (const decision of decisions) {
  if (!text(decision.issueId) || seen.has(decision.issueId)) {
   errors.push({id:decision.issueId,error:'Missing or duplicate canonical repair decision'});
   continue;
  }
  seen.add(decision.issueId);
  if (!issues.has(decision.issueId)) { archivedDecisions++; continue; }
  approvals.set(decision.issueId,decision);
 }
 const finalized = [], remaining = [];
 for (const issue of issues.values()) {
  let status, targetId=resolveEnglishCanonicalId(issue.targetId,byId), target=byId.get(targetId);
  if (!knownIds.has(issue.targetId)) status='unknown-target';
  else if (!targetId) status='merge-cycle';
  else if (!target) status='awaiting-target-review';
  else if (isEnglishReviewExcluded(target)) status='target-inactive';
  else {
   const decision=approvals.get(issue.id);
   if (!decision) status='needs-content-review';
   else if (!['resolved','not-needed'].includes(decision.verdict) || !text(decision.reviewer) ||
       !text(decision.reason) || decision.targetId !== targetId ||
       decision.targetDigest !== englishCanonicalContentDigest(target)) {
    status='stale-or-invalid-decision';
    errors.push({id:issue.id,error:'Canonical repair judgement is stale or incomplete'});
   } else status=decision.verdict;
  }
  const record={...issue,status,resolvedTargetId:targetId,
   ...(target?{targetDigest:englishCanonicalContentDigest(target),target:{id:target.id,
    reviewedFields:target.reviewedFields ?? null,proposedLevel:target.proposedLevel ?? null,
    aliases:target.aliases || [],focus:target.focus ?? null}}:{}),
  };
  finalized.push(record);
  if (!['resolved','not-needed','target-inactive'].includes(status)) remaining.push(issue.id);
 }
 return {issues:finalized,report:{expected:issues.size,
  resolved:finalized.filter(row=>['resolved','not-needed'].includes(row.status)).length,
  inactiveTargets:finalized.filter(row=>row.status==='target-inactive').length,
  archivedDecisions,remaining,errors,complete:!remaining.length&&!errors.length}};
}
