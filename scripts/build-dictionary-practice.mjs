import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePackageRelease} from './content/package-writer.mjs';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const language=process.argv[process.argv.indexOf('--language')+1];if(!['ja','en'].includes(language))throw new Error('Choose --language ja or en');
const previous=language==='ja'?'4.1.0':'4.2.0',version=language==='ja'?'4.2.0':'4.3.0';
const core=await read(`language-packages/${language}-core-${previous}.json`),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/${language}-${locale}-${previous}.json`))),expansion=await read(`language-packages/sources/exercises/${language}-expansion.json`),runtime=await read(`local-data/feature-coverage-${language}/runtime-data.json`);
core.version=version;
for(const row of core.exercises||[])if(expansion.existingFormKinds?.[row.id])row.formKind=expansion.existingFormKinds[row.id];
core.exercises.push(...expansion.exercises.map(({instruction,explanation,...row})=>row));
if(expansion.families?.length)core.families.push(...expansion.families.map(({meaning,members,...family})=>({...family,members:members.map(({note,...member})=>member)})));
core.practiceData={version:1};
const sourceFiles=[`language-packages/sources/exercises/${language}-expansion.json`,`local-data/feature-coverage-${language}/runtime-data.json`];
let notice=`\n\nDictionary practice, edition ${version}. Original bilingual contextual exercises: Lingonberry contributors, MIT. Imported lexical metadata: English Wiktionary contributors, CC BY-SA 4.0. Source article URLs accompany the facts; contributor histories are available via each article’s History tab. This release restructures facts for practice and applies explicit reviewed morphology rules. Historical etymologies are not a rule for constructing modern meanings. No publisher exercise bank, quotations or audio are imported.\n${expansion.notice}\nFactual references: ${expansion.references.map(row=>row.url).join(' ')}\n`;
if(language==='ja'){
 const readings=await read('local-data/sources/kanjidic2/readings.json');sourceFiles.push('local-data/sources/kanjidic2/readings.json','language-packages/sources/exercises/ja-reading-policy.json');
 core.practiceData.kanji=readings.entries;core.practiceData.forms=runtime.forms;
 core.readingPractice=await read('language-packages/sources/exercises/ja-reading-policy.json');
 const fixed=core.entries.find(row=>row.id==='ja-lex-3a7a5ef5e419ac07d5cc');if(fixed.pronunciation!=='みくるしい')throw new Error('Unexpected baseline reading');fixed.pronunciation='みぐるしい';fixed.aliases=(fixed.aliases||[]).map(alias=>alias==='みくるしい'?'みぐるしい':alias);fixed.aliases=[...new Set(fixed.aliases)];
 core.reviewInvalidations=(core.reviewInvalidations||[]).filter(row=>row.id!==fixed.id);core.reviewInvalidations.push({id:fixed.id,minimumVersion:version});
 fixed.provenance={...fixed.provenance,readingCorrection:{previous:'みくるしい',reading:'みぐるしい',reason:'Correct the voiced reading of 苦 in 見苦しい.',references:['https://en.wiktionary.org/wiki/見苦しい#Japanese','https://kotobank.jp/word/見苦しい-637457']}};
 notice+=`KANJIDIC2 character readings: James William Breen and the Electronic Dictionary Research and Development Group, CC BY-SA 4.0. Snapshot ${readings.source.created}; SHA-256 ${readings.source.sha256}. The subset contains only literal, ja_on and ja_kun reading fields; dots/hyphens are preserved for explanations and omitted in typed answer comparison. No search codes, nanori, meanings or dictionary indices are imported. Source and update procedure: https://www.edrdg.org/kanjidic/kanjidic2.xml.gz ; documentation https://www.edrdg.org/wiki/KANJIDIC_Project.html ; licence https://www.edrdg.org/edrdg/licence.html . Download a new snapshot and rerun scripts/content/import-kanjidic-practice.py, validate, and release a new immutable package version.\n`;
 core.license.links.push({title:'KANJIDIC2 — EDRDG Project Documentation',url:'https://www.edrdg.org/wiki/KANJIDIC_Project.html'},{title:'EDRDG — Licence and Attribution',url:'https://www.edrdg.org/edrdg/licence.html'});
}else{
 core.practiceData.countability=runtime.countability;
 const roots=await read('local-data/feature-coverage-en/root-references.json');sourceFiles.push('local-data/feature-coverage-en/root-references.json');
 core.practiceData.rootFamilies=roots.families.map(({id,term,language,members})=>({id,term,language,members:members.map(({entryId,references})=>({entryId,references}))}));
}
core.license.notice+=notice;
core.exerciseReview={status:'source-backed-and-curated',coverage:'See sources/exercises/'+language+'-practice-coverage.json. Source-backed forms and character readings are reference transformations; contextual collocations, particles, counters and contrasts remain curated, not exhaustive per entry.',exercises:core.exercises.length};
for(const pair of pairs){pair.version=version;pair.studyVersion=version;pair.license.notice+=notice;const locale=pair.explanationLanguage;
 pair.exercises.push(...expansion.exercises.map(row=>({id:row.id,instruction:row.instruction[locale],explanation:row.explanation[locale]})));
 if(expansion.families?.length)pair.families.push(...expansion.families.map(row=>({id:row.id,meaning:row.meaning[locale],members:row.members.map(member=>({entryId:member.entryId,note:member.note[locale]}))})));
}
const assembled=assembleStudy(core,pairs[0]),words=studyWords(assembled),prepared=prepareLanguageExercises(assembled,words),counts={};
for(const row of prepared)counts[row.category]=(counts[row.category]||0)+1;
const covered=new Map();for(const row of prepared){const types=covered.get(row.entryId)||new Set();types.add(row.category);covered.set(row.entryId,types);}
const countAudit=new Map((runtime.coverage?.entries||[]).map(row=>[row.entryId,row.countability]));
const rootMembers=new Set((core.practiceData.rootFamilies||[]).flatMap(row=>row.members.map(member=>member.entryId)));
const featureStatus=row=>{
 const types=covered.get(row.id)||new Set(),hasKanji=/\p{Script=Han}/u.test(row.word),result={};
 if(language==='ja'){
  result.reading=types.has('reading')?'supported':hasKanji?'needs-verified-data':'not-applicable';
  for(const name of ['onyomi','kunyomi'])result[name]=types.has(name)?'supported':hasKanji?'no-listed-reading':'not-applicable';
  result.okurigana=types.has('okurigana')?'supported':hasKanji&&/[ぁ-ゖ]/u.test(row.word)?'needs-verified-segmentation':'not-applicable';
  result.forms=types.has('forms')?'supported-with-lexical-gates':['verb','adjective'].includes(row.partOfSpeech)?'needs-verified-data':'not-applicable';
  for(const name of ['particles','counters','kanji','transitivity'])result[name]=types.has(name)?'curated-contexts':name==='transitivity'&&row.partOfSpeech!=='verb'?'not-applicable':'needs-curated-context';
 }else{
  const audit=countAudit.get(row.id);result.countability={status:audit?.status||'needs-verified-data',scope:audit?.scope,reason:audit?.reasonCode};
  result.rootReferences=rootMembers.has(row.id)?'source-backed-reference':'needs-verified-relation';
  for(const name of ['collocations','phrasal','patterns','confusables','roots'])result[name]=types.has(name)?'curated-contexts':['phrasal','patterns'].includes(name)&&row.partOfSpeech!=='verb'?'not-applicable':'needs-curated-context';
 }
 return result;
};
const ledger={version:1,targetLanguage:language,studyVersion:version,entryCount:core.entries.length,exerciseCount:prepared.length,categoryCounts:counts,sourceInputs:await Promise.all(sourceFiles.map(async path=>({path,sha256:createHash('sha256').update(await readFile(new URL(path,root))).digest('hex')}))),scope:core.exerciseReview.coverage,entries:core.entries.map(row=>({entryId:row.id,level:row.level,categories:[...(covered.get(row.id)||[])],defaultVocabularyPractice:true,features:featureStatus(row)}))};
await writePackageRelease(root,core,pairs);
await writeFile(new URL(`language-packages/sources/exercises/${language}-practice-coverage.json`,root),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({language,version,entries:core.entries.length,questions:prepared.length,counts}));
