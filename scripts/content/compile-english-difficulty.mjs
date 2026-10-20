import {readFile,writeFile} from 'node:fs/promises';
import {appendEnglishWords,englishSenseBinding} from './english-difficulty.mjs';
const root=new URL('../../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const core=await read('language-packages/en-core-4.1.0.json'),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-4.1.0.json`))),additions=await read('language-packages/sources/english-difficulty-additions.json');appendEnglishWords(core,pairs,additions);
const meanings=Object.fromEntries(pairs.map(pair=>[pair.explanationLanguage,new Map(pair.entries.map(row=>[row.id,row.meaning]))])),entries=new Map(core.entries.map(row=>[row.id,row]));
const records=[];
for(const part of [1,2,3]){
 const parse=async name=>(await readFile(new URL(`local-data/difficulty-review/part${part}-${name}.jsonl`,root),'utf8')).trim().split('\n').map(JSON.parse),inputs=await parse('input'),decisions=await parse('decisions');
 for(const row of inputs){const entry=entries.get(row.id);if(!entry||entry.word!==row.word||entry.partOfSpeech!==row.pos||meanings.en.get(row.id)!==row.en||meanings.ko.get(row.id)!==row.ko)throw new Error(`Stale input sense ${row.id}`);}
 const ids=new Set(inputs.map(row=>row.id));if(decisions.length!==inputs.length||new Set(decisions.map(row=>row.id)).size!==ids.size||decisions.some(row=>!ids.has(row.id)))throw new Error(`Incomplete review partition ${part}`);
 records.push(...decisions);
}
const seen=new Set(records.map(row=>row.id));
for(const row of additions.entries){const id=`en-editorial-${row.word}`;if(seen.has(id))continue;if(row.editorialReview!=='peer-accepted'||!row.difficultyReason)throw new Error(`Missing authored-word review: ${row.word}`);records.push({id,band:3,expertScore:4,reason:row.difficultyReason});seen.add(id);}
const calibration=await read('language-packages/sources/english-difficulty-calibration.json');
for(const correction of calibration.decisions){const index=records.findIndex(row=>row.id===correction.id);if(index<0)throw new Error('Unknown calibration ID');records[index]={...records[index],...correction};if(correction.band!==3)delete records[index].expertScore;}
const decisions=new Map(records.map(row=>[row.id,row]));if(decisions.size!==core.entries.length||records.length!==core.entries.length)throw new Error('Full entry coverage required');
const review={id:'english-difficulty-2026-10-20',status:'complete-editorial-difficulty-review',notice:'Every current English entry was classified by its stored English/Korean sense. AI-assisted editorial judgement, not native-speaker certification or official IELTS/SAT/GRE membership. The highest group requires at least 1000 distinct GRE-level headwords; duplicate senses do not satisfy that count.',senseSha256:englishSenseBinding(core,pairs),decisions:core.entries.map(row=>({...decisions.get(row.id),word:row.word}))};
await writeFile(new URL('language-packages/sources/english-difficulty-review.json',root),JSON.stringify(review,null,2)+'\n');console.log(`Compiled ${review.decisions.length} per-entry difficulty decisions.`);
