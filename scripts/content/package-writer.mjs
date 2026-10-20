import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validatePackage,validateExplanation} from '../../web/js/packages/schema.js';
/** Write immutable payloads first; only then advertise their integrity-bound descriptors. */
export async function writePackageRelease(root,core,pairs){
 for(const pair of pairs)validateExplanation(core,pair);
 const catalog=JSON.parse(await readFile(new URL('language-packages/catalog.json',root),'utf8'));
 for(const pack of [core,...pairs]){
  validatePackage(pack);const path=`language-packages/${pack.id}-${pack.version}.json`,text=JSON.stringify(pack,null,2)+'\n';let previous;
  try{previous=await readFile(new URL(path,root),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous&&previous!==text)throw new Error(`Refusing to overwrite ${path}`);if(!previous)await writeFile(new URL(path,root),text);
  const descriptor={id:pack.id,kind:pack.kind,targetLanguage:pack.targetLanguage,version:pack.version,...(pack.kind==='explanation'?{explanationLanguage:pack.explanationLanguage,studyVersion:pack.studyVersion}:{}),url:'/'+path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
  const index=catalog.findIndex(row=>row.id===pack.id);if(index<0)throw new Error('Unknown package');catalog[index]=descriptor;
 }
 for(const path of ['language-packages/catalog.json','web/catalog.json'])await writeFile(new URL(path,root),JSON.stringify(catalog,null,2)+'\n');
}
