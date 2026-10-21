import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const hash=async path=>createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
const sourcePath='language-packages/sources/exercises/english-morpheme-inventory.json',release=await read('language-packages/sources/exercises/english-morpheme-release.json'),source=await read(sourcePath);
if(await hash(sourcePath)!==release.sourceSha256)throw new Error('Morpheme authoring changed after review');
for(const row of release.sourcePackages)if(await hash(row.path)!==row.sha256)throw new Error('Changed baseline '+row.path);
const core=await read(`language-packages/en-core-${release.from}.json`),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-${release.from}.json`)));
core.version=release.to;
core.morphemes=source.entries.map(({id,form,variants,kind,origin,examples,senses,source:url})=>({id,form,variants,kind,origin,examples,senses:senses.map(({id,tags})=>({id,...(tags?{tags}:{})})),source:url}));
for(const pair of pairs){pair.version=release.to;pair.studyVersion=release.to;pair.morphemes=source.entries.map(row=>({id:row.id,senses:row.senses.map(s=>({id:s.id,meaning:s[pair.explanationLanguage]}))}));}
for(const pack of [core,...pairs]){
 pack.license.notice+='\n\nReadable English roots and affixes: English Wiktionary contributors and Wikipedia contributors, CC BY-SA 4.0. Source gloss paths, related-word lists and source-reported origins were extracted from fixed snapshots; display labels exclude reconstructed or phonetic forms. Korean translations and editorial transformations by Lingonberry are adaptations distributed under CC BY-SA 4.0, not MIT. Source links and complete snapshot hashes are recorded in the authoring inventory. The inventory covers all defined readable entries in these selected sources, not a universal fixed count of English word families. Some elements have no documented origin or related example in the source.\n';
 for(const row of [{title:'Wikipedia Contributors — Greek and Latin Roots',url:'https://en.wikipedia.org/wiki/List_of_Greek_and_Latin_roots_in_English'}]){
  pack.license.links||=[];if(!pack.license.links.some(old=>old.url===row.url))pack.license.links.push(row);
 }
}
for(const pair of pairs)validateExplanation(core,pair);
if(!process.argv.includes('--dry-run'))await writePackageRelease(root,core,pairs);
console.log(`English ${release.to}: ${core.morphemes.length} source entries; ${core.morphemes.reduce((n,r)=>n+r.senses.length,0)} complete EN/KO meanings; ${core.entries.length} vocabulary records preserved.`);
