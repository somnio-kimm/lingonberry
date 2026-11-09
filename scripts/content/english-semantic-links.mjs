import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';
import {englishSenseKey} from './english-review-candidates.mjs';

import {resolveEnglishCanonicalId} from './english-review-identity.mjs';
export {resolveEnglishCanonicalId} from './english-review-identity.mjs';

/** Track explicit equivalence proposals without silently approving a semantic merge. */
export function auditEnglishSemanticLinks({knownIds, reviews}) {
 const byId = new Map(reviews.map(row => [row.id,row]));
 const claims = [], errors = [], links = [], seen = new Set();
 const add = (row,field,duplicateId,canonicalId = row.canonicalSenseId || row.id) => {
  if (typeof duplicateId !== 'string' || typeof canonicalId !== 'string') {
   errors.push({id:row.id,field,error:'Malformed semantic equivalence proposal'});
   return;
  }
  claims.push({proposerId:row.id,field,duplicateId,canonicalId});
 };
 for (const row of reviews) {
  if (row.mergeWith) add(row,'mergeWith',row.id,row.mergeWith);
  for (const field of ['duplicateSenseIds','canonicalDuplicateIds','duplicateCandidateIds',
   'additionalDuplicateSenseIds','equivalentRelatedSenseIds']) {
   if (row[field] === undefined) continue;
   if (!Array.isArray(row[field])) {
    errors.push({id:row.id,field,error:'Semantic duplicate IDs must be an array'});
    continue;
   }
   for (const id of row[field]) add(row,field,id);
  }
  if (row.duplicateCandidate !== undefined) add(row,'duplicateCandidate',row.duplicateCandidate);
  const proposals = row.mergeProposals || [];
  if (!Array.isArray(proposals)) errors.push({id:row.id,error:'Merge proposals must be an array'});
  for (const proposal of [row.mergeProposal,...(Array.isArray(proposals) ? proposals : [])].filter(Boolean)) {
   add(row,'mergeProposal',proposal.retireDuplicate,proposal.mergeWith);
  }
  if (row.mergeRecommendation) {
   add(row,'mergeRecommendation',row.mergeRecommendation.mergeFrom,row.mergeRecommendation.keepId);
  }
 }
 const exactMeanings = new Map();
 for (const row of reviews) {
  const fields = row.reviewedFields;
  if (row.mergeWith || isEnglishReviewExcluded(row) ||
      !fields?.word || !fields.partOfSpeech || !fields.meaningEn) continue;
  const key = englishSenseKey(fields);
  const existing = exactMeanings.get(key);
  if (existing) add(row,'identical-reviewed-meaning',row.id,existing.id);
  else exactMeanings.set(key,row);
 }
 const terminal = id => resolveEnglishCanonicalId(id,byId);
 for (const claim of claims) {
  const {duplicateId,canonicalId} = claim;
  const key = JSON.stringify([duplicateId,canonicalId]);
  if (seen.has(key)) continue;
  seen.add(key);
  let status;
  if (duplicateId === canonicalId) status = 'invalid-self-claim';
  else if (!knownIds.has(duplicateId) || !knownIds.has(canonicalId)) status = 'unknown-id';
  else {
   const duplicate = byId.get(duplicateId), canonical = byId.get(canonicalId);
   const duplicateTerminal = terminal(duplicateId), canonicalTerminal = terminal(canonicalId);
   if (!duplicateTerminal || !canonicalTerminal) status = 'merge-cycle';
   else if (!duplicate || !canonical) status = 'awaiting-review';
   else if (isEnglishReviewExcluded(duplicate) && !duplicate.mergeWith) status = 'duplicate-excluded';
   else if (duplicateTerminal === canonicalTerminal) {
    const target = byId.get(canonicalTerminal);
    status = target && !isEnglishReviewExcluded(target) ? 'merged' : 'canonical-not-active';
   } else status = isEnglishReviewExcluded(canonical) ? 'canonical-not-active' : 'needs-adjudication';
  }
  links.push({...claim,status});
 }
 const closed = new Set(['merged','duplicate-excluded']);
 const remaining = links.filter(row => !closed.has(row.status));
 return {links,report:{claims:links.length,closed:links.length-remaining.length,
  remaining,errors,complete:!remaining.length && !errors.length}};
}
