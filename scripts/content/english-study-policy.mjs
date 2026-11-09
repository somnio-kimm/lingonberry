export const ENGLISH_STUDY_POLICY_ID='english-useful-through-gre-2026-11-08';

const scopeDispositions=new Set(['retire-low-study-relevance','exclude-low-study-relevance',
 'exclude-minor-sense','retire-redundant-inflection']);

/** A supported sense can be declined for study without alleging a source error. */
export function isEnglishRelevanceExclusion(row){
 if(scopeDispositions.has(row.disposition))return true;
 return !row.disposition&&['pass','revise'].includes(row.verdict)&&row.excludedFromStudy===true&&
  row.studyRelevance?.policyId===ENGLISH_STUDY_POLICY_ID&&row.studyRelevance.verdict==='exclude'&&
  typeof row.studyRelevance.reason==='string'&&!!row.studyRelevance.reason.trim()&&
  !row.needsSourceResolution&&!row.sourceDoubt&&!row.sourceQA?.previousExclusionOverturned;
}
