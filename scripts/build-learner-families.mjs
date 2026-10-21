import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const hash=async path=>createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
const sourcePath='language-packages/sources/exercises/learner-word-families.json';
const source=await read(sourcePath),release=await read('language-packages/sources/exercises/learner-word-families-release.json');
if(await hash(sourcePath)!==release.sourceSha256)throw new Error('Learner families changed after review');
for(const row of release.sourcePackages)if(await hash(row.path)!==row.sha256)throw new Error('Changed baseline '+row.path);
const core=await read(`language-packages/en-core-${release.from}.json`);
const pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-${release.from}.json`)));
const entries=new Map(core.entries.map(row=>[row.id,row]));
core.version=release.to;
core.families=source.families.map(({meaning,references,...family})=>{
 for(const member of family.members)if(entries.get(member.entryId)?.word!==member.word)throw new Error('Wrong family member '+member.entryId);
 return family;
});
const removed=new Set((core.exercises||[]).filter(row=>row.category==='roots').map(row=>row.id));
core.exercises=(core.exercises||[]).filter(row=>!removed.has(row.id));
// Published historical-source snapshots stay immutable; this release exposes the learner set.
if(core.practiceData)delete core.practiceData.rootFamilies;
for(const pair of pairs){
 pair.version=release.to;pair.studyVersion=release.to;
 const meanings=new Map(pair.entries.map(row=>[row.id,row.meaning]));
 pair.families=source.families.map(family=>({id:family.id,meaning:family.meaning[pair.explanationLanguage],members:family.members.map(member=>({entryId:member.entryId,note:meanings.get(member.entryId)}))}));
 pair.exercises=(pair.exercises||[]).filter(row=>!removed.has(row.id));
}
for(const pack of [core,...pairs]){
 pack.license.notice+='\n\nLingonberry learner roots and affixes: '+source.notice+'\n';
 const url=`https://github.com/somnio-kimm/lingonberry/blob/${release.sourceCommit}/language-packages/sources/exercises/learner-word-families.json`;
 pack.license.links||=[];pack.license.links.push({title:'Learner Roots and Affixes — Origins and References',url});
}
for(const pair of pairs)validateExplanation(core,pair);
if(!process.argv.includes('--dry-run'))await writePackageRelease(root,core,pairs);
console.log(`English ${release.to}: ${core.families.length} learner families; ${new Set(core.families.flatMap(f=>f.members.map(m=>m.entryId))).size} related words; ${core.entries.length} vocabulary IDs preserved; confusables unchanged.`);
