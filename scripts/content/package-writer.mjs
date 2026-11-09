import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writeTextAtomic} from './atomic-text.mjs';
import {validateCatalog} from '../../web/js/packages/catalog.js';
import {validatePackage,validateExplanation} from '../../web/js/packages/schema.js';
/** Write immutable payloads first; only then advertise their integrity-bound descriptors. */
export async function writePackageRelease(root,core,pairs,{preserveCompatibleCores=false,compact=false}={}){
 for(const pair of pairs)validateExplanation(core,pair);
 const catalog=JSON.parse(await readFile(new URL('language-packages/catalog.json',root),'utf8'));
 const payloads=[];
 for(const pack of [core,...pairs]){
  validatePackage(pack);const path=`language-packages/${pack.id}-${pack.version}.json`,text=JSON.stringify(pack,null,compact?undefined:2)+'\n';let previous;
  try{previous=await readFile(new URL(path,root),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous&&previous!==text)throw new Error(`Refusing to overwrite ${path}`);
  if(!previous)payloads.push({path,text});
  const descriptor={id:pack.id,kind:pack.kind,targetLanguage:pack.targetLanguage,version:pack.version,...(pack.kind==='explanation'?{explanationLanguage:pack.explanationLanguage,studyVersion:pack.studyVersion}:{}),url:'/'+path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
  const index=catalog.findIndex(row=>row.id===pack.id);if(index<0)throw new Error('Unknown package');
  const priorDescriptor=catalog[index];
  if(preserveCompatibleCores&&pack.kind==='study'&&priorDescriptor.version!==pack.version&&
     catalog.some(row=>row.targetLanguage===pack.targetLanguage&&row.studyVersion===priorDescriptor.version&&!pairs.some(pair=>pair.id===row.id))){
   const existing=catalog.findIndex(row=>row.id===pack.id&&row.version===pack.version);
   if(existing<0)catalog.splice(index,0,descriptor);else catalog[existing]=descriptor;
  }else catalog[index]=descriptor;
 }
 // Check every descriptor, including its byte cap, before touching release files.
 validateCatalog(catalog);
 for(const payload of payloads)await writeTextAtomic(new URL(payload.path,root),payload.text);
 for(const path of ['language-packages/catalog.json','web/catalog.json'])await writeTextAtomic(new URL(path,root),JSON.stringify(catalog,null,2)+'\n');
}
