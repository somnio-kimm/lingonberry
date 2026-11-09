import {exampleDigest} from './reviewed-examples.mjs';
import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';

/** Resolve reviewed equivalences, preserving a visible failure for cycles. */
export function resolveEnglishCanonicalId(id,byId){
 const visited=new Set();
 while(byId.get(id)?.mergeWith){
  if(visited.has(id))return null;
  visited.add(id);id=byId.get(id).mergeWith;
 }
 return id;
}

/** Bind a judgement to current learner content and its equivalence state. */
export function englishExistingReviewDigest(row){
 return exampleDigest({id:row.id,reviewedFields:row.reviewedFields??null,
  proposedLevel:row.proposedLevel??null,mergeWith:row.mergeWith||null,
  excluded:isEnglishReviewExcluded(row)});
}
