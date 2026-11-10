import {resolveEnglishExampleFocus,validateEnglishGapFill} from './english-example-focus.mjs';
import {joinGapAnswers} from '../../web/js/shared/phrase-gaps.js';
import {exampleDigest} from './reviewed-examples.mjs';
import {englishExistingReviewDigest} from './english-review-identity.mjs';

export function englishGapPracticeDigest(review,gapFill=review.gapFill){
 return exampleDigest({reviewDigest:englishExistingReviewDigest(review),gapFill,
  practiceEligible:review.practiceEligible!==false});
}

/** Compile verified surface forms and explicitly reviewed discontinuous gaps. */
export function compileReviewedEnglishPractice({entries,reviews,formIndex,focusDecisions=[],gapDecisions=[],gapPracticeApprovals=[]}) {
 const byId=new Map(reviews.map(row=>[row.id,row]));
 const decisions=new Map(focusDecisions.map(row=>[row.id,row]));
 if(decisions.size!==focusDecisions.length)throw new Error('Duplicate focus decision');
 const gapById=new Map(gapDecisions.map(row=>[row.id,row]));
 if(gapById.size!==gapDecisions.length)throw new Error('Duplicate gap decision');
 const approvals=new Map(gapPracticeApprovals.map(row=>[row.id,row]));
 if(approvals.size!==gapPracticeApprovals.length)throw new Error('Duplicate gap practice approval');
 const exercises=[],englishExercises=[],koreanExercises=[],unresolved=[],focusEvidence=[];
 const counts={resolved:0,missing:0,ambiguous:0,invalid:0};
 const compiled=entries.map(original=>{
  const entry=structuredClone(original),review=byId.get(entry.id),f=review?.reviewedFields;
  if(!f||f.exampleText!==entry.example.text)throw new Error('Stale practice example: '+entry.id);
  const decision=decisions.get(entry.id);
  if(decision&&(decision.exampleTextDigest!==exampleDigest(entry.example.text)||
     !decision.reviewer?.trim()||!decision.reason?.trim()))throw new Error('Unbound focus decision: '+entry.id);
  const gapDecision=gapById.get(entry.id);
  if(gapDecision&&(gapDecision.exampleTextDigest!==exampleDigest(entry.example.text)||
     !gapDecision.reviewer?.trim()||!gapDecision.reason?.trim()))throw new Error('Unbound gap decision: '+entry.id);
  if(gapDecision){
   const checked=validateEnglishGapFill({sentence:entry.example.text,gapFill:gapDecision.gapFill});
   if(checked.status!=='resolved')throw new Error('Invalid reviewed gaps: '+entry.id+' '+checked.reason);
   if(review.gapFill&&exampleDigest(review.gapFill)!==exampleDigest(gapDecision.gapFill)){
    throw new Error('Conflicting gap decisions: '+entry.id);
   }
  }
  const gapFill=gapDecision?.gapFill||review.gapFill;
  const result=resolveEnglishExampleFocus({entry,sentence:entry.example.text,formIndex,
   reviewedFocus:decision?.focus||entry.example.focus,approvedAliases:entry.aliases||[],gapFill});
  counts[result.status]++;
  if(result.status==='invalid')throw new Error('Invalid reviewed focus: '+entry.id+' '+result.reason);
  if(result.status==='resolved'){
   entry.example.focus=result.focus;
   focusEvidence.push({id:entry.id,exampleTextDigest:exampleDigest(entry.example.text),focus:result.focus,evidence:result.evidence});
  }else unresolved.push({id:entry.id,word:entry.word,sentence:entry.example.text,status:result.status,reason:result.reason});
  if(gapFill){
   const gaps=validateEnglishGapFill({sentence:entry.example.text,gapFill});
   if(gaps.status!=='resolved')throw new Error('Invalid reviewed gaps: '+entry.id+' '+gaps.reason);
   // The entire phrase is not contiguous; only its approved exercise may blank it.
   entry.example.clozeEligible=false;
   const approval=approvals.get(entry.id);
   if(gapDecision&&!approval)throw new Error('Unapproved gap practice: '+entry.id);
   if(approval){
    if(approval.reviewDigest!==englishGapPracticeDigest(review,gapFill)||!approval.reviewer?.trim()||
       !approval.reason?.trim())throw new Error('Unbound gap practice approval: '+entry.id);
    delete entry.example.practiceEligible;
   }
   const category=review.proposal?.origins?.map(origin=>origin.candidate.phraseCategory)
    .find(value=>['phrasal','idioms','collocations'].includes(value))||'collocations';
   // Only reviewer-approved descriptors are compiled. Never blank an intervening object.
   exercises.push({id:entry.id+'-gaps',entryId:entry.id,category,route:'vocabinput',
    prompt:gapFill.parts.join('___'),answer:joinGapAnswers(gapFill.answers),gapFill:structuredClone(gapFill)});
   englishExercises.push({id:entry.id+'-gaps',instruction:'Complete the expression.',context:f.meaningEn,
    explanation:entry.word+' — '+f.meaningEn});
   koreanExercises.push({id:entry.id+'-gaps',instruction:'표현을 완성하세요.',context:f.meaningKo,
    explanation:entry.word+' — '+f.meaningKo});
  }
  return entry;
 });
 for(const id of decisions.keys())if(!byId.has(id)||!entries.some(row=>row.id===id))throw new Error('Unknown focus decision: '+id);
 for(const id of gapById.keys())if(!byId.has(id)||!entries.some(row=>row.id===id))throw new Error('Unknown gap decision: '+id);
 for(const id of approvals.keys())if(!exercises.some(row=>row.entryId===id))throw new Error('Unknown gap practice approval: '+id);
 return {entries:compiled,exercises,englishExercises,koreanExercises,focusEvidence,
  report:{entries:compiled.length,counts,structuredGaps:exercises.length,unresolved,
   notice:'Unresolved spans remain available as dictionary examples; no guessed blank or morphology is introduced.'}};
}
