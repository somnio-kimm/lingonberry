import test from 'node:test';
import assert from 'node:assert/strict';
import {compileReviewedEnglishPractice,englishGapPracticeDigest} from '../scripts/content/english-reviewed-practice.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';
import {validateExercises} from '../web/js/packages/exercises.js';
import {createSentenceEngine} from '../web/js/shared/lexicon-sentences.js';
const fields={word:'tell off',partOfSpeech:'verb',meaningEn:'To scold someone.',meaningKo:'꾸짖다',
 exampleText:'The teacher told him off.',exampleTranslation:'선생님은 그를 꾸짖었다.'};
const entry={id:'tell-off',word:fields.word,partOfSpeech:fields.partOfSpeech,example:{text:fields.exampleText}};
const review={id:entry.id,reviewedFields:fields,gapFill:{parts:['The teacher ',' him ','.'],answers:['told','off']}};

test('reviewed split gaps preserve the intervening object and align both explanation packs',()=>{
 const output=compileReviewedEnglishPractice({entries:[entry],reviews:[review]});
 assert.equal(output.exercises[0].prompt,'The teacher ___ him ___.');
 assert.equal(output.exercises[0].answer,'told … off');
 assert.equal(output.englishExercises[0].context,'To scold someone.');
 assert.equal(output.koreanExercises[0].context,'꾸짖다');
 validateExercises({kind:'study',targetLanguage:'en',entries:output.entries,exercises:output.exercises});
 assert.equal(output.entries[0].example.focus,undefined);
 assert.equal(output.report.unresolved.length,1);
});

test('an exact approved surface span becomes the example focus without changing its text',()=>{
 const focus={start:12,text:'told'};
 const output=compileReviewedEnglishPractice({entries:[entry],reviews:[review],focusDecisions:[{
  id:entry.id,focus,reviewer:'independent-editor',reason:'Verified past-tense verb in this exact sentence.',
  exampleTextDigest:exampleDigest(fields.exampleText),
 }]});
 assert.deepEqual(output.entries[0].example.focus,focus);
 assert.equal(output.entries[0].example.text,fields.exampleText);
 assert.equal(entry.example.focus,undefined);
});

test('stale focus decisions and unreconstructible gaps fail closed',()=>{
 assert.throws(()=>compileReviewedEnglishPractice({entries:[entry],reviews:[review],focusDecisions:[{
  id:entry.id,focus:{start:12,text:'told'},reviewer:'editor',reason:'Checked.',exampleTextDigest:'old',
 }]}),/Unbound focus/);
 assert.throws(()=>compileReviewedEnglishPractice({entries:[entry],reviews:[{...review,
  gapFill:{parts:['The teacher ',' him ','.'],answers:['tell','off']},
 }]}),/Invalid reviewed gaps/);
});

test('a bound integration approval enables Scramble while reserving Cloze for the separate gaps',()=>{
 const args={entries:[{...entry,example:{...entry.example,practiceEligible:false}}],reviews:[review]};
 assert.equal(compileReviewedEnglishPractice(args).entries[0].example.practiceEligible,false);
 const approval={id:entry.id,reviewDigest:englishGapPracticeDigest(review),reviewer:'integration-editor',
  reason:'Verified separate-gap controls; the full original sentence is eligible for Scramble.'};
 const result=compileReviewedEnglishPractice({...args,gapPracticeApprovals:[approval]});
 assert.equal(result.entries[0].example.practiceEligible,undefined);
 assert.equal(result.entries[0].example.clozeEligible,false);
 const words=[{id:entry.id,lemma:entry.word,pos:'verb',studyMeaning:fields.meaningEn,
  examples:[{...result.entries[0].example,studyTranslation:fields.exampleTranslation}]}];
 const engine=createSentenceEngine({id:'en'});
 assert.equal(engine.createSentencePool('scramble',words,'ko').all().length,1);
 assert.equal(engine.createSentencePool('cloze',words,'ko').all().length,0);
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapPracticeApprovals:[{...approval,reviewDigest:'old'}]}),/Unbound gap practice/);
 const changedReview={...review,gapFill:{parts:['The teacher told ',' off.'],answers:['him']}};
 assert.throws(()=>compileReviewedEnglishPractice({...args,reviews:[changedReview],gapPracticeApprovals:[approval]}),/Unbound gap practice/);
});

const semanticReview={id:entry.id,reviewedFields:fields};
const gapDecision={id:entry.id,exampleTextDigest:exampleDigest(fields.exampleText),gapFill:review.gapFill,
 reviewer:'gap-editor',reason:'Keep him visible between the attested past verb and particle.'};
const separateApproval={id:entry.id,reviewDigest:englishGapPracticeDigest(review),
 reviewer:'practice-reviewer',reason:'Checked the exact gaps against the unchanged sense and sentence.'};

test('separate reviewed gaps compile bilingual exercises without rewriting the completed sense record',()=>{
 const original=structuredClone(semanticReview);
 assert.equal(englishGapPracticeDigest(semanticReview,gapDecision.gapFill),separateApproval.reviewDigest);
 const result=compileReviewedEnglishPractice({entries:[entry],reviews:[semanticReview],
  gapDecisions:[gapDecision],gapPracticeApprovals:[separateApproval]});
 assert.deepEqual(semanticReview,original);
 assert.equal(result.entries[0].example.text,'The teacher told him off.');
 assert.equal(result.entries[0].example.clozeEligible,false);
 assert.equal(result.exercises[0].prompt,'The teacher ___ him ___.');
 assert.deepEqual(result.exercises[0].gapFill.answers,['told','off']);
 assert.equal(result.englishExercises[0].context,'To scold someone.');
 assert.equal(result.koreanExercises[0].context,'꾸짖다');
 validateExercises({kind:'study',targetLanguage:'en',entries:result.entries,exercises:result.exercises});
});

test('separate gap decisions require exact sentence binding, valid gaps and a current practice approval',()=>{
 const args={entries:[entry],reviews:[semanticReview],gapDecisions:[gapDecision],gapPracticeApprovals:[separateApproval]};
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapPracticeApprovals:[]}),/Unapproved gap practice/);
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapDecisions:[{...gapDecision,exampleTextDigest:'old'}]}),/Unbound gap decision/);
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapDecisions:[{...gapDecision,gapFill:{...review.gapFill,answers:['tell','off']}}]}),/Invalid reviewed gaps/);
 const different={parts:['The teacher told ',' off.'],answers:['him']};
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapDecisions:[{...gapDecision,gapFill:different}]}),/Unbound gap practice/);
 const changedSense={...semanticReview,reviewedFields:{...fields,meaningKo:'꾸짖어 바로잡다'}};
 assert.throws(()=>compileReviewedEnglishPractice({...args,reviews:[changedSense]}),/Unbound gap practice/);
});

test('separate gap decisions reject duplicate, unknown and conflicting embedded records',()=>{
 const args={entries:[entry],reviews:[semanticReview],gapDecisions:[gapDecision],gapPracticeApprovals:[separateApproval]};
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapDecisions:[gapDecision,gapDecision]}),/Duplicate gap decision/);
 assert.throws(()=>compileReviewedEnglishPractice({...args,gapDecisions:[{...gapDecision,id:'unknown'}],gapPracticeApprovals:[]}),/Unknown gap decision/);
 const conflict={...semanticReview,gapFill:{parts:['The teacher told ',' off.'],answers:['him']}};
 assert.throws(()=>compileReviewedEnglishPractice({...args,reviews:[conflict]}),/Conflicting gap decisions/);
});
