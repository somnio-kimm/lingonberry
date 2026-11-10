import {exampleDigest} from './reviewed-examples.mjs';

const languages=new Set(['de','zh','ja']);
const levels={de:['A1','A2','B1','B2','C1','C2'],zh:['1','2','3','4','5','6','7'],ja:['N5','N4','N3','N2','N1']};
const accepted=new Set(['pass','approved','revise','corrected','needs-source','retire']);
const text=value=>typeof value==='string'&&!!value.trim();
const copy=value=>structuredClone(value);
const equal=(a,b)=>exampleDigest(a)===exampleDigest(b);
const required=['word','partOfSpeech','level','meaningEn','meaningKo','exampleText','exampleTranslationEn','exampleTranslationKo'];

/** Read the two existing journal formats without losing source or grammar data. */
export function resolveLanguageEntryDecision(input,decision){
 const core=copy(decision.proposedCoreEntry||input.coreEntry);
 const english=copy(decision.proposedEnglishExplanation||input.englishExplanation);
 const korean=copy(decision.proposedKoreanExplanation||input.koreanExplanation);
 const f=decision.reviewedFields;
 if(f){
  for(const key of ['word','partOfSpeech','level','article','pronunciation']){
   if(!Object.hasOwn(f,key))continue;
   if(f[key]===null&&['article','pronunciation'].includes(key))delete core[key];else core[key]=f[key];
  }
  for(const [pair,key,translation] of [[english,'meaningEn','exampleTranslationEn'],[korean,'meaningKo','exampleTranslationKo']]){
   if(Object.hasOwn(f,key)){
    if(f[key]!==pair.meaning&&pair.meanings)pair.meanings=[f[key]];
    pair.meaning=f[key];
   }
   if(Object.hasOwn(f,translation))pair.exampleTranslation=f[translation];
  }
  if(Object.hasOwn(f,'exampleText'))core.example={...core.example,text:f.exampleText};
 }
 if([core,english,korean].some(row=>row.id!==input.id))throw new Error('A review cannot replace another entry ID');
 const fields={word:core.word,partOfSpeech:core.partOfSpeech,level:core.level,
  meaningEn:english.meaning,meaningKo:korean.meaning,exampleText:core.example?.text,
  exampleTranslationEn:english.exampleTranslation,exampleTranslationKo:korean.exampleTranslation};
 if(!required.every(key=>text(fields[key])))throw new Error('Incomplete reviewed lexical or bilingual example fields');
 if(!levels[input.studyLanguage]?.includes(core.level))throw new Error('Invalid study level');
 if(input.studyLanguage==='ja'&&!text(core.pronunciation))throw new Error('Missing Japanese reading');
 if(input.studyLanguage==='zh'&&['word','level','pronunciation'].some(key=>core[key]!==input.coreEntry[key])){
  throw new Error('Official Chinese headword, level and citation reading must remain pinned; flag official-source discrepancies separately');
 }
 const changed=!equal([core,english,korean],[input.coreEntry,input.englishExplanation,input.koreanExplanation]);
 return {core,english,korean,fields,changed};
}

const validUrls=urls=>Array.isArray(urls)&&urls.length>0&&urls.every(value=>{
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
});

/** Coverage and approval integrity are necessary, not proof of linguistic accuracy. */
export function auditLanguageEntryReviews({language,inputs,decisions,crossReviews=[],legacyDecisions=[],sourceFindings=[]}){
 if(!languages.has(language))throw new Error('Unsupported full-review language');
 const byId=new Map(inputs.map(row=>[row.id,row]));
 if(byId.size!==inputs.length||inputs.some(row=>row.studyLanguage!==language))throw new Error('Invalid review input identity');
 const legacy=new Map(legacyDecisions.map(row=>[row.id,exampleDigest(row)]));
 const findings=new Map();
 for(const finding of sourceFindings){
  if(!byId.has(finding.id)||finding.sourceDigest!==byId.get(finding.id).sourceDigest||!text(finding.reason)){
   throw new Error('Unknown, stale or incomplete external source finding');
  }
  if(!findings.has(finding.id))findings.set(finding.id,[]);
  findings.get(finding.id).push(exampleDigest(finding));
 }
 const errors=[],seen=new Set(),valid=new Map(),pendingSource=[],pendingUsage=[],counts={};
 for(const decision of decisions){
  const input=byId.get(decision.id);
  if(!input||seen.has(decision.id)){errors.push({id:decision.id,error:'Unknown or duplicate review decision'});continue;}
  seen.add(decision.id);
  const isLegacy=legacy.get(decision.id)===exampleDigest(decision);
  if(decision.sourceDigest!==input.sourceDigest||!accepted.has(decision.verdict)||!text(decision.reason)||
     !text(decision.reviewer)&&!isLegacy){errors.push({id:decision.id,error:'Stale, incomplete or unattributed entry review'});continue;}
  if(decision.sourceIssues!==undefined&&!Array.isArray(decision.sourceIssues)){
   errors.push({id:decision.id,error:'Source issues must remain an explicit list'});continue;
  }
  if(decision.usageIssues!==undefined&&!Array.isArray(decision.usageIssues)){
   errors.push({id:decision.id,error:'Usage issues must remain an explicit list'});continue;
  }
  try{
   const resolved=resolveLanguageEntryDecision(input,decision);
   if(['pass','approved'].includes(decision.verdict)&&resolved.changed)throw new Error('A pass decision changes learner content');
   if(input.coreEntry.additionalExamples?.length&&decision.additionalExamplesReviewed!==true){
    throw new Error('Additional examples also need an explicit review');
   }
   const needsSource=decision.verdict==='needs-source'||!!decision.sourceIssues?.length||findings.has(decision.id);
   valid.set(decision.id,{input,decision,resolved,needsSource,needsUsage:!!decision.usageIssues?.length,isLegacy});
   counts[decision.verdict]=(counts[decision.verdict]||0)+1;
  }catch(error){errors.push({id:decision.id,error:error.message});}
 }
 const approvals=new Map();
 for(const cross of crossReviews){
  if(!valid.has(cross.id)||approvals.has(cross.id)){errors.push({id:cross.id,error:'Unknown or duplicate independent review'});continue;}
  approvals.set(cross.id,cross);
 }
 const approved=[],pendingIndependent=[],finalized=[];
 for(const [id,row] of valid){
  const {input,decision,resolved,needsSource,needsUsage}=row;
  const needsApproval=resolved.changed||needsSource||needsUsage||decision.verdict==='retire';
  let cross=approvals.get(id),invalidCross=false;
  if(cross){
   const reviewer=decision.reviewer||'legacy-'+language+'-first-pass';
   if(cross.decisionDigest!==exampleDigest(decision)||!text(cross.reviewer)||cross.reviewer===reviewer||
      !text(cross.reason)||!['approve','needs-source','reject'].includes(cross.verdict)){
    errors.push({id,error:'Stale, incomplete or non-independent cross-review'});invalidCross=true;cross=undefined;
   }
  }
  const findingBindings=!findings.has(id)||equal([...(cross?.sourceResolution?.findingDigests||[])].sort(),[...findings.get(id)].sort());
  const sourceClosed=(!needsSource&&cross?.verdict!=='needs-source')||
   (cross?.verdict==='approve'&&cross.sourceResolution?.status==='resolved'&&
    text(cross.sourceResolution.reason)&&validUrls(cross.sourceResolution.evidenceUrls)&&findingBindings);
  if(!sourceClosed)pendingSource.push(id);
  const usageClosed=!needsUsage||(cross?.verdict==='approve'&&cross.usageResolution?.status==='resolved'&&
   text(cross.usageResolution.reason));
  if(!usageClosed)pendingUsage.push(id);
  if(invalidCross){pendingIndependent.push(id);continue;}
  if(cross&&cross.verdict!=='approve'){pendingIndependent.push(id);continue;}
  if(needsApproval&&cross?.verdict!=='approve'){pendingIndependent.push(id);continue;}
  if(!sourceClosed||!usageClosed)continue;
  approved.push(id);finalized.push({id,sourceDigest:input.sourceDigest,decisionDigest:exampleDigest(decision),
   verdict:decision.verdict,reviewer:decision.reviewer||'legacy-'+language+'-first-pass',
   changed:resolved.changed,...(cross?{independentReviewer:cross.reviewer}:{}),...resolved});
 }
 const remaining=inputs.filter(row=>!valid.has(row.id)).map(row=>row.id);
 return {finalized,report:{language,expected:inputs.length,reviewed:valid.size,remaining,
  changed:[...valid.values()].filter(row=>row.resolved.changed).length,
  externalSourceFindings:sourceFindings.length,unexaminedSourceFindings:[...findings.keys()].filter(id=>!valid.has(id)),
  independentlyApproved:crossReviews.filter(row=>row.verdict==='approve'&&approved.includes(row.id)).length,
  pendingIndependent,pendingSource,pendingUsage,counts,errors,complete:!remaining.length&&!pendingIndependent.length&&!pendingSource.length&&!pendingUsage.length&&!errors.length}};
}
