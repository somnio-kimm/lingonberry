/** Preserve stored history while excluding questions invalidated by a content correction. */
export function compareContentVersions(left,right){
 const parts=value=>/^\d+\.\d+\.\d+$/u.test(value||'')?value.split('.').map(BigInt):[0n,0n,0n];
 const a=parts(left),b=parts(right);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;return 0;
}
export function createReviewContentPolicy(study){
 const retired=new Set((study?.retiredEntries||[]).map(row=>row.id));
 const revisions=new Map((study?.reviewInvalidations||[]).map(row=>[row.id,row.minimumVersion]));
 const ids=question=>[question?.word?.id,...(question?.options||[]).map(option=>option.id)].filter(Boolean);
 function revisionFor(question){let revision;for(const id of ids(question)){const next=revisions.get(id);if(next&&(!revision||compareContentVersions(next,revision)>0))revision=next;}return revision;}
 return {
  isCurrent(question){
   if(ids(question).some(id=>retired.has(id)))return false;
   if(question?.contentVersion&&compareContentVersions(question.contentVersion,study?.studyVersion)>0)return false;
   const revision=revisionFor(question);return !revision||compareContentVersions(question?.contentVersion,revision)>=0;
  },
  prepare(question){if(!question)return question;const reviewRevision=revisionFor(question);return {...question,contentVersion:study?.studyVersion,...(reviewRevision?{reviewRevision}:{})};},
 };
}
