import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSourceResolutions} from '../scripts/content/source-resolution-review.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';

const input={id:'bank',sourceDigest:'bound-source',englishMeaning:'A place for keeping money.'};
const resolution={...input,disposition:'corrected',researchReason:'The dictionary supports the financial institution sense.',
 evidenceUrls:['https://example.com/dictionary/bank'],resolved:{
  word:'bank',partOfSpeech:'noun',englishMeaning:'A financial institution.',meaning:'은행',
  exampleText:'The bank approved the loan.',exampleTranslation:'은행이 대출을 승인했다.',
  proposedLevel:'IELTS 1.0–3.5',levelRationale:'Common everyday money sense.',
 }};
const cross=verdict=>({id:'bank',resolutionDigest:exampleDigest(resolution),reviewer:'cross-reviewer',verdict});
const audit=options=>auditSourceResolutions({inputs:[input],resolutions:[resolution],...options});

test('an independently passed exact source resolution closes its flag',()=>{
 assert.equal(audit({crossReviews:[cross('pass')]}).report.complete,true);
 assert.equal(audit({crossReviews:[]}).report.complete,false);
});
test('a disputed resolution closes only after a final independent adjudication binds both records',()=>{
 const review={...cross('revise'),reviewReason:'Clarify the sentence.'};
 const final={id:'bank',originalResolutionDigest:exampleDigest(resolution),crossReviewDigest:exampleDigest(review),
  reviewer:'final-reviewer',adjudicationVerdict:'accept-cross-review',reason:'The correction and sense were independently checked.',
  finalResolution:structuredClone(resolution)};
 assert.equal(audit({crossReviews:[review]}).report.complete,false);
 assert.equal(audit({crossReviews:[review],finalDecisions:[final]}).report.complete,true);
 assert.equal(audit({crossReviews:[{...review,reviewReason:'Changed finding'}],finalDecisions:[final]}).report.complete,false);
 assert.equal(audit({crossReviews:[review],finalDecisions:[{...final,reviewer:review.reviewer}]}).report.complete,false);
});
test('final claims cannot bypass missing bilingual fields or changed source identities',()=>{
 const review=cross('revise');
 const final={id:'bank',originalResolutionDigest:exampleDigest(resolution),crossReviewDigest:exampleDigest(review),
  reviewer:'final-reviewer',adjudicationVerdict:'accept-cross-review',reason:'Checked correction.',
  finalResolution:{...resolution,resolved:{...resolution.resolved,exampleTranslation:''}}};
 assert.equal(audit({crossReviews:[review],finalDecisions:[final]}).report.complete,false);
 final.finalResolution={...resolution,sourceDigest:'different-source'};
 assert.equal(audit({crossReviews:[review],finalDecisions:[final]}).report.complete,false);
});
test('retiring an unsupported sense requires evidence and keeps its original identity',()=>{
 const retired={...input,disposition:'retire-unsupported',resolved:null,
  evidenceUrls:['https://example.com/source'],researchReason:'The source assertion lacks attestation after review.'};
 const report=auditSourceResolutions({inputs:[input],resolutions:[retired],
  crossReviews:[{id:'bank',reviewer:'independent',verdict:'pass',resolutionDigest:exampleDigest(retired)}]});
 assert.equal(report.report.complete,true);
 assert.equal(report.finalized[0].resolution.id,'bank');
 assert.equal(report.finalized[0].resolution.resolved,null);
});
