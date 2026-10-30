import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleDigest,exampleSourceBinding,auditReviewedExamples,compileReviewedExamples} from '../scripts/content/reviewed-examples.mjs';

function fixture(){
 const license={identifier:'CC-BY-SA-4.0',notice:'Credited original dictionary.',links:[]};
 const entry={id:'walk',word:'歩く',pronunciation:'あるく',partOfSpeech:'verb',level:'N5'};
 const core={schemaVersion:2,kind:'study',id:'ja-core',targetLanguage:'ja',version:'4.3.0',license,entries:[entry]};
 const pairs=['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:'ja-'+locale,targetLanguage:'ja',explanationLanguage:locale,version:'4.3.0',studyVersion:'4.3.0',license,entries:[{id:'walk',meaning:locale==='en'?'walk':'걷다'}]}));
 const input={id:'walk',word:'歩く',reading:'あるく',partOfSpeech:'verb',level:'N5',meaningEn:'walk',meaningKo:'걷다'};
 const record={id:'walk',text:'毎朝、公園を歩く。',en:'I walk in the park every morning.',ko:'나는 매일 아침 공원을 걷는다.',focus:{text:'歩く',start:6},provenance:{kind:'app-authored',license:'CC-BY-4.0',creator:'Lingonberry contributors',review:'AI-editorial-draft; native-speaker-review-pending'}};
 const review={id:'walk',recordSha256:exampleDigest(record),sourceBindingSha256:exampleDigest(exampleSourceBinding(input)),reviewer:'upper-b',verdict:'pass',notes:[]};
 return {core,pairs,inputs:[input],ownership:{walk:'lower'},authored:[record],reviews:[review],version:'4.4.0'};
}
test('canonical hashes bind field values independently of object order',()=>{
 assert.equal(exampleDigest({z:'歩く',a:{y:2,x:1}}),exampleDigest({a:{x:1,y:2},z:'歩く'}));
 assert.notEqual(exampleDigest({a:['en','ko']}),exampleDigest({a:['ko','en']}));
 assert.equal(exampleSourceBinding({...fixture().inputs[0],reading:undefined}).reading,null);
 assert.throws(()=>exampleDigest({missing:undefined}),/incomplete/);
});
test('a complete independently reviewed edition fills examples without changing meanings or stable words',()=>{
 const args=fixture(),before=structuredClone(args),{packages,report}=compileReviewedExamples(args);
 assert.equal(report.fullCoverage,true);assert.equal(report.independentlyReviewed,1);
 assert.equal(packages[0].entries[0].word,'歩く');assert.equal(packages[0].entries[0].example.text,args.authored[0].text);
 assert.equal(packages[1].entries[0].meaning,'walk');assert.equal(packages[2].entries[0].meaning,'걷다');
 assert.equal(packages[2].entries[0].exampleTranslation,'나는 매일 아침 공원을 걷는다.');
 const provenance=packages[0].entries[0].example.provenance;
 assert.equal(provenance.editorialReview.recordSha256,args.reviews[0].recordSha256);
 assert.deepEqual(provenance.editorialReview.reviewers,['upper-b']);assert.equal(provenance.editorialReview.nativeSpeakerReview,'pending');
 assert.deepEqual(args,before);
});
test('already published examples and translations remain byte-equivalent in the new edition',()=>{
 const args=fixture(),published={id:'read',word:'読む',partOfSpeech:'verb',level:'N5',example:{text:'本を読む。',provenance:{license:'CC-BY-4.0'}},additionalExamples:[{text:'新聞を読む。'}],exampleStatus:'editorial-draft'};
 args.core.entries.push(published);
 for(const pair of args.pairs)pair.entries.push({id:'read',meaning:pair.explanationLanguage==='en'?'read':'읽다',exampleTranslation:'Previously checked translation',additionalExampleTranslations:['Keep this too']});
 const {packages}=compileReviewedExamples(args);
 assert.deepEqual(packages[0].entries[1],published);
 for(let i=0;i<args.pairs.length;i++)assert.deepEqual(packages[i+1].entries[1],args.pairs[i].entries[1]);
});
for(const field of ['word','reading','partOfSpeech','level','meaningEn','meaningKo'])test(`stale ${field} cannot reuse an older sense review`,()=>{
 const args=fixture();args.inputs[0][field]='changed';assert.throws(()=>auditReviewedExamples(args),/Stale source binding/);
});
test('self-review and missing authors cannot satisfy independent review',()=>{
 const args=fixture();args.reviews[0].reviewer='lower';assert.throws(()=>auditReviewedExamples(args),/Independent/);
 args.reviews=[];delete args.ownership.walk;assert.throws(()=>auditReviewedExamples(args),/assigned author/);
});
test('editing either translation invalidates a prior pass',()=>{
 const args=fixture();args.authored[0].ko='나는 매일 저녁 공원을 걷는다.';
 const report=auditReviewedExamples(args);assert.equal(report.staleReviews,1);assert.deepEqual(report.unreviewedIds,['walk']);
 assert.throws(()=>compileReviewedExamples(args),/1 unreviewed/);
});
test('a changed source hash, missing review or unresolved finding blocks publication',()=>{
 for(const change of [args=>args.reviews=[],args=>args.reviews[0].sourceBindingSha256='0'.repeat(64),args=>args.reviews[0].verdict='revise',args=>args.reviews[0].verdict='uncertain']){
  const args=fixture();change(args);assert.equal(auditReviewedExamples(args).fullCoverage,false);assert.throws(()=>compileReviewedExamples(args),/not ready/);
 }
});
test('a fresh pass can replace the same reviewer’s finding, but another open finding cannot be hidden',()=>{
 const args=fixture();args.reviews.unshift({...args.reviews[0],verdict:'revise'});assert.equal(auditReviewedExamples(args).fullCoverage,true);
 args.reviews.push({...args.reviews[0],reviewer:'root',verdict:'uncertain'});assert.deepEqual(auditReviewedExamples(args).findings,['walk']);
});
test('partial drafting is reported without pretending to have full coverage',()=>{
 const args=fixture();args.authored=[];args.reviews=[];
 const report=auditReviewedExamples(args);assert.equal(report.target,1);assert.equal(report.drafted,0);assert.deepEqual(report.missingIds,['walk']);
 assert.throws(()=>compileReviewedExamples(args),/1 missing/);
 args.inputs=[];assert.throws(()=>auditReviewedExamples(args),/every currently missing/);
});
test('duplicate IDs, unknown examples, incomplete translations and implicit focus fail closed',()=>{
 for(const [change,pattern]of [
  [args=>args.authored.push(args.authored[0]),/Duplicate/],
  [args=>args.authored[0].id='unrelated',/outside completion scope/],
  [args=>delete args.authored[0].ko,/Missing ko/],
  [args=>delete args.authored[0].focus.start,/Explicit focus/],
  [args=>delete args.authored[0].provenance.creator,/creator/]
 ]){const args=fixture();change(args);assert.throws(()=>auditReviewedExamples(args),pattern);}
});
