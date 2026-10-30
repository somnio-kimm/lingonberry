import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {auditReviewedExamples} from './content/reviewed-examples.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const rows=async path=>(await readFile(path,'utf8')).split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line));
export async function auditExampleDirectory(directory){
 const manifest=await json(join(directory,'manifest.json')),catalog=await json(join(root,'language-packages/catalog.json'));
 const packages=[];
 for(const id of ['ja-core','ja-en','ja-ko']){
  const descriptor=catalog.find(row=>row.id===id);if(!descriptor)throw new Error('Missing package: '+id);
  const bytes=await readFile(join(root,descriptor.url));
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==descriptor.sha256||digest!==manifest.sourceSha256[id])throw new Error('Source package changed: '+id);
  packages.push(JSON.parse(bytes));
 }
 const inputs=(await Promise.all(['lower','upper-a','upper-b'].map(name=>rows(join(directory,name+'-input.jsonl'))))).flat();
 const ownership=await json(join(directory,'ownership.json')),authored=[],reviews=[];
 for(const shard of ['lower','lower-extra','upper-a','upper-b','root']){
  let files;try{files=await readdir(join(directory,shard));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  for(const name of files.sort()){
   if(/^(?:batch-)?\d+(?:-\d+)?\.jsonl$/u.test(name)){
    const batch=await rows(join(directory,shard,name));
    for(const row of batch)if(ownership[row.id]!== (shard==='lower-extra'?'lower':shard))throw new Error('Wrong author shard: '+row.id);
    authored.push(...batch);
   }else if(/^reviews-.*\.jsonl$/u.test(name)){
    const batch=await rows(join(directory,shard,name));
    for(const row of batch)if(row.reviewer!== (shard==='lower-extra'?'lower':shard))throw new Error('Wrong reviewer shard: '+row.id);
    reviews.push(...batch);
   }
  }
 }
 const report=auditReviewedExamples({core:packages[0],pairs:packages.slice(1),inputs,ownership,authored,reviews});
 const {evidence,...serializable}=report;
 await writeFile(join(directory,'audit.json'),JSON.stringify(serializable,null,2)+'\n');
 return serializable;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [directory,...options]=process.argv.slice(2);if(!directory)throw new Error('Usage: node scripts/audit-reviewed-examples.mjs AUTHORING_DIRECTORY [--require-complete]');
 const report=await auditExampleDirectory(resolve(directory));
 console.log(JSON.stringify({...report,missingIds:report.missingIds.length,unreviewedIds:report.unreviewedIds.length,findings:report.findings.length},null,2));
 if(options.includes('--require-complete')&&!report.fullCoverage)process.exitCode=1;
}
