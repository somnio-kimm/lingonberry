import {exampleDigest} from './reviewed-examples.mjs';
import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';

const text = value => typeof value === 'string' && value.trim();
const outcomes = new Set(['confirm-exclusion', 'correct-and-keep', 'verify-as-reviewed', 'merge-duplicate','exclude-study-scope']);

import {isEnglishRelevanceExclusion} from './english-study-policy.mjs';
export {isEnglishRelevanceExclusion} from './english-study-policy.mjs';

export function isEnglishReviewExcluded(row) {
 return ['exclude','retire'].includes(row.verdict) || /^(?:retire-|exclude)/u.test(row.disposition || '') ||
  row.excludedFromStudy === true || row.excluded === true || row.excludeFromActivePlan === true;
}

/** Newly discovered source questions need an independent, content-bound decision. */
export function auditSupplementalSources(reviews, closures, originalSourceIds = new Set(), knownFindingIds = new Set()) {
 const findings = reviews.filter(row => (!row.mergeWith || knownFindingIds.has(row.id)) && (
  knownFindingIds.has(row.id) ||
  (!isEnglishRelevanceExclusion(row) && (row.needsSourceResolution === true || Boolean(row.sourceDoubt) ||
  row.disposition === 'source-verification-pending' || row.sourceQA?.previousExclusionOverturned === true ||
  (!originalSourceIds.has(row.id) && row.disposition !== 'merge-duplicate' && isEnglishReviewExcluded(row))))
 ));
 const byId = new Map(findings.map(row => [row.id, row]));
 const seen = new Set(), errors = [], resolved = [], finalized = [];
 for (const id of knownFindingIds) {
  if (!byId.has(id)) errors.push({id,error:'Previously recorded source finding disappeared from review data'});
 }
 for (const closure of closures) {
  const review = byId.get(closure.id);
  if (!review || seen.has(closure.id)) {
   errors.push({id:closure.id, error:'Unknown or duplicate supplemental source closure'});
   continue;
  }
  seen.add(closure.id);
  const links = closure.evidenceUrls;
  const validLinks = closure.verdict === 'exclude-study-scope' && (!links || !links.length) ||
   Array.isArray(links) && links.length && links.every(link => {
   try { const url = new URL(link); return url.protocol === 'https:' && !url.username && !url.password; }
   catch { return false; }
  });
  if (closure.reviewDigest !== exampleDigest(review) || !text(closure.reviewer) ||
      closure.reviewer === review.reviewer || !outcomes.has(closure.verdict) || !text(closure.reason) || !validLinks) {
   errors.push({id:closure.id, error:'Source closure is stale, incomplete or not independent'});
   continue;
  }
  if (['correct-and-keep', 'verify-as-reviewed'].includes(closure.verdict)) {
   const fields = closure.verdict === 'verify-as-reviewed' ? review.reviewedFields : closure.reviewedFields;
   const level = closure.verdict === 'verify-as-reviewed' ? review.proposedLevel : closure.proposedLevel;
   const rationale = closure.verdict === 'verify-as-reviewed' ? review.levelRationale : closure.levelRationale;
   if (!['word','partOfSpeech','meaningEn','meaningKo','exampleText','exampleTranslation'].every(key => text(fields?.[key])) ||
       !ENGLISH_LEVELS.includes(level) || !text(rationale)) {
    errors.push({id:closure.id, error:'Accepted source correction lacks bilingual content or its own level'});
    continue;
   }
  }
  if (closure.verdict === 'merge-duplicate' && (!text(closure.mergeWith) || closure.mergeWith === closure.id)) {
   errors.push({id:closure.id, error:'Source merge needs a distinct canonical sense ID'});
   continue;
  }
  resolved.push(closure.id);
  const active = ['correct-and-keep','verify-as-reviewed'].includes(closure.verdict);
  finalized.push({id:closure.id,closure,effectiveReview:{...review,
   ...(closure.verdict === 'correct-and-keep' ? {
    reviewedFields:closure.reviewedFields,proposedLevel:closure.proposedLevel,levelRationale:closure.levelRationale,
   } : {}),
   verdict:active?'revise':'exclude',
   disposition:active?'corrected':closure.verdict==='merge-duplicate'?'merge-duplicate':
    closure.verdict==='exclude-study-scope'?'retire-low-study-relevance':'retire-unsupported',
   excludedFromStudy:!active,excluded:!active,excludeFromActivePlan:!active,
   needsSourceResolution:false,sourceDoubt:null,
   ...(closure.mergeWith?{mergeWith:closure.mergeWith}:{}),
   ...(closure.practiceEligible===false?{practiceEligible:false}:{}),
   sourceClosureDigest:exampleDigest(closure),
  }});
 }
 const closed = new Set(resolved);
 const pending = findings.filter(row => !closed.has(row.id));
 return {findings, pending, finalized, report:{expected:findings.length, resolved:closed.size,
  remaining:pending.map(row => row.id), errors, complete:!pending.length && !errors.length}};
}
