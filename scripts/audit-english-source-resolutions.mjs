import {readFile,writeFile} from 'node:fs/promises';
import {auditSourceResolutions} from './content/source-resolution-review.mjs';

const root=new URL('../',import.meta.url);
const folder='local-data/coverage/four-language-review/';
async function readRows(path){
 try{return (await readFile(new URL(path,root),'utf8')).split('\n').filter(line=>line.trim()).map(line=>JSON.parse(line));}
 catch(error){if(error.code==='ENOENT')return [];throw error;}
}
async function parts(pattern){
 return (await Promise.all([1,2,3].map(part=>readRows(folder+pattern.replace('{part}',part))))).flat();
}
const inputs=await readRows(folder+'en-source-flags-input.jsonl');
if(inputs.length!==269)throw new Error('Incomplete original English source flag inventory');
const [resolutions,crossReviews,finalDecisions]=await Promise.all([
 parts('en-source-flags-{part}-resolutions.jsonl'),
 parts('en-source-flags-{part}-cross-review.jsonl'),
 parts('en-source-final-{part}-decisions.jsonl'),
]);
const {report,finalized}=auditSourceResolutions({inputs,resolutions,crossReviews,finalDecisions});
report.notice='Source identity, content completeness and independent-review evidence verified. Source retirements and alternate senses still require integration into the final sense inventory.';
await writeFile(new URL(folder+'en-source-resolution-audit.json',root),JSON.stringify(report,null,2)+'\n');
if(report.complete){
 await writeFile(new URL(folder+'en-source-finalized.jsonl',root),finalized.map(row=>JSON.stringify(row)).join('\n')+'\n');
}
console.log(JSON.stringify({...report,missingFlags:report.missingFlags.length,
 remainingIndependentChecks:report.remainingIndependentChecks.length}));
if(process.argv.includes('--require-complete')&&!report.complete)process.exitCode=1;
