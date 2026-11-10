import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {auditLanguageEntryReviews} from './content/language-entry-review.mjs';
import {writeTextAtomic} from './content/atomic-text.mjs';

const folder=new URL('../local-data/coverage/four-language-review/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('non-english-review-manifest.json',folder),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
async function readRows(name,optional=false){
 try{const raw=await readFile(new URL(name,folder),'utf8');return {raw,rows:raw.split('\n').filter(line=>line.trim()).map(JSON.parse)};}
 catch(error){if(optional&&error.code==='ENOENT')return {raw:'',rows:[]};throw error;}
}
const reports=[];
for(const language of ['de','zh','ja']){
 const [input,decisions,cross,source]=await Promise.all([readRows(language+'-input.jsonl'),readRows(language+'-decisions.jsonl',true),readRows(language+'-cross-review.jsonl',true),readRows(language+'-source-findings.jsonl',true)]);
 const baseline=manifest.inputs.languages.find(row=>row.language===language);
 if(sha(input.raw)!==baseline.inputSha256)throw new Error('Frozen input changed: '+language);
 const {finalized,report}=auditLanguageEntryReviews({language,inputs:input.rows,decisions:decisions.rows,
  crossReviews:cross.rows,legacyDecisions:manifest.legacyDecisions[language]||[],sourceFindings:source.rows});
 const finalText=finalized.map(JSON.stringify).join('\n')+'\n';
 Object.assign(report,{inputSha256:sha(input.raw),decisionSha256:sha(decisions.raw),crossReviewSha256:sha(cross.raw),finalizedSha256:sha(finalText)});
 await writeTextAtomic(new URL(language+'-review-audit.json',folder),JSON.stringify(report,null,2)+'\n');
 await writeTextAtomic(new URL(language+'-review-finalized.jsonl',folder),finalText);
 reports.push({...report,remaining:report.remaining.length,pendingIndependent:report.pendingIndependent.length,pendingSource:report.pendingSource.length,pendingUsage:report.pendingUsage.length,pendingExampleQuality:report.pendingExampleQuality.length,pendingScopeClassification:report.pendingScopeClassification.length,unexaminedSourceFindings:report.unexaminedSourceFindings.length,errors:report.errors.length});
}
const summary={scope:'Full entry review for German, Chinese and Japanese',languages:reports,
 complete:reports.every(row=>row.complete),notice:'Structural checks establish coverage and bound approvals, not native-speaker certification.'};
await writeTextAtomic(new URL('non-english-review-audit.json',folder),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
if(process.argv.includes('--require-complete')&&!summary.complete)process.exitCode=1;
