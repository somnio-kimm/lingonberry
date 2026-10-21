import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const source=await read('language-packages/sources/exercises/collocations.json'),catalog=await read('language-packages/catalog.json');
const review=await read('language-packages/sources/exercises/collocations-review.json');
if(createHash('sha256').update(await readFile(new URL('language-packages/sources/exercises/collocations.json',root))).digest('hex')!==review.sourceSha256)throw new Error('Collocation authoring changed after review');
const reviewed=new Set(review.rows.filter(row=>['accepted','accepted-after-corrections'].includes(row.status)).map(row=>row.id));
if(Object.values(source.languages).flat().some(row=>!reviewed.has(row.id)))throw new Error('Unreviewed collocation');
const release=await read('language-packages/sources/exercises/collocations-release.json');
for(const row of release.sourcePackages)if(createHash('sha256').update(await readFile(new URL(row.path,root))).digest('hex')!==row.sha256)throw new Error('Changed baseline '+row.path);
for(const [language,rows] of Object.entries(source.languages)){
 const previous=release.languages[language].from,version=release.languages[language].to,core=await read(`language-packages/${language}-core-${previous}.json`);
 const pairs=await Promise.all(catalog.filter(row=>row.kind==='explanation'&&row.targetLanguage===language).map(row=>read(`language-packages/${row.id}-${previous}.json`)));
 core.version=version;const entries=new Map(core.entries.map(row=>[row.id,row]));
 for(const row of rows){const entry=entries.get(row.entryId);if(!entry||entry.word!==row.anchor)throw new Error(`Wrong collocation anchor ${row.id}`);entry.collocations=[...(entry.collocations||[]),{id:row.id,phrase:row.phrase,type:row.type,acceptedAnswers:row.acceptedAnswers,example:row.example}];}
 for(const pair of pairs){pair.version=version;pair.studyVersion=version;const byId=new Map(pair.entries.map(row=>[row.id,row])),locale=pair.explanationLanguage;
  for(const row of rows){const entry=byId.get(row.entryId),other=rows.filter(item=>item.id!==row.id&&item.type===row.type);const meaningChoices=[...new Set([row.meaning[locale],...other.map(item=>item.meaning[locale])])].slice(0,4);entry.collocations=[...(entry.collocations||[]),{id:row.id,meaning:row.meaning[locale],exampleTranslation:row.exampleTranslation[locale],meaningChoices}];}
 }
 for(const pack of [core,...pairs]){pack.license.notice+=`\n\nLingonberry collocations: ${source.notice} Original phrase glosses, examples, translations and answer alternatives are MIT. Collocation meanings describe the phrase's use and may extend beyond an anchor word's currently selected dictionary sense. Study levels follow existing anchor IDs; they do not certify the sentence's exam level.\n`;
  if(!pack.license.identifier.split(' AND ').includes('MIT'))pack.license.identifier+=' AND MIT';
  const url='https://github.com/somnio-kimm/lingonberry/blob/main/LICENSE';pack.license.links||=[];if(!pack.license.links.some(row=>row.url===url))pack.license.links.push({title:'Lingonberry — Original Collocation Content Licence',url});
 }
 for(const pair of pairs)validateExplanation(core,pair);
 if(!process.argv.includes('--dry-run'))await writePackageRelease(root,core,pairs);
 console.log(`${language} ${version}: ${rows.length} collocations, ${pairs.map(row=>row.explanationLanguage).join('/')} explanations; ${core.entries.length} vocabulary IDs preserved`);
}
