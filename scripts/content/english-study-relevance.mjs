import {exampleDigest} from './reviewed-examples.mjs';
import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';

import {ENGLISH_STUDY_POLICY_ID} from './english-study-policy.mjs';
export {ENGLISH_STUDY_POLICY_ID} from './english-study-policy.mjs';
const text = value => typeof value === 'string' && value.trim();

/** Source validity and difficulty do not establish usefulness for a study card. */
export function auditEnglishStudyRelevance(reviews, decisions = []) {
 const records = new Map(reviews.map(row => [row.id,row]));
 if (records.size !== reviews.length) throw new Error('Duplicate sense in relevance input');
 const byId = new Map(), errors = [], remaining = [], finalized = [];
 for (const decision of decisions) {
  if (!records.has(decision.id) || byId.has(decision.id)) {
   errors.push({id:decision.id,error:'Unknown or duplicate study-relevance decision'});
   continue;
  }
  byId.set(decision.id,decision);
 }
 let inactive = 0, included = 0, excludedForRelevance = 0;
 for (const row of reviews) {
  if (isEnglishReviewExcluded(row) || row.mergeWith) { inactive++; continue; }
  const explicit = byId.get(row.id);
  const decision = explicit || row.studyRelevance;
  const bound = !explicit || explicit.reviewDigest === exampleDigest(row) && text(explicit.reviewer);
  if (!decision) { remaining.push(row.id); continue; }
  if (!bound || decision.policyId !== ENGLISH_STUDY_POLICY_ID ||
      !['include','exclude'].includes(decision.verdict) || !text(decision.reason)) {
   errors.push({id:row.id,error:'Missing, stale or incomplete current-policy relevance judgement'});
   remaining.push(row.id);
   continue;
  }
  const effectiveReview = decision.verdict === 'exclude' ? {...row,
   verdict:'exclude',disposition:'retire-low-study-relevance',excludedFromStudy:true,
   studyRelevance:{policyId:decision.policyId,verdict:'exclude',reason:decision.reason},
  } : row;
  if (decision.verdict === 'include') included++; else excludedForRelevance++;
  finalized.push({id:row.id,reviewDigest:exampleDigest(row),verdict:decision.verdict,
   reason:decision.reason,effectiveReview});
 }
 return {finalized,report:{reviewed:reviews.length,inactive,required:reviews.length-inactive,
  included,excludedForRelevance,remaining,errors,complete:!remaining.length && !errors.length}};
}
