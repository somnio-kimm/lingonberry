import {readFile} from 'node:fs/promises';

const folder='local-data/coverage/four-language-review/english-sense-plan/';
const defaults={schemaVersion:1,version:'7.0.0',audit:folder+'independent-audit.json',
 snapshot:folder+'independent-effective-finalized.jsonl',overlapAudit:folder+'retained-example-overlap-audit.json',
 focusDecisions:folder+'example-focus-decisions.jsonl',gapDecisions:folder+'gap-fill-decisions.jsonl',
 gapApprovals:folder+'gap-practice-approvals.jsonl',stage:'local-data/coverage/reviewed-english-release/'};
const paths=['audit','snapshot','overlapAudit','focusDecisions','gapDecisions','gapApprovals','stage'];
const invalid=message=>new Error('Invalid English build configuration: '+message);
function localUrl(value,root){
 if(typeof value!=='string'||!value.trim())throw invalid('paths must be non-empty strings');
 const url=new URL(value,root);
 if(url.protocol!=='file:'||url.search||url.hash)throw invalid('paths must identify a local file');
 return url;
}

/** Select inputs; existing source, snapshot and package audits still decide readiness. */
export async function loadEnglishBuildConfig(root,args){
 let configPath,write=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--write'&&!write)write=true;
  else if(args[i]==='--config'&&!configPath&&args[i+1]&&!args[i+1].startsWith('--'))configPath=args[++i];
  else throw invalid('unknown, repeated or incomplete argument '+args[i]);
 }
 const config=configPath?JSON.parse(await readFile(localUrl(configPath,root),'utf8')):{};
 if(!config||typeof config!=='object'||Array.isArray(config))throw invalid('expected a JSON object');
 for(const key of Object.keys(config))if(!Object.hasOwn(defaults,key))throw invalid('unknown field '+key);
 const values={...defaults,...config};
 if(values.schemaVersion!==1)throw invalid('unsupported schemaVersion');
 if(typeof values.version!=='string'||!/^\d+\.\d+\.\d+$/u.test(values.version))throw invalid('version must be an explicit numeric release');
 const result={version:values.version,write,optionalGapDecisions:!Object.hasOwn(config,'gapDecisions')};
 for(const key of paths)result[key]=localUrl(values[key],root);
 if(!result.stage.pathname.endsWith('/'))result.stage=new URL(result.stage.href+'/');
 const privateRoot=new URL('local-data/',root);
 if(!result.stage.href.startsWith(privateRoot.href))throw invalid('stage must stay under private local-data/');
 return result;
}
