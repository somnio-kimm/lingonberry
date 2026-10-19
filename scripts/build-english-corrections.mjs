import {readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compileMeaningCorrections} from './content/compile-meaning-corrections.mjs';
import {validateDescriptor} from '../web/js/packages/schema.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const rows=async path=>(await readFile(path,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function buildMeaningCorrectionEdition({language='en',directory,output,publish=false}={}){
 if(!['en','ja'].includes(language))throw new Error('Unsupported correction language');
 const name=language==='en'?'english':'japanese';directory??=resolve(root,`local-data/corrections/${name}-4.0.0`);output??=resolve(root,`local-data/corrections/${name}-4.0.0/build`);
 const core=await json(resolve(root,`language-packages/${language}-core-3.0.0.json`));
 const pairs=await Promise.all(['en','ko'].map(locale=>json(resolve(root,`language-packages/${language}-${locale}-3.0.0.json`))));
 const review=language==='en'?await rows(resolve(root,'language-packages/sources/meaning-reviews/en-3.0.0/entries.jsonl')):undefined;
 const decisions=(await Promise.all(['a','b','c'].map(part=>rows(join(directory,part+'-decisions.jsonl'))))).flat();
 const sourceValidation=await json(join(directory,'source-validation.json'));
 const {packages,report}=compileMeaningCorrections({core,pairs,review,decisions,sourceValidation,version:'4.0.0'});
 const payloads=packages.map(data=>{
  const {entries,...header}=data,bytes=Buffer.from(JSON.stringify(header,null,2).slice(0,-2)+',\n  "entries": [\n'+entries.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
  const descriptor={id:data.id,kind:data.kind,targetLanguage:language,version:data.version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:data.studyVersion}:{}),url:`/language-packages/${data.id}-${data.version}.json`,bytes:bytes.length,sha256:hash(bytes)};validateDescriptor(descriptor);return {data,bytes,descriptor};
 });
 const catalog=(await json(resolve(root,'language-packages/catalog.json'))).map(row=>payloads.find(item=>item.descriptor.id===row.id)?.descriptor||row);
 const groups=new Map();for(const row of packages[0].entries){const key=row.word.toLocaleLowerCase(language)+'|'+row.partOfSpeech;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row.id);}
 report.duplicateHeadwordGroups=[...groups].filter(([,ids])=>ids.length>1).map(([key,ids])=>({key,ids}));
 report.packages=payloads.map(row=>row.descriptor);
 await mkdir(output,{recursive:true});
 for(const row of payloads)await writeFile(join(output,`${row.data.id}-${row.data.version}.json`),row.bytes);
 await writeFile(join(output,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 if(publish){
  for(const row of payloads){const path=resolve(root,'.'+row.descriptor.url);try{await access(path);if(!(await readFile(path)).equals(row.bytes))throw new Error('Refusing to overwrite immutable package: '+path);}catch(error){if(error.code!=='ENOENT')throw error;}}
  for(const row of payloads){const path=resolve(root,'.'+row.descriptor.url);try{await writeFile(path,row.bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(!(await readFile(path)).equals(row.bytes))throw new Error('Immutable package changed during publication: '+path);}}
  for(const path of ['language-packages/catalog.json','web/catalog.json']){const file=resolve(root,path);await writeFile(file+'.pending',JSON.stringify(catalog,null,2)+'\n');await rename(file+'.pending',file);}
 }
 return report;
}
export const buildEnglishCorrectionEdition=options=>buildMeaningCorrectionEdition({...options,language:'en'});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const option=name=>{const index=process.argv.indexOf(name);if(index<0)return undefined;const value=process.argv[index+1];if(!value||value.startsWith('--'))throw new Error('Missing value for '+name);return resolve(value);};
 const directory=option('--directory'),output=option('--output'),languageIndex=process.argv.indexOf('--language'),language=languageIndex<0?'en':process.argv[languageIndex+1];console.log(JSON.stringify(await buildMeaningCorrectionEdition({language,...(directory?{directory}:{}),...(output?{output}:{}),publish:process.argv.includes('--publish')}),null,2));
}
