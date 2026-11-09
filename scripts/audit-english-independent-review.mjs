import {readFile,readdir} from 'node:fs/promises';
import {writeTextAtomic as writeFile} from './content/atomic-text.mjs';
import {createHash} from 'node:crypto';
import {ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';
import {auditSupplementalSources,isEnglishReviewExcluded,isEnglishRelevanceExclusion} from './content/supplemental-source-review.mjs';
import {collectEnglishReviewCandidates,auditEnglishReviewCandidateDecisions,applyEnglishCandidateDecisions} from './content/english-review-candidates.mjs';
import {auditSourceResolutions} from './content/source-resolution-review.mjs';
import {auditEnglishStudyRelevance,ENGLISH_STUDY_POLICY_ID} from './content/english-study-relevance.mjs';
import {exampleDigest} from './content/reviewed-examples.mjs';
import {auditEnglishSemanticLinks} from './content/english-semantic-links.mjs';
import {auditEnglishCanonicalFollowups} from './content/english-canonical-followups.mjs';
import {listEnglishProposalFiles,assertEnglishProposalLedger} from './content/english-review-files.mjs';
import {auditEnglishDefinitionSourceCorrections,auditEnglishExampleSourceCorrections} from './content/english-reviewed-entries.mjs';

const root=new URL('../',import.meta.url);
const folder='local-data/coverage/four-language-review/';
async function rows(path){
 try{return (await readFile(new URL(path,root),'utf8')).split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line));}
 catch(error){if(error.code==='ENOENT')return [];throw error;}
}
async function proposalRows(name){
 const proposals=await rows(folder+'english-sense-plan/'+name);
 const part=/^headword-additions-(\d+)\.jsonl$/u.exec(name)?.[1];
 const inputs=part?await rows(folder+`english-sense-plan/headword-author-${Number(part)}-input.jsonl`):[];
 assertEnglishProposalLedger(name,proposals,inputs);
 return proposals;
}
const source=await rows(folder+'en-source-finalized.jsonl');
const quotationAudit=auditSourceResolutions({
 inputs:await rows(folder+'en-source-quotation-followup-flags.jsonl'),
 resolutions:await rows(folder+'en-source-quotation-followup-resolutions.jsonl'),
 crossReviews:await rows(folder+'en-source-quotation-followup-cross-review.jsonl'),
 finalDecisions:await rows(folder+'en-source-quotation-followup-final-decisions.jsonl'),
});
const effectiveSource=new Map(source.map(row=>[row.id,row]));
for(const row of quotationAudit.finalized)if(row.crossReview?.verdict==='pass'||row.adjudication){
 effectiveSource.set(row.id,row);
}
const sourceById=new Map([...effectiveSource.values()].map(row=>[row.id,row.resolution]));
const queues=await Promise.all([1,2,3].map(part=>rows(folder+`english-sense-plan/independent-${part}-input.jsonl`)));
const decisions=await Promise.all([1,2,3].map(part=>rows(folder+`english-sense-plan/independent-${part}-decisions.jsonl`)));
// Tail decisions retain their original part-two input and author-independence checks.
decisions[1].push(...await rows(folder+'english-sense-plan/independent-2-tail-decisions.jsonl'));
const sourceClosures=await rows(folder+'english-sense-plan/supplemental-source-closures.jsonl');
const sourceIssues=await rows(folder+'english-sense-plan/supplemental-source-issues.jsonl');
const earlierFindings=await rows(folder+'en-new-source-findings.jsonl');
const allInputs=new Map(queues.flat().map(row=>[row.id,row]));
if(allInputs.size!==queues.flat().length)throw new Error('Independent review queues overlap');
const accepted=new Set(['pass','revise']);
const excluded=new Set(['exclude','retire']);
const reviewFileNames=await readdir(new URL(folder+'english-sense-plan/',root));
const reviewed=new Map(),errors=[],merges=new Map(),newCandidates=[];
const text=value=>typeof value==='string'&&value.trim();
const parts=[];
for(let part=0;part<3;part++){
 const inputs=new Map(queues[part].map(row=>[row.id,row])),seen=new Set();
 for(const row of decisions[part]){
  const input=inputs.get(row.id);
  if(!input||seen.has(row.id)){errors.push({id:row.id,error:'Unknown or duplicate review ID',part:part+1});continue;}
  seen.add(row.id);reviewed.set(row.id,row);
  if(row.inputDigest!==input.inputDigest)errors.push({id:row.id,error:'Review input binding changed'});
  if((input.originalAuthorIndices||[]).includes(part))errors.push({id:row.id,error:'Review is assigned to its original author'});
  if(!accepted.has(row.verdict)&&!excluded.has(row.verdict))errors.push({id:row.id,error:'Unresolved review verdict'});
  const isExcluded=isEnglishReviewExcluded(row);
  if(!isExcluded&&accepted.has(row.verdict)){
   const fields=row.reviewedFields;
   if(!['word','partOfSpeech','meaningEn','meaningKo','exampleText','exampleTranslation'].every(key=>text(fields?.[key]))||
      !ENGLISH_LEVELS.includes(row.proposedLevel)||!text(row.levelRationale)){
    errors.push({id:row.id,error:'Accepted sense lacks complete content or an explicit individual level'});
   }
   const originalResolution=sourceById.get(row.id);
   if(!row.mergeWith&&originalResolution&&(['retire-error','retire-unsupported','merge-duplicate'].includes(originalResolution.disposition)||
      originalResolution.originalSenseRetired===true)){
    errors.push({id:row.id,error:'Retired or merged source identity is still approved as an independent sense'});
   }
  }else if(isExcluded&&!isEnglishRelevanceExclusion(row)&&!row.mergeWith&&!sourceById.has(row.id)){
   const evidence=row.evidenceUrls?.length?row.evidenceUrls:row.sourceDoubt?.evidenceUrls;
   if(!text(row.reason)||!evidence?.length)errors.push({id:row.id,error:'New source exclusion lacks research evidence'});
  }
  if(row.mergeWith){
   if(row.mergeWith===row.id)errors.push({id:row.id,error:'Invalid or unknown semantic merge target',target:row.mergeWith});
   else merges.set(row.id,row.mergeWith);
  }
  for(const candidate of [...(row.additionalSenseCandidates||[]),...(row.separateAlternative?[row.separateAlternative]:[])]){
   newCandidates.push({parentId:row.id,candidate});
   if(!text(candidate.englishMeaning||candidate.meaningEn)||!text(candidate.meaning||candidate.meaningKo)||!text(candidate.exampleText)||
      !text(candidate.exampleTranslation)||!ENGLISH_LEVELS.includes(candidate.proposedLevel)||!text(candidate.levelRationale)){
    errors.push({id:row.id,error:'New sense candidate is incomplete or unlevelled'});
   }
  }
 }
 parts.push({part:part+1,expected:inputs.size,reviewed:seen.size,remaining:inputs.size-seen.size});
}
const cycles=[];
for(const [id]of merges){
 const seen=new Set();let next=id;
 while(merges.has(next)){
  if(seen.has(next)){cycles.push({id,cycleAt:next});break;}
  seen.add(next);next=merges.get(next);
 }
}
const issueById=new Map(sourceIssues.map(row=>[row.id,row]));
for(const finding of earlierFindings)if(!finding.mergeWith&&!issueById.has(finding.id)){
 issueById.set(finding.id,{id:finding.id,firstFinding:finding.reason,origin:'en-new-source-findings.jsonl'});
}
const originalSourceIds=new Set(sourceById.keys());
const freshFindings=auditSupplementalSources([...reviewed.values()],[],originalSourceIds).findings;
for(const finding of freshFindings)if(!issueById.has(finding.id)){
 issueById.set(finding.id,{id:finding.id,firstFinding:finding.sourceDoubt||finding.reason,origin:'independent-sense-review'});
}
const supplemental=auditSupplementalSources([...reviewed.values()],sourceClosures,originalSourceIds,new Set(issueById.keys()));
const supplementalSenses=collectEnglishReviewCandidates({inputs:[...allInputs.values()],reviews:[...reviewed.values()],
 sourceFinalized:[...effectiveSource.values()],extraProposals:
  (await Promise.all(listEnglishProposalFiles(reviewFileNames)
   .map(proposalRows))).flat()});
// New independently reviewed senses can be canonical targets; the semantic audit
// below still blocks pending, excluded or cyclic targets.
const knownMergeIds=new Set([...allInputs.keys(),...supplementalSenses.candidates.map(row=>row.id)]);
for(const [id,target]of merges)if(!knownMergeIds.has(target))errors.push({id,error:'Invalid or unknown semantic merge target',target});
const supplementalDecisionFiles=reviewFileNames
 .filter(name=>/^supplemental-review-\d+-decisions\.jsonl$/u.test(name))
 .sort((a,b)=>Number(a.split('-')[2])-Number(b.split('-')[2]));
const supplementalSenseDecisions=[
 ...await rows(folder+'english-sense-plan/supplemental-sense-decisions.jsonl'),
 ...(await Promise.all(supplementalDecisionFiles.map(name=>rows(folder+'english-sense-plan/'+name)))).flat(),
];
const effectiveReviews=new Map(reviewed);
for(const row of supplemental.finalized){
 if(!isEnglishRelevanceExclusion(reviewed.get(row.id)))effectiveReviews.set(row.id,row.effectiveReview);
}
const relevanceDecisions=[
 ...await rows(folder+'english-sense-plan/study-relevance-decisions.jsonl'),
 ...(await Promise.all([1,2,3].map(part=>rows(folder+`english-sense-plan/study-relevance-${part}-decisions.jsonl`)))).flat(),
];
const relevanceAudit=auditEnglishStudyRelevance([...effectiveReviews.values()],relevanceDecisions);
const scopedMainReviews=new Map(effectiveReviews);
for(const row of relevanceAudit.finalized)scopedMainReviews.set(row.id,row.effectiveReview);
const supplementalSenseAudit=auditEnglishReviewCandidateDecisions(supplementalSenses.candidates,
 supplementalSenseDecisions,new Set(allInputs.keys()),[...scopedMainReviews.values()]);
const supplementalRelevance=auditEnglishStudyRelevance(supplementalSenseAudit.finalized.map(row=>row.decision));
const semanticReviews=applyEnglishCandidateDecisions(scopedMainReviews,
 supplementalSenseAudit.finalized,new Set(allInputs.keys()));
const semanticLinks=auditEnglishSemanticLinks({
 knownIds:new Set([...allInputs.keys(),...supplementalSenses.candidates.map(row=>row.id)]),
 reviews:[...semanticReviews.values()],
});
const canonicalFollowups=auditEnglishCanonicalFollowups({
 knownIds:new Set([...allInputs.keys(),...supplementalSenses.candidates.map(row=>row.id)]),
 reviews:[...semanticReviews.values()],
 decisions:[...await rows(folder+'english-sense-plan/canonical-followup-decisions.jsonl'),
  ...(await Promise.all([1,2,3].map(part=>rows(folder+`english-sense-plan/canonical-followup-${part}-decisions.jsonl`)))).flat()],
});
const definitionSourceCorrections=auditEnglishDefinitionSourceCorrections([...semanticReviews.values()]);
const exampleSourceCorrections=auditEnglishExampleSourceCorrections([...semanticReviews.values()]);
const effectiveReviewText=[...semanticReviews.values()].map(row=>JSON.stringify(row)).join('\n')+'\n';
const report={
 effectiveReviewSha256:createHash('sha256').update(effectiveReviewText).digest('hex'),
 expected:allInputs.size,reviewed:reviewed.size,remaining:allInputs.size-reviewed.size,parts,errors,
 originalSourceResolutions:source.length,supplementalSources:supplemental.report,
 quotationFollowups:quotationAudit.report,
 semanticMerges:merges.size,mergeCycles:cycles,newSenseCandidates:newCandidates.length,
 semanticLinks:semanticLinks.report,
 canonicalFollowups:canonicalFollowups.report,
 definitionSourceCorrections,
 exampleSourceCorrections,
 supplementalSenseCandidates:supplementalSenses.candidates.length,supplementalSenseErrors:supplementalSenses.errors,
 supplementalSenseReview:supplementalSenseAudit.report,
 studyRelevance:{policyId:ENGLISH_STUDY_POLICY_ID,main:relevanceAudit.report,supplemental:supplementalRelevance.report},
 complete:reviewed.size===allInputs.size&&errors.length===0&&cycles.length===0&&supplemental.report.complete&&quotationAudit.report.complete&&
  supplementalSenses.errors.length===0&&supplementalSenseAudit.report.complete&&
  relevanceAudit.report.complete&&supplementalRelevance.report.complete&&semanticLinks.report.complete&&canonicalFollowups.report.complete&&definitionSourceCorrections.complete&&exampleSourceCorrections.complete,
 notice:'Current independent review coverage. New exclusions need source closure and new meaning proposals need consolidation/review before final packaging.',
};
await writeFile(new URL(folder+'english-sense-plan/independent-effective-finalized.jsonl',root),effectiveReviewText);
await writeFile(new URL(folder+'english-sense-plan/independent-audit.json',root),JSON.stringify(report,null,2)+'\n');
await writeFile(new URL(folder+'english-sense-plan/semantic-links.jsonl',root),semanticLinks.links.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/canonical-followups.jsonl',root),canonicalFollowups.issues.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/independent-new-senses.jsonl',root),newCandidates.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/supplemental-source-input.jsonl',root),supplemental.findings.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/supplemental-source-issues.jsonl',root),[...issueById.values()].map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/supplemental-source-finalized.jsonl',root),supplemental.finalized.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/supplemental-sense-candidates.jsonl',root),supplementalSenses.candidates.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/supplemental-sense-finalized.jsonl',root),supplementalSenseAudit.finalized.map(row=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/study-relevance-approved.jsonl',root),relevanceAudit.finalized.map(({effectiveReview,...row})=>JSON.stringify(row)).join('\n')+'\n');
await writeFile(new URL(folder+'english-sense-plan/study-relevance-input.jsonl',root),relevanceAudit.report.remaining.map(id=>{
 const row=effectiveReviews.get(id);
 return JSON.stringify({id,reviewDigest:exampleDigest(row),reviewedFields:row.reviewedFields,
  proposedLevel:row.proposedLevel,previousReason:row.reason,
  policyId:ENGLISH_STUDY_POLICY_ID});
}).join('\n')+'\n');
if(quotationAudit.report.complete){
 await writeFile(new URL(folder+'en-source-effective-finalized.jsonl',root),[...effectiveSource.values()].map(row=>JSON.stringify(row)).join('\n')+'\n');
}
console.log(JSON.stringify({...report,supplementalSources:{...supplemental.report,remaining:supplemental.report.remaining.length},
 quotationFollowups:{expected:quotationAudit.report.expected,independentlyPassed:quotationAudit.report.independentlyPassed,
  errors:quotationAudit.report.errors.length,complete:quotationAudit.report.complete},
 supplementalSenseReview:{...supplementalSenseAudit.report,remaining:supplementalSenseAudit.report.remaining.length,
  errors:supplementalSenseAudit.report.errors.length},
 studyRelevance:{policyId:ENGLISH_STUDY_POLICY_ID,
  main:{...relevanceAudit.report,remaining:relevanceAudit.report.remaining.length,errors:relevanceAudit.report.errors.length},
  supplemental:{...supplementalRelevance.report,remaining:supplementalRelevance.report.remaining.length,errors:supplementalRelevance.report.errors.length}},
 semanticLinks:{...semanticLinks.report,remaining:semanticLinks.report.remaining.length,errors:semanticLinks.report.errors.length},
 canonicalFollowups:{...canonicalFollowups.report,remaining:canonicalFollowups.report.remaining.length,errors:canonicalFollowups.report.errors.length},
 supplementalSenseErrors:supplementalSenses.errors.length,errors:errors.length,mergeCycles:cycles.length}));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
