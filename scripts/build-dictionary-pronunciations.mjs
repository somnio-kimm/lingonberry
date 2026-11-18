import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePackageRelease} from './content/package-writer.mjs';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const sourcePath='language-packages/sources/dictionary-pronunciations-20261118.json',sourceBytes=await readFile(new URL(sourcePath,root)),source=JSON.parse(sourceBytes),sourceSha256=createHash('sha256').update(sourceBytes).digest('hex');
assert.equal(source.license,'CC-BY-SA-4.0');
const normalisePos=value=>['proper noun','plural noun'].includes(value)?'noun':value;
for(const [language,oldVersion,pairVersions,version]of [['en','7.0.5',['7.0.5','7.0.6'],'7.1.0'],['de','4.0.0',['4.0.0','4.0.0'],'4.1.0']]){
 const core=await read(`language-packages/${language}-core-${oldVersion}.json`),selected=new Map(source.entries.map((row,record)=>({...row,record})).filter(row=>row.language===language).map(row=>[JSON.stringify([row.word,row.partOfSpeech]),row])),snapshot=source.sources.find(row=>row.language===language);let added=0;
 const entries=core.entries.map(row=>{
  const reading=selected.get(JSON.stringify([row.word,normalisePos(row.partOfSpeech)]));if(row.pronunciation||!reading)return row;
  added++;return {...row,pronunciation:reading.pronunciation,pronunciationSource:{record:reading.record}};
 });
 assert.equal(added,source.coverage[language].addedEntryReadings);assert.deepEqual(entries.map(row=>row.id),core.entries.map(row=>row.id));
 for(let i=0;i<entries.length;i++){const {pronunciation,pronunciationSource,...rest}=entries[i],{pronunciation:oldPronunciation,pronunciationSource:oldSource,...oldRest}=core.entries[i];assert.deepEqual(rest,oldRest);if(oldPronunciation)assert.equal(pronunciation,oldPronunciation);}
 const notice=`Lingonberry ${language} ${version}: supplied dictionary pronunciation supplement. ${snapshot.creator}; textual IPA transcriptions and selected adaptations are CC BY-SA4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Changes: ${source.changes} Direct article/history URLs and source snapshot hashes are retained per added reading. Editable selected data, per-record source/history URLs and import policy: https://github.com/somnio-kimm/lingonberry/blob/main/${sourcePath}. Existing meanings, examples, levels, entry IDs and licences are unchanged. No audio is imported and no fluent-speaker certification is claimed.\n\n`;
 const next={...core,version,entries,license:{...core.license,notice:notice+core.license.notice},contentReview:{...core.contentReview,pronunciationSupplement:{sourcePath,sourceSha256,sourceCreator:snapshot.creator,sourceSnapshotSha256:snapshot.sourceSha256,recordReference:'Entry pronunciationSource.record is a zero-based index into the separately licensed source ledger entries array.',addedReadings:added,totalReadings:entries.filter(row=>row.pronunciation).length,policy:'Unambiguous source IPA; exact headword/POS; British English preferred; no generated transcription.'}}};
 const pairs=[];for(const [i,locale]of ['en','ko'].entries()){const pair=await read(`language-packages/${language}-${locale}-${pairVersions[i]}.json`);pairs.push({...pair,version,studyVersion:version});}
 await writePackageRelease(root,next,pairs,{compact:true,preserveCompatibleCores:true});console.log(`${language}: added ${added} supplied readings; ${next.contentReview.pronunciationSupplement.totalReadings}/${entries.length} total. Immutable edition ${version}.`);
}
