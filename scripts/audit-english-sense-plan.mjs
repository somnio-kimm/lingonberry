import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {ENGLISH_LEVELS} from '../web/js/shared/english-levels.js';

const root=new URL('../',import.meta.url);
const directory='local-data/coverage/four-language-review/';
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const readRows=async path=>(await readFile(new URL(path,root),'utf8')).split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line));
const normalise=text=>String(text||'').normalize('NFKC').trim().replace(/\s+/gu,' ');
const meaningKey=text=>normalise(text).toLowerCase().replace(/[.!。]+$/u,'');
const keyOf=(word,pos,meaning)=>[normalise(word),pos,meaningKey(meaning)].join('\u0000');
const idOf=key=>'en-sense-'+createHash('sha256').update(key).digest('hex').slice(0,24);

const catalogue=await readJson('language-packages/catalog.json');
const enDescriptor=catalogue.find(row=>row.id==='en-en');
const coreDescriptor=catalogue.find(row=>row.id==='en-core'&&row.version===enDescriptor.studyVersion);
const core=await readJson(coreDescriptor.url.slice(1));
const originals=new Map(core.entries.map(row=>[row.id,row]));
const decisions=await readRows(directory+'english-first-pass.jsonl');
if(decisions.length!==originals.size||new Set(decisions.map(row=>row.id)).size!==originals.size||
   decisions.some(row=>!originals.has(row.id)))throw new Error('The sense plan requires every current English entry exactly once');

const main=decisions.map(row=>{
 const source=originals.get(row.id),decision=row.decision;
 return {
  id:row.id,sourceId:row.id,sourceDigest:decision.sourceDigest,
  word:source.word,partOfSpeech:decision.correctedPartOfSpeech||source.partOfSpeech,
  sourceLevel:source.level,proposedLevel:decision.proposedLevel||null,levelRationale:decision.levelRationale||null,
  meaningEn:decision.correctedEnglishMeaning||decision.englishMeaning,
  meaningKo:decision.meaning||decision.koreanMeaning||null,
  exampleText:decision.exampleText,exampleTranslation:decision.exampleTranslation,
  disposition:decision.verdict==='needs-source'?'awaiting-source-resolution':'first-pass-reviewed',
  ...(decision.focus?{focus:decision.focus}:{}),
 };
});
const known=new Map();
for(const row of main){
 const key=keyOf(row.word,row.partOfSpeech,row.meaningEn);
 if(!known.has(key))known.set(key,[]);
 known.get(key).push(row.id);
}

const raw=decisions.flatMap(row=>(row.decision.additionalSenseCandidates||[]).map(candidate=>({parent:row.id,candidate})));
const sidecar=await readRows('local-data/coverage/english-agent-review/part-2-sense-split-candidates.jsonl');
raw.push(...sidecar.map(candidate=>({parent:candidate.id,candidate:{...candidate,englishMeaning:candidate.sense}})));
const unique=new Map(),invalidCandidates=[];
for(const {parent,candidate} of raw){
 const original=originals.get(parent);
 if(!original)throw new Error('Unknown parent sense '+parent);
 const word=candidate.headword||candidate.word||original.word;
 const pos=candidate.partOfSpeech||original.partOfSpeech;
 const meaning=candidate.englishMeaning;
 const level=candidate.proposedLevel;
 if(!normalise(meaning)||!normalise(candidate.meaning)||!normalise(candidate.exampleText)||
    !normalise(candidate.exampleTranslation)||!ENGLISH_LEVELS.includes(level)||!normalise(candidate.levelRationale)){
  invalidCandidates.push({parent,candidate});
  continue;
 }
 const key=keyOf(word,pos,meaning);
 if(!unique.has(key))unique.set(key,{
  id:idOf(key),sourceIds:[],word,partOfSpeech:pos,meaningEn:meaning,
  meaningKo:candidate.meaning,exampleText:candidate.exampleText,exampleTranslation:candidate.exampleTranslation,
  proposedLevel:level,levelRationale:candidate.levelRationale,
  ...(candidate.focus?{focus:candidate.focus}:{}),
  existingMatches:known.get(key)||[],levelConflicts:[],proposals:[],
 });
 const row=unique.get(key);
 if(!row.sourceIds.includes(parent))row.sourceIds.push(parent);
 if(level!==row.proposedLevel&&!row.levelConflicts.includes(level))row.levelConflicts.push(level);
 row.proposals.push(candidate);
}
const additions=[...unique.values()];
const repeatedExamples=[];
const examples=new Map();
for(const row of [...main,...additions]){
 if(!normalise(row.exampleText))continue;
 const key=[normalise(row.word),meaningKey(row.exampleText)].join('\u0000');
 const previous=examples.get(key);
 if(previous&&meaningKey(previous.meaningEn)!==meaningKey(row.meaningEn))repeatedExamples.push({word:row.word,ids:[previous.id,row.id]});
 else if(!previous)examples.set(key,row);
}
const report={
 baselineEntries:main.length,rawAdditionalSenseProposals:raw.length,exactDistinctProposals:additions.length,
 exactMatchesToExisting:additions.filter(row=>row.existingMatches.length).length,
 conflictingLevelProposals:additions.filter(row=>row.levelConflicts.length).length,
 invalidCandidates,sourceFlags:main.filter(row=>row.disposition==='awaiting-source-resolution').length,
 mainSensesNeedingExplicitLevelReview:main.filter(row=>!ENGLISH_LEVELS.includes(row.proposedLevel)||!row.levelRationale).length,
 repeatedExamples,readyForRelease:false,
 scope:'Preparation and exact-text checks only. Distinct paraphrased senses still require semantic deduplication and independent sense-level review.',
};
await mkdir(new URL(directory+'english-sense-plan/',root),{recursive:true});
for(const [name,data]of [['main',main],['additional',additions]]){
 await writeFile(new URL(directory+'english-sense-plan/'+name+'.jsonl',root),data.map(row=>JSON.stringify(row)).join('\n')+'\n');
}
await writeFile(new URL(directory+'english-sense-plan/report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,invalidCandidates:invalidCandidates.length,repeatedExamples:repeatedExamples.length}));
