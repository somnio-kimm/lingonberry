import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadReviewedEnglishSnapshot} from './content/english-reviewed-entries.mjs';
import {auditEnglishExampleOverlap} from './content/english-example-overlap.mjs';
import {writeTextAtomic} from './content/atomic-text.mjs';

const folder=new URL('../local-data/coverage/four-language-review/english-sense-plan/',import.meta.url);
const {audit,reviews}=await loadReviewedEnglishSnapshot(new URL('independent-audit.json',folder),
 new URL('independent-effective-finalized.jsonl',folder));
const sourceText=await readFile(new URL('source-evidence.jsonl',folder),'utf8');
// JSONL records use physical LF boundaries; Unicode separators inside quoted text are data.
function* sourceRows(){for(const line of sourceText.split('\n'))if(line.trim())yield JSON.parse(line);}
const report={reviewSnapshotSha256:audit.effectiveReviewSha256,
 sourceEvidenceSha256:createHash('sha256').update(sourceText).digest('hex'),
 ...auditEnglishExampleOverlap({reviews,sourceRows:sourceRows()})};
await writeTextAtomic(new URL('retained-example-overlap-audit.json',folder),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(!report.complete)process.exitCode=1;
