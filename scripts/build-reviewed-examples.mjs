import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadExampleDirectory} from './audit-reviewed-examples.mjs';
import {compileReviewedExamples,exampleSourceBinding} from './content/reviewed-examples.mjs';
import {writePackageRelease} from './content/package-writer.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const jsonl=rows=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
async function checkImmutable(path,bytes){
 try{if(await readFile(path,'utf8')!==bytes)throw new Error('Refusing to overwrite completion artifact: '+path);}
 catch(error){if(error.code!=='ENOENT')throw error;}
}
/** Build a preview directory only after every missing example has a current independent pass. */
export async function buildReviewedExampleEdition({completion,version,output}){
 const {packages,report}=compileReviewedExamples({...completion,version});
 const {evidence,...coverage}=report,source=`language-packages/sources/examples/editions/${version}`;
 const artifacts=[
  [`${source}/ja-completion-authored.jsonl`,jsonl(completion.authored)],
  [`${source}/ja-completion-reviews.jsonl`,jsonl(completion.reviews)],
  [`${source}/ja-completion-bindings.jsonl`,jsonl(completion.inputs.map(exampleSourceBinding))],
  [`${source}/ja-completion-ownership.json`,json(completion.ownership)],
  [`${source}/NOTICE.txt`,packages[0].license.notice+'\n']
 ];
 const proof={sourceVersion:completion.core.version,sourceSha256:completion.manifest.sourceSha256,...coverage,files:artifacts.map(([path,bytes])=>({path,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)}))};
 packages[0].contentReview.completionReview={status:'AI-editorial-checked',nativeSpeakerReview:'pending',...proof};
 const buildReport=json({version,...proof});artifacts.push([`${source}/ja-completion-report.json`,buildReport]);
 for(const [path,bytes]of artifacts)await checkImmutable(join(output,path),bytes);
 for(const [path,bytes]of artifacts){await mkdir(dirname(join(output,path)),{recursive:true});await writeFile(join(output,path),bytes);}
 await mkdir(join(output,'web'),{recursive:true});await mkdir(join(output,'language-packages'),{recursive:true});
 const catalogPath=join(output,'language-packages/catalog.json');
 try{await writeFile(catalogPath,json(completion.catalog),{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
 await writePackageRelease(pathToFileURL(resolve(output)+'/'),packages[0],packages.slice(1));
 return {version,...proof};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [directory,output,version]=process.argv.slice(2);
 if(!directory||!output||!version)throw new Error('Usage: node scripts/build-reviewed-examples.mjs AUTHORING_DIRECTORY OUTPUT_DIRECTORY VERSION');
 const result=await buildReviewedExampleEdition({completion:await loadExampleDirectory(resolve(directory)),output:resolve(output),version});
 console.log(JSON.stringify(result,null,2));
}
