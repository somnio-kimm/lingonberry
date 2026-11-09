import {createHash} from 'node:crypto';
import {exampleDigest} from './reviewed-examples.mjs';
import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';
import {englishExistingReviewDigest,resolveEnglishCanonicalId} from './english-review-identity.mjs';
export {englishExistingReviewDigest} from './english-review-identity.mjs';

const normalise = value => String(value || '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
const meaningKey = value => normalise(value).toLowerCase().replace(/[.!。]+$/u, '');
export const englishSenseKey = row => [normalise(row.word),row.partOfSpeech,meaningKey(row.meaningEn)].join('\u0000');
export const englishSenseId = row => 'en-sense-' + createHash('sha256').update(englishSenseKey(row)).digest('hex').slice(0,24);

function normaliseCandidate(candidate, fallback) {
 return {
  word:candidate.word || candidate.headword || fallback?.word,
  partOfSpeech:candidate.partOfSpeech || fallback?.partOfSpeech,
  meaningEn:candidate.meaningEn || candidate.englishMeaning,
  meaningKo:candidate.meaningKo || candidate.meaning || candidate.koreanMeaning,
  exampleText:candidate.exampleText,exampleTranslation:candidate.exampleTranslation,
  proposedLevel:candidate.proposedLevel,levelRationale:candidate.levelRationale,
  ...(candidate.focus ? {focus:candidate.focus} : {}),
  ...(candidate.practiceEligible === false ? {practiceEligible:false} : {}),
 };
}

/** Collect every proposed replacement/additional sense without silently approving it. */
export function collectEnglishReviewCandidates({inputs, reviews, sourceFinalized, extraProposals = []}) {
 const inputById = new Map(inputs.map(row => [row.id,row]));
 const reviewById = new Map(reviews.map(row => [row.id,row]));
 const known = new Map();
 const addKnown = (fields, id) => {
  const key = englishSenseKey(fields);
  if (!known.has(key)) known.set(key, new Set());
  known.get(key).add(id);
 };
 for (const input of inputs) {
  addKnown(input,input.id);
  const review = reviewById.get(input.id);
  if (review?.reviewedFields) addKnown(review.reviewedFields,input.id);
 }
 const candidates = new Map(), errors = [];
 const collect = (parentId, field, candidate, origin) => {
  const fields = normaliseCandidate(candidate,inputById.get(parentId));
  const complete = ['word','partOfSpeech','meaningEn','meaningKo','exampleText','exampleTranslation','levelRationale']
   .every(key => normalise(fields[key])) && ENGLISH_LEVELS.includes(fields.proposedLevel);
  if (!complete) { errors.push({parentId,field,error:'Incomplete candidate content',candidate}); return; }
  const key = englishSenseKey(fields);
  if (!candidates.has(key)) candidates.set(key,{
   id:englishSenseId(fields), ...fields, sourceIds:[], existingMatches:[...(known.get(key) || [])],
   origins:[], levelConflicts:[], reviewStatus:'pending-semantic-review',
  });
  const row = candidates.get(key);
  if (fields.practiceEligible === false) row.practiceEligible = false;
  if (!row.sourceIds.includes(parentId)) row.sourceIds.push(parentId);
  if (row.proposedLevel !== fields.proposedLevel && !row.levelConflicts.includes(fields.proposedLevel)) {
   row.levelConflicts.push(fields.proposedLevel);
  }
  row.origins.push({parentId,field,...origin,candidateDigest:exampleDigest(candidate),candidate});
 };
 for (const review of reviews) {
  for (const candidate of review.additionalSenseCandidates || []) collect(review.id,'additionalSenseCandidates',candidate,
   {kind:'independent-sense-review',reviewer:review.reviewer || null,originDigest:exampleDigest(review)});
  if (review.separateAlternative) collect(review.id,'separateAlternative',review.separateAlternative,
   {kind:'independent-sense-review',reviewer:review.reviewer || null,originDigest:exampleDigest(review)});
 }
 for (const wrapper of sourceFinalized) {
  const resolution = wrapper.resolution;
  const origin = {kind:'final-source-resolution',originDigest:exampleDigest(resolution),
   reviewer:wrapper.adjudication?.reviewer || wrapper.crossReview?.reviewer || null};
  for (const field of ['acceptedSenses','additionalSenseCandidates','supportedAlternatives']) {
   for (const candidate of resolution[field] || []) collect(wrapper.id,field,candidate,origin);
  }
  if (resolution.resolved && typeof resolution.resolved === 'object') collect(wrapper.id,'resolved',resolution.resolved,origin);
 }
 for (const proposal of extraProposals) collect(proposal.parentId,'additional-reviewed-proposal',proposal.candidate,
  {kind:'conversation-authored-addition',reviewer:proposal.reviewer,originDigest:exampleDigest(proposal)});
 return {candidates:[...candidates.values()], errors};
}

/** A proposal sharing a primary ID never replaces that primary or emits a self-alias. */
export function applyEnglishCandidateDecisions(mainReviews, finalized, knownIds=new Set(mainReviews.keys())) {
 const result=new Map(mainReviews);
 for(const row of finalized)if(!knownIds.has(row.id))result.set(row.id,{...row.decision,proposal:row.candidate,
  ...(row.decision.verdict==='reuse'?{mergeWith:row.decision.canonicalId}:{}),
 });
 return result;
}

/** Added meanings remain pending until individually accepted, linked or excluded. */
export function auditEnglishReviewCandidateDecisions(candidates, decisions, knownIds = new Set(), existingReviews = []) {
 const byId = new Map(candidates.map(row => [row.id,row]));
 const existingById=new Map(existingReviews.map(row=>[row.id,row]));
 const seen = new Set(), finalized = [], errors = [], counts = {}, pendingReuse = [];
 const commit = row => {
  counts[row.decision.verdict] = (counts[row.decision.verdict] || 0) + 1;
  finalized.push(row);
 };
 for (const decision of decisions) {
  const candidate = byId.get(decision.id);
  if (!candidate || seen.has(decision.id)) {
   errors.push({id:decision.id,error:'Unknown or duplicate supplemental sense review'});
   continue;
  }
  seen.add(decision.id);
  if (decision.candidateDigest !== exampleDigest(candidate) || !normalise(decision.reviewer) ||
      candidate.origins.some(origin => origin.reviewer === decision.reviewer) || !normalise(decision.reason) ||
      !['add','reuse','exclude'].includes(decision.verdict)) {
   errors.push({id:decision.id,error:'Sense decision is stale, incomplete or not independent'});
   continue;
  }
  if (decision.verdict === 'add') {
   const fields = decision.reviewedFields;
   if (knownIds.has(decision.id) ||
       !['word','partOfSpeech','meaningEn','meaningKo','exampleText','exampleTranslation'].every(key => normalise(fields?.[key])) ||
       !ENGLISH_LEVELS.includes(decision.proposedLevel) || !normalise(decision.levelRationale)) {
    errors.push({id:decision.id,error:'New sense duplicates an existing ID or lacks reviewed bilingual content and level'});
    continue;
   }
  }
  const row = {id:decision.id,candidate,decision};
  if (decision.verdict === 'reuse') pendingReuse.push(row);
  else commit(row);
 }
 const addedIds = new Set(finalized.filter(row => row.decision.verdict === 'add').map(row => row.id));
 for(const row of finalized)if(row.decision.verdict==='add')existingById.set(row.id,row.decision);
 for (const row of pendingReuse) {
  if(knownIds.has(row.id)){
   const existing=existingById.get(row.id);
   const targetId=resolveEnglishCanonicalId(row.id,existingById),target=existingById.get(targetId);
   if(!existing || !target || targetId!==row.decision.canonicalId || target.mergeWith ||
      isEnglishReviewExcluded(target) || row.decision.canonicalDigest!==englishExistingReviewDigest(target) ||
      (targetId!==row.id && row.decision.existingReviewDigest!==englishExistingReviewDigest(existing))){
    errors.push({id:row.id,error:'Reusing a promoted primary ID needs its current primary and active canonical content bindings'});
   }else commit(row);
   continue;
  }
  if (!knownIds.has(row.decision.canonicalId) && !addedIds.has(row.decision.canonicalId)) {
   errors.push({id:row.id,error:'Reused sense must identify an existing or independently approved new record'});
  } else commit(row);
 }
 const approved = new Set(finalized.map(row => row.id));
 const remaining = candidates.filter(row => !approved.has(row.id)).map(row => row.id);
 return {finalized,report:{expected:candidates.length,reviewed:approved.size,remaining,errors,counts,
  complete:!remaining.length && !errors.length}};
}
