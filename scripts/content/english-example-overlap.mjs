import {isEnglishReviewExcluded} from './supplemental-source-review.mjs';

const normalise=text=>text.normalize('NFKC').replace(/[‘’]/gu,"'").replace(/[“”]/gu,'"')
 .replace(/\s+/gu,' ').trim().toLowerCase();

/** Exact overlap screening complements, rather than replaces, source review. */
export function auditEnglishExampleOverlap({reviews,sourceRows}){
 const active=reviews.filter(row=>!row.mergeWith&&!isEnglishReviewExcluded(row));
 const sentences=new Map();
 for(const row of active){
  const sentence=row.reviewedFields?.exampleText;
  if(typeof sentence!=='string'||!sentence.trim())throw new Error('Missing reviewed example: '+row.id);
  const key=normalise(sentence);if(!sentences.has(key))sentences.set(key,[]);sentences.get(key).push(row.id);
 }
 let sourceRowsScanned=0,sourceExamplesCompared=0,exactNormalisedMatches=0;
 const quotationOrUnclassifiedMatches=[];
 for(const source of sourceRows){
  if(source.row.lang_code&&source.row.lang_code!=='en')throw new Error('Non-English overlap source');
  sourceRowsScanned++;
  for(const [senseIndex,sense] of (source.row.senses||[]).entries()){
   for(const [exampleIndex,example] of (sense.examples||[]).entries()){
    if(typeof example.text!=='string')continue;sourceExamplesCompared++;
    const ids=sentences.get(normalise(example.text));if(!ids)continue;
    exactNormalisedMatches++;
    if(example.type!=='example'||example.ref)quotationOrUnclassifiedMatches.push({
     ids,word:source.word,sourceLine:source.sourceLine,rawLineSha256:source.rawLineSha256,
     senseIndex,exampleIndex,type:example.type||null,reference:example.ref||null,
    });
   }
  }
 }
 return {reviewedEntries:active.length,sourceRowsScanned,sourceExamplesCompared,exactNormalisedMatches,
  quotationOrUnclassifiedMatches,complete:!quotationOrUnclassifiedMatches.length,
  notice:'Exact normalised overlap screening of the verified English source-evidence cache, not copyright clearance for every possible external publication. New independently reviewed source-example bindings retain their own precise type, source and translation licence.'};
}
