import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {loadReviewedEnglishSnapshot,assembleReviewedEnglishEntries} from './content/english-reviewed-entries.mjs';
import {buildEnglishFormIndex} from './content/english-example-focus.mjs';
import {compileReviewedEnglishPractice} from './content/english-reviewed-practice.mjs';
import {rebuildReviewedEnglishReferences} from './content/english-reviewed-references.mjs';
import {auditEnglishSenseExamples} from './content/english-sense-examples.mjs';
import {writePackageRelease} from './content/package-writer.mjs';
import {writeTextAtomic} from './content/atomic-text.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
import {validateExplanation,MAX_PACKAGE_BYTES} from '../web/js/packages/schema.js';
import {ENGLISH_STUDY_POLICY_ID} from './content/english-study-policy.mjs';

const root=new URL('../',import.meta.url),version='7.0.0';
const folder='local-data/coverage/four-language-review/english-sense-plan/';
const stage=new URL('local-data/coverage/reviewed-english-release/',root);
const read=path=>readFile(new URL(path,root),'utf8');
const json=async path=>JSON.parse(await read(path));
const rows=async path=>(await read(path)).split('\n').filter(line=>line.trim()).map(JSON.parse);
const sha=text=>createHash('sha256').update(text).digest('hex');
const {audit,reviews}=await loadReviewedEnglishSnapshot(new URL(folder+'independent-audit.json',root),
 new URL(folder+'independent-effective-finalized.jsonl',root));
const [inputs,baselineCore,baselineEnglish,baselineKorean,bindings,source,sourceClosures,formsText,focusDecisions,gapPracticeApprovals]=await Promise.all([
 Promise.all([1,2,3].map(n=>rows(folder+`independent-${n}-input.jsonl`))).then(parts=>parts.flat()),
 json('language-packages/en-core-6.6.0.json'),json('language-packages/en-en-6.6.0.json'),
 json('language-packages/en-ko-5.3.0.json'),rows(folder+'source-example-attribution-bindings.jsonl'),
 rows('local-data/coverage/four-language-review/en-source-effective-finalized.jsonl'),
 rows(folder+'supplemental-source-finalized.jsonl'),read(folder+'source-forms.jsonl'),rows(folder+'example-focus-decisions.jsonl'),
 rows(folder+'gap-practice-approvals.jsonl'),
]);
if(sha(formsText)!=='a2c2b218394351110e87cece4822fd09760759cfc13e1f559d1bf3e6d2dbd2b8'){
 throw new Error('English source form cache differs from its verified extraction');
}
const invalidConceptIds=[...new Set([
 ...source.filter(row=>['retire-error','retire-unsupported'].includes(row.resolution.disposition)).map(row=>row.id),
 ...sourceClosures.filter(row=>row.closure.verdict==='confirm-exclusion').map(row=>row.id),
])];
const assembled=assembleReviewedEnglishEntries({audit,reviews,inputs,baselineCore,baselineEnglish,baselineKorean,
 attributionBindings:bindings,invalidConceptIds,version});
const overlapAudit=await json(folder+'retained-example-overlap-audit.json');
if(!overlapAudit.complete||overlapAudit.reviewSnapshotSha256!==audit.effectiveReviewSha256||
   overlapAudit.reviewedEntries!==assembled.entries.length){
 throw new Error('Run the retained-example overlap audit against this exact completed snapshot before building');
}
const practice=compileReviewedEnglishPractice({entries:assembled.entries,reviews,
 formIndex:buildEnglishFormIndex(formsText.split('\n').filter(Boolean).map(JSON.parse)),focusDecisions,gapPracticeApprovals});
const references=rebuildReviewedEnglishReferences({baselineCore,baselineEnglish,baselineKorean,
 entries:practice.entries,englishEntries:assembled.englishEntries,koreanEntries:assembled.koreanEntries,reviews,invalidConceptIds});
const license=baseline=>({...baseline.license,notice:[
 `Independently reviewed English sense edition ${version}. Original Lingonberry definitions, examples and Korean translations: CC BY 4.0.`,
 'English Wiktionary definitions and contributor usage examples, and their adaptations/translations: CC BY-SA 4.0; retain the per-record source URLs, creator credits and change notices. Source publication quotations were reviewed as evidence and are not included as unlicensed learner examples.',
 'The learning groups are editorial difficulty bands, not official IELTS, SAT or GRE vocabulary lists. Only useful established senses through GRE-level usage are included. Distinct senses have independent entries, levels, examples and progress identities.',
 'Previous-edition notices below are retained for source attribution; historical coverage figures do not describe this edition.',
 baseline.license.notice,
 ].join('\n\n')});
const omit=(value,names)=>Object.fromEntries(Object.entries(value).filter(([name])=>!names.includes(name)));
const core={...omit(baselineCore,['entries','exercises','families','morphemes','practiceData','contentReview','exerciseReview','retiredEntries','reviewInvalidations']),
 version,license:license(baselineCore),entries:practice.entries,...references.core,
 exercises:[...references.core.exercises,...practice.exercises],retiredEntries:assembled.retiredEntries,
 reviewInvalidations:assembled.reviewInvalidations,
 contentReview:{policyId:ENGLISH_STUDY_POLICY_ID,effectiveReviewSha256:audit.effectiveReviewSha256,
  primaryEntriesReviewed:audit.expected,additionalCandidatesReviewed:audit.supplementalSenseReview.expected,
  originalSourceFindingsResolved:audit.originalSourceResolutions,laterSourceFindingsResolved:audit.supplementalSources.resolved,
  sourceAndSenseReviewComplete:true,perSenseLevels:true,bilingualExamples:practice.entries.length}};
const pair=(baseline,language,entries,refs,exercises)=>({
 ...omit(baseline,['entries','exercises','families','morphemes','studyVersion','version']),version,studyVersion:version,
 explanationLanguage:language,license:license(baseline),entries,...refs,exercises:[...refs.exercises,...exercises],
});
const english=pair(baselineEnglish,'en',assembled.englishEntries,references.english,practice.englishExercises);
const korean=pair(baselineKorean,'ko',assembled.koreanEntries,references.korean,practice.koreanExercises);
const senseAudits={};
for(const explanation of [english,korean]){
 validateExplanation(core,explanation);
 senseAudits[explanation.explanationLanguage]=auditEnglishSenseExamples(assembleStudy(core,explanation));
}
const heads=new Set(core.entries.filter(row=>!['prefix','suffix','root'].includes(row.partOfSpeech))
 .map(row=>row.word.normalize('NFKC').toLowerCase()));
const multiword=[...heads].filter(word=>/\s/u.test(word)),singleword=[...heads].filter(word=>! /\s/u.test(word));
const advanced=new Set(core.entries.filter(row=>row.level==='IELTS 8.5–9.0'&&! /\s/u.test(row.word)&&
 !['prefix','suffix','root'].includes(row.partOfSpeech)).map(row=>row.word.normalize('NFKC').toLowerCase()));
const errors=[];
const packageBytes=Object.fromEntries([core,english,korean].map(pack=>[pack.id,Buffer.byteLength(JSON.stringify(pack)+'\n')]));
for(const [id,bytes] of Object.entries(packageBytes))if(bytes>MAX_PACKAGE_BYTES)errors.push({id,bytes,error:'Package exceeds download byte limit'});
for(const [language,check] of Object.entries(senseAudits)){
 for(const field of ['missingExamples','repeatedExamples','combinedMeanings'])if(check[field].length)errors.push({language,field,records:check[field]});
}
if(singleword.length<20000||multiword.length<=10000||advanced.size<1000)errors.push({error:'Reviewed inventory is below the requested coverage thresholds'});
const report={version,reviewSnapshotSha256:audit.effectiveReviewSha256,entries:core.entries.length,
 englishEntries:english.entries.length,koreanEntries:korean.entries.length,uniqueSinglewordHeads:singleword.length,
 uniqueMultiwordHeads:multiword.length,uniqueAdvancedSinglewordHeads:advanced.size,
 levels:Object.fromEntries([...new Set(core.entries.map(row=>row.level))].map(level=>[level,core.entries.filter(row=>row.level===level).length])),
 packageBytes,senseAudits,exampleOverlap:overlapAudit,practice:practice.report,referenceRebuild:references.report,errors,complete:!errors.length};
await mkdir(stage,{recursive:true});
await writeTextAtomic(new URL('release-report.json',stage),JSON.stringify(report,null,2)+'\n');
await writeTextAtomic(new URL('focus-evidence.jsonl',stage),practice.focusEvidence.map(JSON.stringify).join('\n')+'\n');
console.log(JSON.stringify({...report,practice:{counts:practice.report.counts,structuredGaps:practice.report.structuredGaps,
 unresolved:practice.report.unresolved.length},referenceRebuild:references.report.counts}));
if(errors.length)throw new Error('Reviewed English release still has content errors; see staged report');
if(process.argv.includes('--write')){
 await Promise.all(['language-packages/','web/'].map(path=>mkdir(new URL(path,stage),{recursive:true})));
 await writeTextAtomic(new URL('language-packages/catalog.json',stage),await read('language-packages/catalog.json'));
 await writePackageRelease(stage,core,[english,korean],{compact:true,preserveCompatibleCores:true});
 // The database is an export of this exact reviewed release, never the old generation queue.
 const db=new DatabaseSync(new URL('english-reviewed.sqlite',stage));
 try{
  db.exec('BEGIN; DROP TABLE IF EXISTS entries; DROP TABLE IF EXISTS explanations; DROP TABLE IF EXISTS metadata; CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE entries(id TEXT PRIMARY KEY,word TEXT NOT NULL,part_of_speech TEXT NOT NULL,level TEXT NOT NULL,example TEXT NOT NULL,content_json TEXT NOT NULL); CREATE TABLE explanations(entry_id TEXT NOT NULL,language TEXT NOT NULL,meaning TEXT NOT NULL,example_translation TEXT NOT NULL,content_json TEXT NOT NULL,PRIMARY KEY(entry_id,language));');
  const insert=db.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?)');
  for(const entry of core.entries)insert.run(entry.id,entry.word,entry.partOfSpeech,entry.level,entry.example.text,JSON.stringify(entry));
  const explain=db.prepare('INSERT INTO explanations VALUES(?,?,?,?,?)');
  for(const pack of [english,korean])for(const entry of pack.entries)explain.run(entry.id,pack.explanationLanguage,entry.meaning,entry.exampleTranslation,JSON.stringify(entry));
  const metadata=db.prepare('INSERT INTO metadata VALUES(?,?)');
  metadata.run('version',version);metadata.run('review_snapshot_sha256',audit.effectiveReviewSha256);
  metadata.run('licence_notices',JSON.stringify([core,english,korean].map(pack=>({id:pack.id,license:pack.license}))));
  db.exec('COMMIT');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('SQLite integrity check failed');
 }finally{db.close();}
 console.log('Staged reviewed English packages and SQLite export. Installed/hosted catalogues are unchanged.');
}
