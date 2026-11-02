import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {prepareConciseChanges,compileConcisePair} from './content/concise-translations.mjs';
import {writePackageRelease} from './content/package-writer.mjs';
const root=new URL('../',import.meta.url),base='language-packages/sources/concise-translations/';
const read=path=>readFile(new URL(path,root)),json=async path=>JSON.parse(await read(path)),rows=async path=>(await read(path)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
export async function buildConciseTranslations({dryRun=false}={}){
 const release=await json(base+'release.json');
 for(const source of [...release.inputs,...release.sourceSnapshots])if(createHash('sha256').update(await read(source.path)).digest('hex')!==source.sha256)throw new Error('Changed concise-translation source '+source.path);
 const originals=await Promise.all(release.inputs.map(source=>json(source.path))),nikl=new Map((await rows(base+'nikl-equivalents.jsonl')).map(row=>[row.id+':'+row.sense,row])),editorial=await rows(base+'ja-editorial.jsonl');
 const built=[],ledger=[],counts=[];
 for(const [id,version]of Object.entries(release.outputs)){
  const pair=originals.find(row=>row.id===id),core=originals.find(row=>row.kind==='study'&&row.targetLanguage===pair.targetLanguage);
  const changes=prepareConciseChanges(core,pair,nikl,pair.targetLanguage==='ja'?editorial:[]),updated=compileConcisePair(core,pair,changes,version);
  built.push({core,pair:updated});ledger.push(...changes.map(row=>({packageId:id,...row})));
  counts.push({id,from:pair.version,to:version,studyVersion:core.version,entries:pair.entries.length,changed:changes.length,methods:Object.fromEntries([...new Set(changes.map(row=>row.method))].map(method=>[method,changes.filter(row=>row.method===method).length]))});
 }
 if(!dryRun){for(const {core,pair}of built)await writePackageRelease(root,core,[pair]);await writeFile(new URL(base+'changes.jsonl',root),ledger.map(row=>JSON.stringify(row)).join('\n')+'\n');await writeFile(new URL(base+'report.json',root),JSON.stringify({policy:release.policy,packages:counts,changed:ledger.length,englishSelfDefinitions:'unchanged',studyCores:'unchanged',examples:'unchanged',nativeSpeakerReview:'pending'},null,2)+'\n');}
 return {built,counts,ledger};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {counts}=await buildConciseTranslations({dryRun:process.argv.includes('--dry-run')});console.log(JSON.stringify(counts,null,2));}
