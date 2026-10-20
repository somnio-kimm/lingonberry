import {readFile} from 'node:fs/promises';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const language=process.argv[process.argv.indexOf('--language')+1];if(!['ja','en'].includes(language))throw new Error('Choose --language ja or en');
const version='4.1.0',source=await read(`language-packages/sources/exercises/${language}.json`),core=await read(`language-packages/${language}-core-4.0.0.json`),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/${language}-${locale}-4.0.0.json`)));
core.version=version;core.exercises=source.exercises.map(({instruction,explanation,...row})=>row);core.families=(source.families||[]).map(({meaning,members,...family})=>({...family,members:members.map(({note,...member})=>member)}));
if(!core.families.length)delete core.families;
const notice=`\n\nLanguage exercises: ${source.notice} Licence: ${source.license}. Factual references: ${source.references.map(row=>row.url).join(' ')}`;
core.license.notice+=notice;core.exerciseReview={status:'curated-starter',exercises:source.exercises.length,coverage:'Not comprehensive per-level or per-entry coverage; levels derive from linked entries.',references:source.references};
for(const pair of pairs){const locale=pair.explanationLanguage;pair.version=version;pair.studyVersion=version;pair.license.notice+=notice;pair.exercises=source.exercises.map(row=>({id:row.id,instruction:row.instruction[locale],explanation:row.explanation[locale]}));pair.families=(source.families||[]).map(row=>({id:row.id,meaning:row.meaning[locale],members:row.members.map(member=>({entryId:member.entryId,note:member.note[locale]}))}));if(!pair.families.length)delete pair.families;validateExplanation(core,pair);}
await writePackageRelease(root,core,pairs);
console.log(`${language} ${version}: ${core.entries.length} entries, ${core.exercises.length} exercises, ${core.families?.length||0} root families; English/Korean explanations complete.`);
