import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {meaningStyleSourceDigest,auditKoreanMeaningStyle,compileNaturalKoreanPair} from './content/korean-meaning-style.mjs';
import {writePackageRelease} from './content/package-writer.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),json=async path=>JSON.parse(await readFile(path,'utf8')),rows=async path=>(await readFile(path,'utf8')).split('\n').filter(line=>line.trim()).map(JSON.parse),sha=value=>createHash('sha256').update(value).digest('hex'),pretty=value=>JSON.stringify(value,null,2)+'\n',jsonl=data=>data.map(row=>JSON.stringify(row)).join('\n')+'\n';
export async function loadKoreanMeaningReview(directory){
 const manifest=await json(join(directory,'manifest.json')),catalog=await json(join(root,'language-packages/catalog.json')),packages=[];
 for(const id of ['ja-core','ja-en','ja-ko']){
  const descriptor=manifest.sourcePackages.find(row=>row.id===id);if(!descriptor)throw new Error('Missing source package '+id);
  const bytes=await readFile(join(root,descriptor.url));if(bytes.length!==descriptor.bytes||sha(bytes)!==descriptor.sha256)throw new Error('Changed source package '+id);packages.push(JSON.parse(bytes));
 }
 const contextBytes=await readFile(join(root,manifest.contextPackage.path));if(sha(contextBytes)!==manifest.contextPackage.sha256)throw new Error('Changed earlier Korean context');
 const context=new Map(JSON.parse(contextBytes).entries.map(row=>[row.id,row])),english=new Map(packages[1].entries.map(row=>[row.id,row])),korean=new Map(packages[2].entries.map(row=>[row.id,row]));
 let inputs,archived=false;try{inputs=await rows(join(directory,'inputs.jsonl'));archived=true;}catch(error){if(error.code!=='ENOENT')throw error;inputs=(await Promise.all(manifest.shards.map(name=>rows(join(directory,name+'-input.jsonl'))))).flat();}
 if(inputs.length!==packages[0].entries.length)throw new Error('Full vocabulary input required');
 for(const [index,word]of packages[0].entries.entries()){
  const input={index,id:word.id,word:word.word,reading:word.pronunciation??null,pos:word.partOfSpeech,level:word.level,en:english.get(word.id).meaning,ko:korean.get(word.id).meaning,earlierKo:context.get(word.id)?.meaning??null,example:word.example?.text,exampleKo:korean.get(word.id).exampleTranslation};
  if(meaningStyleSourceDigest(input)!==inputs[index].sourceDigest||meaningStyleSourceDigest(inputs[index])!==inputs[index].sourceDigest)throw new Error('Stale input '+word.id);
 }
 const decisions=[],reviews=[];
 if(archived){
  decisions.push(...await rows(join(directory,'decisions.jsonl')));reviews.push(...await rows(join(directory,'reviews.jsonl')));
  if(decisions.some(row=>![...manifest.shards,'root'].includes(row.author)))throw new Error('Unknown archived decision author');
 }
 for(const owner of archived?[]:[...manifest.shards,'root']){
  let files;try{files=await readdir(join(directory,owner));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  for(const name of files.sort()){
   if(/^batch-\d+\.jsonl$/u.test(name)){const batch=await rows(join(directory,owner,name));if(batch.some(row=>row.author!==owner))throw new Error('Wrong decision author '+name);decisions.push(...batch);}
   else if(/^reviews-.*\.jsonl$/u.test(name)){const batch=await rows(join(directory,owner,name));if(batch.some(row=>row.reviewer!==owner))throw new Error('Wrong reviewer '+name);reviews.push(...batch);}
  }
 }
 return {core:packages[0],english:packages[1],pair:packages[2],inputs,decisions,reviews,independentReviewRequired:manifest.independentReviewRequired!==false,manifest,catalog};
}
export async function buildKoreanMeaningEdition({completion,output,version}){
 const {pair,report}=compileNaturalKoreanPair({...completion,version}),base=`language-packages/sources/meaning-style/ja-ko-${version}`;
 const artifacts=[['inputs.jsonl',jsonl(completion.inputs)],['decisions.jsonl',jsonl(completion.decisions)],['reviews.jsonl',jsonl(completion.reviews)],['manifest.json',pretty(completion.manifest)],['NOTICE.txt',pair.license.notice+'\n']].map(([name,data])=>({path:base+'/'+name,data}));
 const proof={version,sourceVersion:completion.pair.version,studyVersion:completion.core.version,...report,files:artifacts.map(({path,data})=>({path,bytes:Buffer.byteLength(data),sha256:sha(data)}))};
 pair.meaningReview={...proof,status:'targeted-AI-editorial-corrections',nativeSpeakerReview:'pending'};artifacts.push({path:base+'/report.json',data:pretty(proof)});
 for(const {path,data}of artifacts){try{if(await readFile(join(output,path),'utf8')!==data)throw new Error('Refusing to overwrite '+path);}catch(error){if(error.code!=='ENOENT')throw error;}}
 for(const {path,data}of artifacts){await mkdir(dirname(join(output,path)),{recursive:true});await writeFile(join(output,path),data);}
 await mkdir(join(output,'web'),{recursive:true});await mkdir(join(output,'language-packages'),{recursive:true});
 try{await writeFile(join(output,'language-packages/catalog.json'),pretty(completion.catalog),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
 await writePackageRelease(pathToFileURL(resolve(output)+'/'),completion.core,[pair]);return proof;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [command,directory,output,version]=process.argv.slice(2);if(!['audit','build'].includes(command)||!directory)throw new Error('Usage: node scripts/review-korean-meanings.mjs audit DIRECTORY | build DIRECTORY OUTPUT VERSION');
 const completion=await loadKoreanMeaningReview(resolve(directory));
 if(command==='build'){if(!output||!version)throw new Error('Build output and version required');console.log(pretty(await buildKoreanMeaningEdition({completion,output:resolve(output),version})));}
 else{const report=auditKoreanMeaningStyle(completion);await writeFile(join(directory,'audit.json'),pretty(report));console.log(pretty({...report,missingIds:report.missingIds.length,uncertainIds:report.uncertainIds.length,unreviewedIds:report.unreviewedIds.length,findings:report.findings.length}));}
}
