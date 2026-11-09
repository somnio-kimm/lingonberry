import {readFile} from 'node:fs/promises';
import {writePackageRelease} from './content/package-writer.mjs';

const root = new URL('../',import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path,root),'utf8'));
const core = await read('language-packages/ja-core-4.4.0.json');
const source = await read('language-packages/sources/exercises/japanese-reading-context.json');
const reading = core.exercises.filter(row=>row.category==='reading');
if (reading.length!==Object.keys(source).length || reading.some(row=>source[row.id]?.prompt!==row.prompt)) {
 throw new Error('Reading translations must match every curated question.');
}
const pairs = [];
for (const [locale,from,version] of [['en','4.5.0','4.6.0'],['ko','4.6.0','4.7.0']]) {
 const pair = await read(`language-packages/ja-${locale}-${from}.json`);
 for (const row of pair.exercises) {
  if (source[row.id]) row.context = source[row.id][locale];
 }
 pair.version = version;
 pair.license.notice += '\n\nOriginal Japanese reading sentence translations by Lingonberry contributors. Source: language-packages/sources/exercises/japanese-reading-context.json.';
 pairs.push(pair);
}
await writePackageRelease(root,core,pairs);
