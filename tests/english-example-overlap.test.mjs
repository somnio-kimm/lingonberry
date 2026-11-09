import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnglishExampleOverlap} from '../scripts/content/english-example-overlap.mjs';
const review={id:'example',verdict:'pass',reviewedFields:{exampleText:'She called it “absurd”.'}};
const source=example=>({word:'absurd',sourceLine:42,rawLineSha256:'a'.repeat(64),row:{lang_code:'en',senses:[{examples:[example]}]}});
test('a normalised publication-quotation match blocks clearance',()=>{
 const result=auditEnglishExampleOverlap({reviews:[review],sourceRows:[source({text:'She called it "absurd".',type:'quotation',ref:'A published book'})]});
 assert.equal(result.complete,false);
 assert.deepEqual(result.quotationOrUnclassifiedMatches[0].ids,['example']);
 assert.equal(result.quotationOrUnclassifiedMatches[0].sourceLine,42);
});
test('a contributor usage example remains a match without being treated as a quotation',()=>{
 const result=auditEnglishExampleOverlap({reviews:[review],sourceRows:[source({text:review.reviewedFields.exampleText,type:'example'})]});
 assert.equal(result.complete,true);assert.equal(result.exactNormalisedMatches,1);
 assert.equal(result.sourceExamplesCompared,1);
});
test('publication references and unclassified matches require review; retired examples are ignored',()=>{
 for(const example of [{text:review.reviewedFields.exampleText,type:'example',ref:'Publisher citation'},
  {text:review.reviewedFields.exampleText}]){
  assert.equal(auditEnglishExampleOverlap({reviews:[review],sourceRows:[source(example)]}).complete,false);
  assert.equal(auditEnglishExampleOverlap({reviews:[{...review,verdict:'exclude',excludedFromStudy:true}],sourceRows:[source(example)]}).complete,true);
 }
});
