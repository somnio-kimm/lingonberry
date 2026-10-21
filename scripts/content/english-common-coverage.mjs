import {createHash} from 'node:crypto';
import {ENGLISH_LEVELS} from '../../web/js/shared/english-levels.js';
import {findSentenceFocus} from '../../web/js/shared/lexicon-sentences.js';
const normalise=value=>value.normalize('NFKC').trim().toLocaleLowerCase('en');
/** These fixed reference CSVs have no quoted fields; reject a changed format. */
export function readCommonWordLists(stats,supplement){
 const parse=text=>text.replace(/^\uFEFF/u,'').trim().split(/\r?\n/u).map(line=>{if(line.includes('"'))throw new Error('Unexpected quoted common-list CSV');return line.split(',');});
 const main=parse(stats);if(main.shift().join(',')!=='Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)')throw new Error('Changed NGSL columns');
 const rows=main.map(([word,rank])=>({word,rank:Number(rank),list:'NGSL-1.2'}));
 rows.push(...parse(supplement).map(([word])=>({word,list:'NGSL-supplement',caseSensitive:/^[A-Z]/u.test(word)})));
 if(main.length!==2809||rows.length!==2861||new Set(rows.map(row=>row.list+':'+row.word)).size!==rows.length)throw new Error('Incomplete or duplicated common reference list');
 return rows;
}
export function auditCommonCoverage(core,reference){
 const index=new Map();for(const entry of core.entries)for(const word of new Set([entry.word,...(entry.aliases||[])].map(normalise))){if(!index.has(word))index.set(word,[]);index.get(word).push(entry);}
 const decisions=reference.map(row=>{const entries=(index.get(normalise(row.word))||[]).filter(entry=>!row.caseSensitive||entry.word===row.word);return {...row,entryIds:entries.map(entry=>entry.id),levels:[...new Set(entries.map(entry=>entry.level))],lowerBand:entries.some(entry=>ENGLISH_LEVELS.indexOf(entry.level)>=0&&ENGLISH_LEVELS.indexOf(entry.level)<=1)};});
 return {referenceEntries:reference.length,covered:decisions.filter(row=>row.entryIds.length).length,missing:decisions.filter(row=>!row.entryIds.length).map(row=>row.word),upperOnly:decisions.filter(row=>row.entryIds.length&&!row.lowerBand).map(row=>row.word),decisions};
}
export function expandCommonEnglish(previous,previousPairs,source,review,reference){
 const core=structuredClone(previous),pairs=structuredClone(previousPairs),byId=new Map(core.entries.map(row=>[row.id,row])),english=new Map(pairs.find(pair=>pair.explanationLanguage==='en').entries.map(row=>[row.id,row]));
 const reviewed=new Set();for(const decision of review.decisions){const entry=byId.get(decision.id);if(!entry||reviewed.has(entry.id)||entry.word.toLowerCase()!==decision.word||entry.partOfSpeech!==decision.partOfSpeech||entry.level!==decision.from||createHash('sha256').update(english.get(entry.id).meaning).digest('hex')!==decision.meaningSha256||!ENGLISH_LEVELS[decision.band])throw new Error('Stale common-sense level review '+decision.id);reviewed.add(entry.id);
  entry.level=ENGLISH_LEVELS[decision.band];entry.grammar={...entry.grammar,studyTier:['foundation','independent','advanced','precision'][decision.band],levelEvidence:{...entry.grammar?.levelEvidence,commonCoverageReview:source.id,officialExamVocabulary:false}};
 }
 for(const update of source.variantUpdates){const entry=byId.get(update.entryId);if(!entry)throw new Error('Unknown spelling-variant target');entry.aliases=[...new Set([...(entry.aliases||[]),...update.aliases])];}
 const authored=new Set();for(const row of source.entries){if(byId.has(row.id)||authored.has(row.id)||!ENGLISH_LEVELS[row.band]||!row.meaning.en?.trim()||!row.meaning.ko?.match(/[가-힣]/u)||!row.example.ko?.match(/[가-힣]/u)||!findSentenceFocus({lemma:row.word},{text:row.example.text},'en'))throw new Error('Incomplete, repeated or unusable common entry '+row.word);authored.add(row.id);
  const provenance={kind:'app-authored',creator:'Lingonberry contributors',license:'MIT',review:row.review};
  core.entries.push({id:row.id,word:row.word,partOfSpeech:row.partOfSpeech,aliases:row.aliases,level:ENGLISH_LEVELS[row.band],grammar:{studyTier:['foundation','independent','advanced','precision'][row.band],levelEvidence:{basis:'editorial-common-sense-review',reviewId:source.id,officialExamVocabulary:false}},tags:['ielts:shared','topic:general'],provenance,example:{text:row.example.text,source:provenance}});
  for(const pair of pairs)pair.entries.push({id:row.id,meaning:row.meaning[pair.explanationLanguage],exampleTranslation:pair.explanationLanguage==='en'?row.example.text:row.example.ko,provenance});
 }
 core.version=source.to;for(const pair of pairs){pair.version=source.to;pair.studyVersion=source.to;}
 const audit=auditCommonCoverage(core,reference);if(audit.missing.length||audit.upperOnly.length)throw new Error('Incomplete common-word coverage: '+JSON.stringify({missing:audit.missing,upperOnly:audit.upperOnly}));
 const expertWords=new Set(core.entries.filter(row=>row.level===ENGLISH_LEVELS[3]).map(row=>normalise(row.word)));if(expertWords.size<1000)throw new Error('Advanced inventory fell below 1000 distinct GRE-level entries');
 const translations=pairs.map(pair=>new Map(pair.entries.map(row=>[row.id,row]))),examples=core.entries.filter(row=>row.example&&translations.every(pair=>pair.get(row.id)?.exampleTranslation)).length;
 core.contentReview={...core.contentReview,entries:core.entries.length,bilingualExamples:examples,examplesPending:core.entries.length-examples,commonCoverage:{id:source.id,referenceEntries:audit.referenceEntries,covered:audit.covered,missing:0,upperOnly:0,added:source.entries.length,reviewedSenses:review.decisions.length,nativeSpeakerReview:'pending'}};
 const notice=`\n\nCommon English coverage: New General Service List (NGSL) 1.2 and supplementary words by Browne, C., Culligan, B., and Phillips, J., CC BY-SA 4.0 (${source.sourcePage}); original source snapshots, hashes, rank evidence and coverage adaptations: language-packages/sources/english-common. ${source.originalContentNotice} Editorial study bands are not official IELTS vocabulary lists or score predictions.\n`;
 for(const pack of [core,...pairs]){pack.license.notice+=notice;pack.license.links.push({title:'NGSL 1.2 — Browne, Culligan and Phillips — CC BY-SA 4.0',url:source.sourcePage});}
 return {core,pairs,audit};
}
