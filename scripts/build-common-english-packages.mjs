import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readCommonWordLists,expandCommonEnglish} from './content/english-common-coverage.mjs';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
const root=new URL('../',import.meta.url),text=path=>readFile(new URL(path,root),'utf8'),read=async path=>JSON.parse(await text(path)),base='language-packages/sources/english-common/';
const source=await read(base+'additions.json'),review=await read(base+'level-review.json'),release=await read(base+'release.json');
for(const row of [...source.references,...release.inputs])if(createHash('sha256').update(await readFile(new URL(row.path,root))).digest('hex')!==row.sha256)throw new Error('Changed common-vocabulary source '+row.path);
const reference=readCommonWordLists(await text(base+'NGSL_12_stats.csv'),await text(base+'SUP_lemmatized.csv')),previous=await read(`language-packages/en-core-${source.from}.json`),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-${source.from}.json`)));
const built=expandCommonEnglish(previous,pairs,source,review,reference);for(const pair of built.pairs)validateExplanation(built.core,pair);
if(!process.argv.includes('--dry-run')){await writePackageRelease(root,built.core,built.pairs);await writeFile(new URL(base+'coverage.json',root),JSON.stringify({version:source.to,notice:source.sourceScope,license:'CC-BY-SA-4.0',...built.audit},null,2)+'\n');}
console.log(JSON.stringify({version:source.to,entries:built.core.entries.length,added:source.entries.length,reference:reference.length,covered:built.audit.covered,missing:built.audit.missing,upperOnly:built.audit.upperOnly,moved:review.decisions.filter(row=>row.from!==built.core.entries.find(entry=>entry.id===row.id).level).length}));
