/** Assemble typed, provenance-bound candidates from a read-only queue export.
 * Field reviews are evidence only. This module NEVER supplies record.review.
 * CLI: node scripts/content/materialize-gpu-content.mjs envelopes.jsonl
 * Writes one result per input envelope to stdout; no database or package writes.
 */
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STUDY_LANGUAGES,allowsExplanation,explanationMatrix} from '../../web/js/shared/language-pairs.js';
import {findSentenceFocus} from '../../web/js/shared/lexicon-sentences.js';
import {contentDigest} from './complete-matrix.mjs';

const licences=new Set(['MIT','CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0','CC-BY-SA-2.0-KR','CC-BY-2.0-FR']);
const tasks=new Set(['native_example','meaning','example_translation']);
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
const clone=value=>JSON.parse(JSON.stringify(value));
const textOf=value=>typeof value==='string'?value:value?.text;
const outputText=output=>output?.text??output?.meaning??output?.translation;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

/** Match Python queue encoded(): sorted object keys, compact UTF-8 JSON. */
export function queueContentDigest(value){
 function serialise(item){
  if(Array.isArray(item))return '['+item.map(serialise).join(',')+']';
  if(object(item))return '{'+Object.keys(item).sort().map(key=>JSON.stringify(key)+':'+serialise(item[key])).join(',')+'}';
  if(item===undefined||typeof item==='number'&&!Number.isFinite(item))throw new Error('Non-JSON value in exported queue envelope');
  return JSON.stringify(item);
 }
 return createHash('sha256').update(serialise(value)).digest('hex');
}

const legacyCredit={
 zh:{packageUrl:'/language-packages/zh-core-2.0.0.json',noticeSha256:'a4b69d78a332cb10511e19db01b1299e23924fabfe7b2bc8c3a3787cfdea0a99',originalCredit:'learn_chinese contributors'},
 de:{packageUrl:'/language-packages/de-core-3.0.0.json',noticeSha256:'c190c9cb397527cd31d3fcbcfd83da4bdc5cdd42722a7ab5f02cc399f4200efb',originalCredit:'Learn Language contributors'},
 original:{policyDocument:'docs/example-authoring.md',copyrightDocument:'LICENSE',originalCredit:'Kimm Soo Min / Learn Language contributors'},
};
const shaText=value=>createHash('sha256').update(value).digest('hex');
function boundDigest(value,raw){
 if(raw===undefined)return queueContentDigest(value);
 if(typeof raw!=='string'||queueContentDigest(JSON.parse(raw))!==queueContentDigest(value))throw new Error('Raw exported JSON differs from parsed queue data');
 return shaText(raw);
}
function sourceProvenance(raw,locale){
 if(!object(raw))return null;
 let p=clone(raw);
 if(p.kind==='tatoeba'){
  if(!licences.has(p.license))return null;
  const source=(language)=>{
   const item=p[language==='en'?'english':'chinese'];
   return item&&Number.isSafeInteger(item.id)&&item.id>0&&nonempty(item.author)?{kind:language==='en'?'licensed-source':'licensed-adaptation',creator:item.author,license:p.license,url:'https://tatoeba.org/en/sentences/show/'+item.id}:null;
  };
  if(locale==='ko'){
   const base=source('zh'),credit=p.koreanTranslation;
   return base&&credit&&nonempty(credit.creator)&&licences.has(credit.license)?{kind:'licensed-adaptation',creator:credit.creator,license:credit.license,url:base.url,sources:[base],originalSource:p}:null;
  }
  const base=source(locale==='en'?'en':'zh');return base?{...base,originalSource:p}:null;
 }

 // These are existing host-owned source wrappers, never model output fields.
 if(object(p.editorial)&&!p.license)p=clone(p.editorial);
 if(object(p.attribution)&&!p.license)p=clone(p.attribution);
 if(object(p.source)&&!p.license)p=clone(p.source);
 if(!p.kind&&p.url&&p.creator&&p.license)p={...p,kind:'licensed-source'};
 if(['app-authored','app-editorial'].includes(p.kind)&&licences.has(p.license)){
  const oldKind=p.kind,needsMigration=oldKind==='app-editorial'||!nonempty(p.creator);
  const policy=/learn_chinese/.test(p.changes||'')?legacyCredit.zh:oldKind==='app-editorial'?legacyCredit.de:legacyCredit.original;
  if(needsMigration)p={...p,kind:'app-authored',creator:p.creator||'Learn Language contributors',attributionMigration:{policy:'verified-app-original-credit-v1',originalKind:oldKind,...policy}};
 }

 if(!licences.has(p.license)||!nonempty(p.creator))return null;
 if(p.kind==='app-authored')return p;
 if(!['licensed-source','licensed-adaptation'].includes(p.kind))return null;
 try{const u=new URL(p.url);if(u.protocol!=='https:'||u.username||u.password)return null;}catch{return null;}
 if(p.sources!==undefined){
  if(!Array.isArray(p.sources)||!p.sources.length)return null;
  for(const source of p.sources){
   try{const u=new URL(source.url);if(!nonempty(source.creator||source.author)||!licences.has(source.license)||u.protocol!=='https:'||u.username||u.password)return null;}catch{return null;}
  }
 }
 return p;
}
function adaptation(base,producer){
 if(!base)return null;
 const license=base.license.startsWith('CC-BY-SA-')?'CC-BY-SA-4.0':base.license;
 const metadata={method:'AI-assisted-adaptation',...(producer.model?{model:producer.model}:{}),...(producer.revision?{modelRevision:producer.revision}:{})};
 if(base.kind==='app-authored')return {kind:'app-authored',creator:base.creator,license,...metadata,derivedFrom:clone(base)};
 return {kind:'licensed-adaptation',creator:'Learn Language contributors; '+base.creator,license,url:base.url,
  ...metadata,sources:[clone(base)]};
}
function sourceForMeaning(evidence,entry,locale,text){
 const supplied=evidence.meanings?.[locale]?.provenance;
 const primary=sourceProvenance(supplied);
 if(primary)return primary;
 const authored=evidence.authored||{},correction=evidence.correction||{};
 const correctedText=correction.meanings?.[locale]??correction[locale==='en'?'meaningEn':locale==='ko'?'meaningKo':''];
 if(supplied?.kind==='editorial-sense-correction'&&licences.has(supplied.license)&&text===correctedText){
  const base=sourceProvenance(entry.provenance?.source),adapted=adaptation(base,{});
  if(adapted&&adapted.license===supplied.license)return {...adapted,attributionBasis:'trusted-entry-source-and-explicit-editorial-correction',...(correction.verificationSources?{verificationSources:clone(correction.verificationSources)}:{})};
 }
 if(supplied?.license||supplied?.url||supplied?.sources||supplied?.source?.license)return null;
 if(text===authored.meanings?.[locale]){const p=sourceProvenance(authored.meaningProvenance?.[locale]);if(p)return p;}
 const corrected=correction.meanings?.[locale]??correction[locale==='en'?'meaningEn':locale==='ko'?'meaningKo':''];
 if(text===corrected){const p=sourceProvenance(correction.meaningProvenance?.[locale]);if(p)return p;}
 // A trusted app-authored lexical entry also attributes its original starter meanings.
 if(entry.provenance?.kind==='app-authored')return sourceProvenance(entry.provenance);
 if(entry.grammar?.source==='app-editorial')return sourceProvenance(entry.grammar.provenance);
 if(entry.grammar?.definitionSource==='app-editorial'&&evidence.meanings?.[locale]?.provenance?.definitionSource==='app-editorial')return {kind:'app-authored',creator:'Learn Language contributors',license:'CC-BY-SA-4.0',attributionMigration:{policy:'verified-app-original-credit-v1',originalKind:'app-editorial',...legacyCredit.zh}};
 if(evidence.meanings?.[locale]?.origin==='installed-edition'&&(!evidence.correction||!Object.keys(evidence.correction).length)){const p=adaptation(sourceProvenance(entry.provenance?.source),{});if(p)return {...p,attributionBasis:'installed-explanation-associated-entry-source'};}
 return null;
}
function translationProvenance(evidence,example,index,locale,text,nativeProvenance){
 const typed=example.translations?.[locale];
 const originalSource=example.provenance??example.source;
 if(object(typed)&&typed.provenance)return sourceProvenance(typed.provenance);
 if(originalSource?.kind==='tatoeba'&&['en','ko'].includes(locale))return sourceProvenance(originalSource,locale);
 const authored=evidence.authored;
 if(authored&&example.text===authored.text){
  const recordText=authored.translations?.[locale]??authored[locale];
  if(recordText===text){
   const specific=authored.translationProvenance?.[locale];
   const p=sourceProvenance(specific)||sourceProvenance(authored.translationProvenance);
   if(p)return p;
   // Older sidecars explicitly attribute original examples and translations together.
   // A source-derived translation retains the original source's licence/attribution.
   return nativeProvenance?{...clone(nativeProvenance),attributionBasis:'authored-example-and-translation-bundle'}:null;
  }
 }
 const installed=evidence.installed?.[locale];
 const installedText=index===0?installed?.exampleTranslation:installed?.additionalExampleTranslations?.[index-1];
 if(installedText===text){
  const raw=index===0?installed?.exampleTranslationProvenance:installed?.additionalTranslationProvenance?.[index-1];
  if(raw)return sourceProvenance(raw);
  if(nativeProvenance&&originalSource?.kind!=='tatoeba')return {...clone(nativeProvenance),attributionBasis:'installed-example-and-translation-bundle'};
 }
 return null;
}

/** Evidence must be the unchanged entry envelope exported by prepare-gpu-jobs.py.
 * checkedResults contains dataclasses.asdict(job), output, output_digest,
 * producer, review (with contentDigest), and reviewer. Missing or stale fields
 * return blocked reasons; no partial candidate is passed off as a complete row.
 */
export function assembleGpuEntry({entry,evidence,checkedResults=[],studyLanguage,entryJson,evidenceJson,entryDigest:exportedEntryDigest}={}){
 const blocked=[],fieldOrigins=[];
 const block=(code,field,message,extra={})=>blocked.push({code,field,message,...extra});
 const result=()=>({entryId:entry?.id,studyLanguage,blocked,fieldOrigins,linguisticApproval:false,
  reviewStatus:'needs-assembled-review',requiredExplanationPairs:explanationMatrix().length});
 if(!STUDY_LANGUAGES.includes(studyLanguage))block('unknown_study_language','studyLanguage','A supported study language is required.');
 if(!object(entry)||!nonempty(entry.id)||!nonempty(entry.word)||!nonempty(entry.partOfSpeech))block('invalid_entry','entry','Stable ID, headword and part of speech are required.');
 if(!object(evidence))block('invalid_evidence','evidence','Source evidence is required.');
 if(!Array.isArray(checkedResults))block('invalid_results','checkedResults','Checked results must be an array.');
 if(blocked.length)return result();
 let entryDigest;
 try{
  if(entryJson!==undefined||evidenceJson!==undefined){
   boundDigest(entry,entryJson);boundDigest(evidence,evidenceJson);
   if(typeof entryJson!=='string'||typeof evidenceJson!=='string')throw new Error('Both canonical entryJson and evidenceJson are required');
   entryDigest=shaText('{"entry":'+entryJson+',"evidence":'+evidenceJson+'}');
  }else entryDigest=queueContentDigest({entry,evidence});
  if(exportedEntryDigest&&exportedEntryDigest!==entryDigest)throw new Error('Exported entryDigest differs from its bound entry/evidence');
 }catch(error){block('non_json_envelope','entry',error.message);return result();}
 if(evidence.original?.id&&evidence.original.id!==entry.id)block('source_id_mismatch','evidence.original.id','Original source entry ID differs.');
 if(evidence.correction?.id&&evidence.correction.id!==entry.id)block('correction_id_mismatch','evidence.correction.id','Correction belongs to another entry.');
 for(const field of ['word','partOfSpeech','article','level','pronunciation','aliases']){
  if(evidence.correction?.[field]!==undefined&&JSON.stringify(entry[field])!==JSON.stringify(evidence.correction[field]))block('unapplied_correction','entry.'+field,'Trusted correction was not applied to the entry.');
 }
 const locales=STUDY_LANGUAGES.filter(l=>allowsExplanation(studyLanguage,l)),byJob=new Map(),byField=new Map();
 for(const item of checkedResults){
  const job=item?.job,payload=job?.payload,field='checkedResults.job['+job?.id+']';
  if(!object(job)||!Number.isInteger(job.id)||!object(payload)||!object(item.output)){block('invalid_checked_result',field,'Expected an exported checked job and output.');continue;}
  if(byJob.has(job.id)){block('duplicate_job',field,'Duplicate job ID.');continue;}
  byJob.set(job.id,item);
  if(job.status!=='checked'||!tasks.has(job.task))block('unchecked_job',field,'Only current checked field jobs are eligible.');
  if(job.study_language!==studyLanguage||job.entry_id!==entry.id||payload.studyLanguage!==studyLanguage||payload.entryId!==entry.id)block('job_identity_mismatch',field,'Checked job belongs to another entry or study language.');
  if(payload.task!==job.task||payload.target_language!==job.locale||payload.example_index!==job.example_index)block('job_payload_mismatch',field,'Job descriptor and payload disagree.');
  if(payload.entry_digest!==entryDigest)block('stale_entry_digest',field,'Job was generated from different lexical or source evidence.');
  try{
   if(job.input_hash!==boundDigest(payload,item.payloadJson))block('input_digest_mismatch',field,'Job payload changed after generation.');
   if(item.output_digest!==boundDigest(item.output,item.outputJson))block('output_digest_mismatch',field,'Candidate output changed after review.');
  }catch(error){block('non_json_job',field,error.message);}
  if(item.review?.contentDigest!==item.output_digest||item.review?.review?.verdict!=='pass'||!Array.isArray(item.review?.review?.issues)||item.review.review.issues.length||item.review.review.repair)block('invalid_field_review',field,'A current passing field review without unresolved issues is required.');
  const sourceImport=item.producer?.method==='licensed-source-import';
  const expectedMethods=sourceImport?['source-candidate-AI-review','licensed-source-AI-review']:[item.producer?.model===item.reviewer?.model?'same-model-AI-review':'separate-model-AI-review'];
  if(item.review?.nativeSpeakerReview!=='pending'||!expectedMethods.includes(item.review?.method))block('invalid_review_claim',field,'Field review must honestly identify source/model review and pending native review.');
  if(item.producer?.role!=='local-draft'||item.reviewer?.role!=='local-review'||(!sourceImport&&!nonempty(item.producer?.model))||!nonempty(item.producer?.revision)||!nonempty(item.reviewer?.model)||!nonempty(item.reviewer?.revision))block('invalid_producer_binding',field,'Host-owned draft and reviewer identities are required.');
  if(sourceImport){
   const bound=payload.licensed_source_candidate,candidate=bound??evidence.meaningCandidates?.[job.locale];
   const expectedProvenance=candidate?.provenance?{...candidate.provenance,kind:bound?(candidate.provenance.kind??'licensed-source'):'licensed-source'}:null;
   const bindingValid=bound?payload.licensed_source_candidate_digest===queueContentDigest(bound)&&item.producer.candidate_digest===queueContentDigest(bound)&&Number.isInteger(payload.source_import_of_job_id):job.task==='meaning'&&payload.source_digest===candidate?.source_digest;
   const nativeValid=job.task!=='native_example'||(object(bound?.focus)&&queueContentDigest(item.output.focus??null)===queueContentDigest(bound.focus)&&item.output.pinyin===bound.pinyin);
   const translationValid=job.task!=='example_translation'||(object(payload.source_example)&&bound?.source_text===payload.text&&bound?.source_example_digest===queueContentDigest(payload.source_example)&&bound.source_example_digest===payload.source_digest);
   if(!bindingValid||!nativeValid||!translationValid||item.producer.model!==null||payload.source_import_allowed===false||payload.revision_request||!candidate||!sourceProvenance(expectedProvenance)||!(/^[a-f0-9]{64}$/i.test(candidate.source_snapshot_sha256||''))||(bound&&!(/^[a-f0-9]{64}$/.test(candidate.source_digest||'')))||item.producer.revision!==candidate.source_snapshot_sha256||item.producer.source_digest!==candidate.source_digest||outputText(item.output)!==candidate.text||queueContentDigest(item.output.provenance??null)!==queueContentDigest(expectedProvenance))block('unverified_source_import',field,'Non-model imports require exact licensed candidate text/attribution and bound source/snapshot digests.');
  }
  if(item.output.id!==undefined&&item.output.id!==entry.id)block('output_id_mismatch',field,'Generated output changed the stable entry ID.');
  if(item.output.entryId!==undefined&&item.output.entryId!==entry.id)block('output_id_mismatch',field,'Generated output changed the stable entry ID.');
  if((item.output.uncertainties!==undefined&&(!Array.isArray(item.output.uncertainties)||item.output.uncertainties.length))||(item.output.lexicalCorrections!==undefined&&(!object(item.output.lexicalCorrections)||Object.keys(item.output.lexicalCorrections).length)))block('unresolved_author_change',field,'Author uncertainty or lexical correction needs agent resolution and a new source snapshot.');
  const expectedLocale=job.task==='native_example'?job.locale===studyLanguage:locales.includes(job.locale)&&!(job.task==='example_translation'&&job.locale===studyLanguage);
  if(!expectedLocale)block('disallowed_pair',field,'This field violates the 43-pair policy.');
  if(!Number.isInteger(job.example_index)||(job.task==='meaning'?job.example_index!==-1:job.example_index<0))block('invalid_example_index',field,'Meaning slots are -1; example slots are nonnegative integers.');
  const key=job.task+':'+job.locale+':'+job.example_index;
  if(byField.has(key))block('duplicate_checked_field',field,'Multiple checked jobs address the same field.');
  byField.set(key,item);
  if(!nonempty(outputText(item.output)))block('empty_output',field,'Checked output still needs non-empty text.');
 }
 if(blocked.length)return {...result(),entryDigest};
 // Recheck the exported dependency chain rather than trusting a status label alone.
 for(const item of byJob.values()){
  const {job}=item,p=job.payload,ids=p.dependency_job_ids;
  if(!Array.isArray(ids)||ids.some(id=>!Number.isInteger(id))){block('invalid_dependencies','job.'+job.id,'Dependency IDs are required.');continue;}
  for(const id of ids)if(!byJob.has(id)||byJob.get(id).job.status!=='checked')block('unchecked_dependency','job.'+job.id,'A checked dependency is missing from the snapshot.',{dependencyJobId:id});
  if(job.task==='native_example'&&p.source_digest!==entryDigest)block('native_source_changed','job.'+job.id,'Original-example job source digest differs from its entry snapshot.');
  if(job.task==='meaning'){
   const candidate=evidence.meaningCandidates?.[job.locale];
   if(p.source_digest!==entryDigest&&p.source_digest!==candidate?.source_digest)block('meaning_source_changed','job.'+job.id,'Meaning source digest is not the entry or its licensed candidate.');
   if(p.candidate&&queueContentDigest(p.candidate)!==queueContentDigest(candidate??null))block('meaning_candidate_changed','job.'+job.id,'Licensed meaning candidate changed.');
  }
  if(job.task==='example_translation'){
   let sourceDigest;try{sourceDigest=boundDigest(p.source_example,item.sourceExampleJson);}catch(error){block('invalid_source_json','job.'+job.id,error.message);}
   if(!object(p.source_example)||p.source_digest!==sourceDigest||p.text!==p.source_example.text)block('translation_source_changed','job.'+job.id,'Exact native sentence and source-example digest are required.');
   if(p.source_job_id!==null&&p.source_job_id!==undefined){
    const parent=byJob.get(p.source_job_id);
    if(!ids.includes(p.source_job_id)||parent?.job.task!=='native_example'||parent?.job.example_index!==job.example_index||queueContentDigest(parent?.output??null)!==queueContentDigest(p.source_example))block('native_dependency_changed','job.'+job.id,'Translation is not bound to the current checked native draft.');
   }else if(queueContentDigest(evidence.examples?.[job.example_index]??null)!==queueContentDigest(p.source_example))block('installed_example_changed','job.'+job.id,'Translation source differs from the original example snapshot.');
  }
 }
 if(blocked.length)return {...result(),entryDigest};
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id)){block('dependency_cycle','job.'+id,'Dependency graph contains a cycle.');return;}if(visited.has(id))return;visiting.add(id);for(const parent of byJob.get(id)?.job.payload.dependency_job_ids||[])if(byJob.has(parent))visit(parent);visiting.delete(id);visited.add(id);}
 for(const id of byJob.keys())visit(id);
 if(blocked.length)return {...result(),entryDigest};
 const record={id:entry.id,authoringAgent:'existing-content-and-local-draft-authors',lexical:clone(entry),meanings:{},examples:[]};
 const usedJobs=new Set();
 function provenance(raw,field){const p=sourceProvenance(raw);if(!p)block('missing_valid_attribution',field,'A supported licence, creator and applicable source URL must come from trusted evidence.');return p;}
 function generatedMeaning(item,locale){
  if(item.producer.method==='licensed-source-import'&&item.job.payload.licensed_source_candidate)return {text:outputText(item.output),provenance:sourceProvenance(item.job.payload.licensed_source_candidate.provenance)};
  const value=outputText(item.output),candidate=item.job.payload.licensed_source_candidate??evidence.meaningCandidates?.[locale];
  let base=candidate?sourceProvenance(candidate.provenance):null;
  if(candidate&&!base){block('missing_valid_attribution','meanings.'+locale,'Licensed candidate attribution cannot be replaced by unrelated entry credits.');return null;}
  if(candidate?.text===value&&base)return {text:value,provenance:base};
  if(!base){
   for(const l of ['en','ko',...locales]){const known=evidence.meanings?.[l];if(known){base=sourceForMeaning(evidence,entry,l,known.text);if(base)break;}}
  }
  if(!base)base=sourceProvenance(entry.provenance)||sourceProvenance(entry.provenance?.source)||sourceProvenance(entry.grammar?.provenance);
  const p=adaptation(base,item.producer);
  if(!p)block('unbound_generated_meaning','meanings.'+locale,'Generated definition lacks a trusted source/authoring attribution.');
  return p?{text:value,provenance:p}:null;
 }
 for(const locale of locales){
  const known=evidence.meanings?.[locale],item=byField.get('meaning:'+locale+':-1');
  if(nonempty(textOf(known))){
   if(item){block('existing_meaning_collision','meanings.'+locale,'A generated field cannot silently replace an existing accepted meaning.');continue;}
   const p=sourceForMeaning(evidence,entry,locale,textOf(known));
   if(p)record.meanings[locale]={text:textOf(known),provenance:p};else block('missing_valid_attribution','meanings.'+locale,'Existing definition has no matching trusted attribution.');
   fieldOrigins.push({field:'meanings.'+locale,origin:'existing-evidence'});
  }else if(item){
   const value=generatedMeaning(item,locale);if(value)record.meanings[locale]=value;usedJobs.add(item.job.id);
   fieldOrigins.push({field:'meanings.'+locale,origin:'checked-field-draft',jobId:item.job.id,outputDigest:item.output_digest});
  }else block('missing_meaning','meanings.'+locale,'No existing definition or checked current draft.');
 }
 const examples=Array.isArray(evidence.examples)?evidence.examples:[];
 const nativeJobs=[...byJob.values()].filter(item=>item.job.task==='native_example');
 const slots=new Set(examples.map((_,i)=>i));for(const item of nativeJobs)slots.add(item.job.example_index);
 if(slots.size>50)block('too_many_examples','examples','The package schema allows at most fifty examples.');
 if(!slots.size)block('missing_native_example','examples','At least one native example is required.');
 const ordered=[...slots].sort((a,b)=>a-b);
 if(ordered.some((index,i)=>index!==i))block('non_contiguous_examples','examples','Example slots must be contiguous starting at zero.');
 for(const index of ordered){
  const existing=examples[index],item=byField.get('native_example:'+studyLanguage+':'+index),field='examples['+index+']';
  if(existing&&item){block('existing_example_collision',field,'A new native draft cannot silently replace an existing example.');continue;}
  const original=existing??item?.output;
  if(!nonempty(original?.text)){block('missing_native_example',field,'Native example is missing.');continue;}
  let nativeProvenance;
  if(existing){
   const supplied=existing.provenance??existing.source;
   nativeProvenance=object(supplied)&&Object.keys(supplied).length?sourceProvenance(supplied,studyLanguage):sourceProvenance(entry.provenance)||sourceProvenance(entry.grammar?.provenance);
  }
  else{
   const matched=(evidence.original?.referenceExamples||[]).find(x=>x.text===original.text);
   const imported=item.producer.method==='licensed-source-import'&&item.job.payload.licensed_source_candidate;
   nativeProvenance=imported?sourceProvenance(imported.provenance):item.job.payload.licensed_source_candidate?adaptation(sourceProvenance(item.job.payload.licensed_source_candidate.provenance),item.producer):matched?sourceProvenance(matched.provenance??matched.source):{kind:'app-authored',creator:'Learn Language contributors',license:'CC-BY-4.0',method:'AI-assisted-original-example',model:item.producer.model,modelRevision:item.producer.revision};
   usedJobs.add(item.job.id);
  }
  if(!nativeProvenance)block('missing_valid_attribution',field+'.provenance','Native example attribution is incomplete.');
  let focus;
  try{focus=findSentenceFocus({lemma:entry.word},original,studyLanguage);}catch{}
  if(!focus)block('unresolved_focus',field+'.focus','No unambiguous exact target surface; preserve the source and request focus repair.');
  const example={text:original.text,focus,provenance:nativeProvenance,translations:{}};
  if(original.pinyin)example.pinyin=original.pinyin;
  if(existing?.pronunciation)example.pronunciation=existing.pronunciation;
  fieldOrigins.push({field,origin:existing?'existing-evidence':'checked-native-draft',...(item?{jobId:item.job.id,outputDigest:item.output_digest}:{})});
  for(const locale of locales){
   const path=field+'.translations.'+locale,translation=byField.get('example_translation:'+locale+':'+index);
   const known=textOf(existing?.translations?.[locale]);
   if(locale===studyLanguage){
    if(nonempty(known)&&known!==original.text)block('native_self_pair_changed',path,'English self-pair must equal the native sentence.');
    if(nativeProvenance)example.translations[locale]={text:original.text,provenance:clone(nativeProvenance)};
   }else if(nonempty(known)){
    if(translation){block('existing_translation_collision',path,'A generated translation cannot silently overwrite an existing translation.');continue;}
    const p=translationProvenance(evidence,existing,index,locale,known,nativeProvenance);
    if(p)example.translations[locale]={text:known,provenance:p};else block('missing_valid_attribution',path,'Existing translation lacks matching trusted attribution.');
   }else if(translation){
    const imported=translation.producer.method==='licensed-source-import'&&translation.job.payload.licensed_source_candidate;
    let p=imported?sourceProvenance(imported.provenance):adaptation(nativeProvenance,translation.producer);
    if(imported&&p&&nativeProvenance?.license?.startsWith('CC-BY-SA-')&&!p.license.startsWith('CC-BY-SA-'))p={...p,kind:'licensed-adaptation',license:'CC-BY-SA-4.0',method:'licensed-source-translation',sources:[clone(nativeProvenance),clone(p)]};
    if(p)example.translations[locale]={text:outputText(translation.output),provenance:p};else block('unbound_generated_translation',path,'Translation lacks native-source attribution.');
    usedJobs.add(translation.job.id);fieldOrigins.push({field:path,origin:'checked-field-draft',jobId:translation.job.id,outputDigest:translation.output_digest});
   }else block('missing_translation',path,'No existing translation or checked current draft.');
  }
  record.examples.push(example);
 }
 for(const item of byJob.values())if(!usedJobs.has(item.job.id))block('unused_checked_field','job.'+item.job.id,'Checked job does not address a required materialised field.');
 const placeholders=/^(?:TODO|TBD|translation pending|translation under review|example pending|번역 예정|번역 검토 중|예문 준비 중|翻訳待ち|翻訳未定|待翻译|翻译待审核)[.!。]?$/iu;
 const modelTokens=/<\|[^<>]+\|>|<\/?(?:think|analysis|final)>|<(?:end_of_turn|start_of_turn|eos|bos|pad|\/s|s)>|\[\/?INST\]/iu;
 const scripts={ja:/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,ko:/\p{Script=Hangul}/u,zh:/\p{Script=Han}/u};
 function fieldText(value,locale,path){if(typeof value==='string'&&modelTokens.test(value))block('model_token_leakage',path,'Visible model control tokens are not learner content.');if(!nonempty(value)||value.length>4000||placeholders.test(value.trim()))block('invalid_text',path,'Text is empty, too long or a placeholder.');else if(scripts[locale]&&!scripts[locale].test(value))block('missing_language_script',path,'Required language script is absent.');}
 for(const [locale,value]of Object.entries(record.meanings))fieldText(value.text,locale,'meanings.'+locale);
 const nativeTexts=new Set();
 for(const [i,example]of record.examples.entries()){
  fieldText(example.text,studyLanguage,'examples['+i+'].text');
  if(nativeTexts.has(example.text.normalize('NFC').trim()))block('duplicate_native_example','examples['+i+']','Duplicate native sentence within entry.');
  nativeTexts.add(example.text.normalize('NFC').trim());
  for(const [locale,value]of Object.entries(example.translations))fieldText(value.text,locale,'examples['+i+'].translations.'+locale);
 }
 // Do not permit an apparently complete record with malformed attribution anywhere.
 for(const [locale,value] of Object.entries(record.meanings))provenance(value.provenance,'meanings.'+locale+'.provenance');
 for(const [i,example]of record.examples.entries())for(const [locale,value]of Object.entries(example.translations))provenance(value.provenance,'examples['+i+'].translations.'+locale+'.provenance');
 if(blocked.length)return {...result(),entryDigest};
 return {...result(),entryDigest,record,candidateDigest:contentDigest(record)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw new Error('Usage: node scripts/content/materialize-gpu-content.mjs ENVELOPES.jsonl');
 const lines=createInterface({input:createReadStream(resolve(process.argv[2]),{encoding:'utf8'}),crlfDelay:Infinity});
 for await(const line of lines){if(line.trim())process.stdout.write(JSON.stringify(assembleGpuEntry(JSON.parse(line)))+'\n');}
}
