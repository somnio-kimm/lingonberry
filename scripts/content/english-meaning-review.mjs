/** Entry-bound linguistic review records. Validation never confers linguistic approval. */
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(item=>JSON.parse(canonical(item))):Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(canonical(value[key]))])):value);
export const reviewDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function prepareEnglishReview(core,english,korean){
 const pairs=[english,korean].map(pair=>new Map(pair.entries.map(row=>[row.id,row])));
 return core.entries.map((entry,index)=>{
  const [en,ko]=pairs.map(pair=>pair.get(entry.id));
  if(!en?.meaning||!ko?.meaning)throw new Error('Missing meaning: '+entry.id);
  const row={index,id:entry.id,word:entry.word,pos:entry.partOfSpeech,en:en.meaning,ko:ko.meaning,source:entry.provenance,examples:entry.example?[{text:entry.example.text,en:en.exampleTranslation??null,ko:ko.exampleTranslation??null}]:[]};
  return {...row,digest:reviewDigest(row)};
 });
}
export function summariseEnglishReview(entries,records,{requireComplete=false}={}){
 const seen=new Set(),counts={accepted:0,'correction-proposed':0,unresolved:0},issues={};
 for(const row of records){
  if(!Number.isInteger(row.index)||row.index<0)throw new Error('Invalid review index: '+row.id);
  const entry=entries[row.index];
  if(!entry||row.id!==entry.id||row.digest!==entry.digest)throw new Error('Stale or unknown review: '+row.id);
  if(seen.has(row.id))throw new Error('Duplicate review: '+row.id);seen.add(row.id);
  if(!Object.hasOwn(counts,row.status))throw new Error('Unknown review status: '+row.status);
  if(!Array.isArray(row.issues)||row.issues.some(issue=>typeof issue!=='string'||!issue.trim()))throw new Error('Invalid issues: '+row.id);
  if(!row.proposed||typeof row.proposed!=='object'||Array.isArray(row.proposed))throw new Error('Invalid proposed changes: '+row.id);
  for(const [field,value] of Object.entries(row.proposed)){
   if(field==='relatedIndex'){if(!Number.isInteger(value)||!entries[value]||value===row.index||row.proposed.action!=='reconcile-duplicate')throw new Error('Invalid related entry: '+row.id);continue;}
   if(!['en','ko','pos','word','action'].includes(field)||typeof value!=='string'||!value.trim())throw new Error('Invalid proposed field: '+row.id);
   if(field==='action'&&!['quarantine','reconcile-duplicate'].includes(value))throw new Error('Invalid proposed action: '+row.id);
  }
  if(row.status==='accepted'&&(row.issues.length||Object.keys(row.proposed||{}).length))throw new Error('Accepted entry has changes: '+row.id);
  if(row.status!=='accepted'&&(!row.reason?.trim()||!row.issues.length))throw new Error('Finding lacks rationale: '+row.id);
  if(row.status==='correction-proposed'&&!Object.keys(row.proposed||{}).length)throw new Error('Correction lacks proposed change: '+row.id);
  counts[row.status]++;for(const issue of row.issues)issues[issue]=(issues[issue]||0)+1;
 }
 const missing=entries.filter(row=>!seen.has(row.id)).map(row=>row.id);
 if(requireComplete&&missing.length)throw new Error('Incomplete linguistic review: '+missing.length+' entries remain');
 return {total:entries.length,reviewed:seen.size,remaining:missing.length,counts,issues,complete:missing.length===0,linguisticApproval:false,publicationReady:false,method:'AI-assisted entry-by-entry linguistic review; proposals require adjudication and fluent-speaker review.',missing};
}
async function run(folder,requireComplete,exportFolder){
 const json=async name=>JSON.parse(await readFile(name,'utf8'));
 const entries=prepareEnglishReview(await json('language-packages/en-core-3.0.0.json'),await json('language-packages/en-en-3.0.0.json'),await json('language-packages/en-ko-3.0.0.json'));
 const records=[];
 for(const part of [1,2,3,4,5]){try{records.push(...(await readFile(resolve(folder,`part${part}-review.jsonl`),'utf8')).trim().split('\n').filter(Boolean).map(text=>({...JSON.parse(text),reviewer:`english_review_part${part<=2?part:3}`})));}catch(error){if(error.code!=='ENOENT')throw error;}}
 const report=summariseEnglishReview(entries,records,{requireComplete:requireComplete||!!exportFolder});
 await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'summary.json'),JSON.stringify(report,null,2)+'\n');
 if(exportFolder){
  const packages=[];
  for(const id of ['en-core','en-en','en-ko']){const path=`language-packages/${id}-3.0.0.json`,bytes=await readFile(path);packages.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});}
  const manifest={schemaVersion:1,reviewDate:new Date().toISOString().slice(0,10),...report,missing:undefined,sourcePackages:packages,licence:'CC-BY-SA-4.0',attribution:'National Institute of Korean Language; English Wiktionary contributors; Lingonberry contributors. Original package credits and source identities remain authoritative.',licenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/',sourceCredits:'language-packages/credits/MULTILINGUAL-2.0.0.txt',modifications:'AI-assisted English/Korean linguistic review and proposed editorial adaptations. No downloaded package was changed.',reviewedFields:['word','partOfSpeech','English meaning','Korean meaning','existing primary example consistency']};
  const rows=records.sort((a,b)=>a.index-b.index).map(row=>{const entry=entries[row.index];return {...row,word:entry.word,pos:entry.pos,...(row.status!=='accepted'?{original:{en:entry.en,ko:entry.ko},source:entry.source}:{} )};});
  await mkdir(exportFolder,{recursive:true});
  await writeFile(resolve(exportFolder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await writeFile(resolve(exportFolder,'entries.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
 }
 console.log(JSON.stringify({...report,issues:undefined,missing:undefined},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await run(process.argv[2]||'local-data/review/english-2026-10-19',process.argv.includes('--require-complete'),process.argv.includes('--export')?process.argv[process.argv.indexOf('--export')+1]:undefined);
