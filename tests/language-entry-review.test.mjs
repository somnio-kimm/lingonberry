import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLanguageEntryReviews,resolveLanguageEntryDecision} from '../scripts/content/language-entry-review.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';
const input={id:'school',studyLanguage:'ja',sourceDigest:'bound-source',
 coreEntry:{id:'school',word:'学校',pronunciation:'がっこう',partOfSpeech:'noun',level:'N5',provenance:{license:'CC-BY-SA-4.0'},example:{text:'学校へ行きます。'}},
 englishExplanation:{id:'school',meaning:'school',exampleTranslation:'I go to school.'},
 koreanExplanation:{id:'school',meaning:'학교',meanings:['학교'],exampleTranslation:'학교에 가요.'}};
const fields={word:'学校',pronunciation:'がっこう',partOfSpeech:'noun',level:'N5',meaningEn:'school',meaningKo:'학교',exampleText:'学校へ行きます。',exampleTranslationEn:'I go to school.',exampleTranslationKo:'학교에 가요.'};
const pass={id:input.id,sourceDigest:input.sourceDigest,reviewer:'primary',verdict:'pass',reason:'Examined the reading, school sense and matching example/translations.',reviewedFields:fields};
const run=(decisions,crossReviews=[],extra={})=>auditLanguageEntryReviews({language:'ja',inputs:[input],decisions,crossReviews,...extra});
const approve=decision=>({id:decision.id,decisionDigest:exampleDigest(decision),reviewer:'independent',verdict:'approve',reason:'Personally checked the exact correction.'});

test('an individually retained complete entry is covered without inventing a revision',()=>{
 const result=run([pass]);assert.equal(result.report.complete,true);assert.equal(result.report.changed,0);
 assert.deepEqual(result.finalized[0].core.provenance,input.coreEntry.provenance);
});
test('missing, stale and duplicate reviews cannot count as full coverage',()=>{
 assert.deepEqual(run([]).report.remaining,['school']);
 assert.equal(run([{...pass,sourceDigest:'old'}]).report.complete,false);
 assert.equal(run([pass,pass]).report.errors.length,1);
});
test('real corrections require a second person and exact current decision binding',()=>{
 const correction={...pass,verdict:'revise',reviewedFields:{...fields,meaningKo:'학교; 교육 기관'}};
 assert.deepEqual(run([correction]).report.pendingIndependent,['school']);
 assert.equal(run([correction],[approve(correction)]).report.complete,true);
 assert.equal(run([correction],[{...approve(correction),reviewer:'primary'}]).report.complete,false);
 assert.equal(run([correction],[{...approve(correction),decisionDigest:'old'}]).report.complete,false);
 assert.deepEqual(resolveLanguageEntryDecision(input,correction).korean.meanings,['학교; 교육 기관']);
});
test('a pass cannot silently change the meaning or example',()=>{
 assert.equal(run([{...pass,reviewedFields:{...fields,exampleText:'これは病院です。'}}]).report.errors.length,1);
});

test('an independent rejection or source finding blocks even an unchanged primary pass',()=>{
 for(const verdict of ['reject','needs-source']){
  const result=run([pass],[{...approve(pass),verdict}]);
  assert.equal(result.report.complete,false);
  assert.deepEqual(result.report.pendingIndependent,['school']);
  if(verdict==='needs-source')assert.deepEqual(result.report.pendingSource,['school']);
  assert.equal(result.finalized.length,0);
 }
});
test('legacy reviewer-less decisions are accepted only by exact frozen decision digest',()=>{
 const legacy={...pass};delete legacy.reviewer;
 assert.equal(run([legacy]).report.complete,false);
 assert.equal(run([legacy],[],{legacyDecisions:[legacy]}).report.complete,true);
 assert.equal(run([{...legacy,reason:'Changed metadata'}],[],{legacyDecisions:[legacy]}).report.complete,false);
});
test('Chinese full-object proposals preserve grammar and official level evidence',()=>{
 const zh={...input,studyLanguage:'zh',coreEntry:{...input.coreEntry,word:'学校',pronunciation:'xuéxiào',level:'1',grammar:{officialNumber:42}}};
 const correction={id:zh.id,sourceDigest:zh.sourceDigest,reviewer:'primary',verdict:'corrected',reason:'Checked exact example tone notation.',
  proposedCoreEntry:{...zh.coreEntry,example:{text:'我去学校。',pronunciation:'wo3 qu4 xue2 xiao4'}},
  proposedEnglishExplanation:{...zh.englishExplanation,exampleTranslation:'I go to school.'},
  proposedKoreanExplanation:zh.koreanExplanation};
 const result=auditLanguageEntryReviews({language:'zh',inputs:[zh],decisions:[correction],crossReviews:[approve(correction)]});
 assert.equal(result.report.complete,true);assert.equal(result.finalized[0].core.grammar.officialNumber,42);
 const changed={...correction,proposedCoreEntry:{...correction.proposedCoreEntry,level:'2'}};
 assert.equal(auditLanguageEntryReviews({language:'zh',inputs:[zh],decisions:[changed]}).report.errors.length,1);
});
test('a source uncertainty remains pending without an evidenced independent closure',()=>{
 const uncertain={...pass,verdict:'needs-source',sourceIssues:['Reading needs verification.']};
 assert.deepEqual(run([uncertain],[approve(uncertain)]).report.pendingSource,['school']);
 const closure={...approve(uncertain),sourceResolution:{status:'resolved',reason:'Verified the exact reading in the primary source.',evidenceUrls:['https://example.org/source']}};
 assert.equal(run([uncertain],[closure]).report.complete,true);
});
test('additional example coverage cannot be inferred from reviewing the primary sentence',()=>{
 const expanded={...input,coreEntry:{...input.coreEntry,additionalExamples:[{text:'学校で会いました。'}]},
  englishExplanation:{...input.englishExplanation,additionalExampleTranslations:['We met at school.']},
  koreanExplanation:{...input.koreanExplanation,additionalExampleTranslations:['학교에서 만났어요.']}};
 assert.equal(run([pass],[],{inputs:[expanded]}).report.errors.length,1);
 assert.equal(run([{...pass,additionalExamplesReviewed:true}],[],{inputs:[expanded]}).report.complete,true);
});

test('newly introduced additional examples require their own review acknowledgement',()=>{
 const correction={...pass,verdict:'revise',proposedCoreEntry:{...input.coreEntry,additionalExamples:[{text:'学校で会いました。'}]},
  proposedEnglishExplanation:{...input.englishExplanation,additionalExampleTranslations:['We met at school.']},
  proposedKoreanExplanation:{...input.koreanExplanation,additionalExampleTranslations:['학교에서 만났어요.']}};
 const missing=run([correction],[approve(correction)]);
 assert.equal(missing.report.complete,false);assert.match(missing.report.errors[0].error,/explicit review/);
 const reviewed={...correction,additionalExamplesReviewed:true};
 const valid=run([reviewed],[approve(reviewed)]);
 assert.equal(valid.report.complete,true);
 assert.deepEqual(valid.finalized[0].english.additionalExampleTranslations,['We met at school.']);
 assert.deepEqual(valid.finalized[0].korean.additionalExampleTranslations,['학교에서 만났어요.']);
});

test('additional translations must be complete arrays in both explanation proposals',()=>{
 const correction={...pass,verdict:'revise',additionalExamplesReviewed:true,
  proposedCoreEntry:{...input.coreEntry,additionalExamples:[{text:'学校で会いました。'}]},
  proposedEnglishExplanation:{...input.englishExplanation,additionalExampleTranslations:['We met at school.']},
  proposedKoreanExplanation:{...input.koreanExplanation,additionalExampleTranslations:['학교에서 만났어요.']}};
 for(const field of ['proposedEnglishExplanation','proposedKoreanExplanation'])for(const translations of [undefined,[],[''],['one','two'],{en:['We met at school.'],ko:['학교에서 만났어요.']}]){
  const broken={...correction,[field]:{...correction[field],additionalExampleTranslations:translations},
   additionalExampleTranslations:{en:['We met at school.'],ko:['학교에서 만났어요.']}};
  if(translations===undefined)delete broken[field].additionalExampleTranslations;
  const result=run([broken],[approve(broken)]);
  assert.equal(result.report.complete,false);assert.equal(result.report.reviewed,0);assert.equal(result.finalized.length,0);
  assert.match(result.report.errors[0].error,/additional example translations/);
 }
});

test('blank additional sentences and orphaned translations cannot be finalized',()=>{
 for(const examples of [null,{},[{text:' '}],[{}]]){
  const broken={...pass,verdict:'revise',additionalExamplesReviewed:true,
   proposedCoreEntry:{...input.coreEntry,additionalExamples:examples}};
  assert.throws(()=>resolveLanguageEntryDecision(input,broken),/additional examples/);
 }
 const orphan={...pass,proposedKoreanExplanation:{...input.koreanExplanation,additionalExampleTranslations:['학교에서 만났어요.']}};
 assert.throws(()=>resolveLanguageEntryDecision(input,orphan),/Korean additional example translations/);
});

test('a newly recorded source finding cannot disappear behind an older approval',()=>{
 const finding={id:input.id,sourceDigest:input.sourceDigest,reason:'Borrowed example has no verified authorship binding.'};
 const closure={...approve(pass),sourceResolution:{status:'resolved',reason:'Verified the exact source example.',
  evidenceUrls:['https://example.org/credit'],findingDigests:[exampleDigest(finding)]}};
 assert.equal(run([pass],[approve(pass)],{sourceFindings:[finding]}).report.complete,false);
 assert.equal(run([pass],[closure],{sourceFindings:[finding]}).report.complete,true);
 const newFinding={...finding,reason:'A second quotation claim requires a fresh review.'};
 assert.equal(run([pass],[closure],{sourceFindings:[finding,newFinding]}).report.complete,false);
 assert.throws(()=>run([pass],[],{sourceFindings:[{...finding,sourceDigest:'old'}]}),/stale/);
});

test('verified dictionary content with unresolved teaching scope is distinct from a source problem',()=>{
 const flagged={...pass,usageIssues:['A second official POS has a different learning level.']};
 const pending=run([flagged],[approve(flagged)]);
 assert.deepEqual(pending.report.pendingUsage,['school']);assert.deepEqual(pending.report.pendingSource,[]);
 assert.equal(pending.report.complete,false);
 const closed={...approve(flagged),usageResolution:{status:'resolved',reason:'Both official usages retained with their separate POS and level scope.'}};
 assert.equal(run([flagged],[closed]).report.complete,true);
});

test('invalid cross-review closures cannot hide pending source or usage issues',()=>{
 const flagged={...pass,verdict:'needs-source',sourceIssues:['Conflicting reading sources.'],usageIssues:['Selected reading needs a matching teaching context.']};
 const closure={...approve(flagged),
  sourceResolution:{status:'resolved',reason:'Checked the old example and source.',evidenceUrls:['https://example.org/source']},
  usageResolution:{status:'resolved',reason:'Checked the old teaching context.'}};
 for(const invalid of [
  {...closure,decisionDigest:'previous-decision'},
  {...closure,reviewer:flagged.reviewer},
  {...closure,reason:''},
 ]){
  const result=run([flagged],[invalid]);
  assert.deepEqual(result.report.pendingSource,['school']);
  assert.deepEqual(result.report.pendingUsage,['school']);
  assert.deepEqual(result.report.pendingIndependent,['school']);
  assert.equal(result.report.errors.length,1);
  assert.equal(result.report.complete,false);
  assert.equal(result.finalized.length,0);
 }
});

test('a stale approval cannot hide an external source finding on an unchanged entry',()=>{
 const finding={id:input.id,sourceDigest:input.sourceDigest,reason:'New evidence needs an independent source check.'};
 const stale={...approve(pass),decisionDigest:'previous-decision',sourceResolution:{status:'resolved',
  reason:'Checked a previous decision.',evidenceUrls:['https://example.org/source'],findingDigests:[exampleDigest(finding)]}};
 const result=run([pass],[stale],{sourceFindings:[finding]});
 assert.deepEqual(result.report.pendingSource,['school']);
 assert.deepEqual(result.report.pendingIndependent,['school']);
 assert.equal(result.report.complete,false);
 assert.equal(result.finalized.length,0);
});

test('independent material source and usage holds block an otherwise complete primary pass',()=>{
 for(const kind of ['source','usage']){
  const cross={...approve(pass),[kind+'Resolution']:{status:'unresolved',required:true,reason:'A material teaching or source scope remains open.'}};
  const result=run([pass],[cross]);
  assert.deepEqual(result.report[kind==='source'?'pendingSource':'pendingUsage'],['school']);
  assert.deepEqual(result.report.pendingScopeClassification,[]);assert.equal(result.report.complete,false);assert.equal(result.finalized.length,0);
  cross[kind+'Resolution']={status:'resolved',required:true,reason:'Independently established the exact bounded scope.',...(kind==='source'?{evidenceUrls:['https://example.org/primary-source']}:{})};
  assert.equal(run([pass],[cross]).report.complete,true);
 }
});

test('independent observations need explicit classification and cannot silently finalise as material holds',()=>{
 for(const kind of ['source','usage']){
  const cross={...approve(pass),[kind+'Resolution']:{status:'unresolved',reason:'Baseline not runtime-certified; no concrete content uncertainty was found.'}};
  const result=run([pass],[cross]);
  assert.deepEqual(result.report.pendingScopeClassification,[{id:'school',kind}]);
  assert.equal(result.report.complete,false);assert.equal(result.finalized.length,0);
  const observation={...cross,[kind+'Resolution']:{...cross[kind+'Resolution'],required:false}};
  assert.equal(run([pass],[observation]).report.complete,true);
  observation[kind+'Resolution'].reason='';assert.equal(run([pass],[observation]).report.complete,false);
 }
});

test('observation labels cannot waive primary issues or explicit independent issue lists',()=>{
 for(const kind of ['source','usage']){
  const note={status:'unresolved',required:false,reason:'A non-material observation only.'};
  const primary={...pass,[kind+'Issues']:['Actual unresolved content scope.']};
  assert.deepEqual(run([primary],[{...approve(primary),[kind+'Resolution']:note}]).report[kind==='source'?'pendingSource':'pendingUsage'],['school']);
  const independent={...approve(pass),[kind+'Issues']:['Actual independent content uncertainty.'],[kind+'Resolution']:note};
  assert.deepEqual(run([pass],[independent]).report[kind==='source'?'pendingSource':'pendingUsage'],['school']);
 }
});

test('stale independent material holds remain pending and malformed scope declarations cannot pass',()=>{
 const cross={...approve(pass),decisionDigest:'old',sourceResolution:{status:'unresolved',required:true,reason:'Exact source unresolved.'},usageResolution:{status:'unresolved',required:true,reason:'Exact practice scope unresolved.'}};
 const stale=run([pass],[cross]);assert.deepEqual(stale.report.pendingSource,['school']);assert.deepEqual(stale.report.pendingUsage,['school']);assert.deepEqual(stale.report.pendingIndependent,['school']);assert.equal(stale.report.complete,false);
 for(const changes of [{usageIssues:'not-a-list'},{usageResolution:null},{sourceResolution:{status:'unresolved',required:'false'}}]){
  const result=run([pass],[{...approve(pass),...changes}]);assert.equal(result.report.complete,false);assert.equal(result.finalized.length,0);assert.match(result.report.errors[0].error,/Malformed/);
 }
});

test('inherited neutral and topic generators remain an example-quality backlog despite approvals',()=>{
 for(const generation of ['original-neutral-context-frame-v1','original-topic-context-v1']){
  const inherited={...input,coreEntry:{...input.coreEntry,example:{text:fields.exampleText,source:{generation}}}};
  const cross={...approve(pass),exampleQualityResolution:{required:false,status:'resolved',reason:'Grammar and translation match.'}};
  const result=run([pass],[cross],{inputs:[inherited]});
  assert.equal(result.report.reviewed,1);assert.deepEqual(result.report.remaining,[]);
  assert.deepEqual(result.report.pendingExampleQuality,['school']);
  assert.deepEqual(result.report.pendingSource,[]);assert.equal(result.report.complete,false);assert.equal(result.finalized.length,0);
 }
});
test('a neutral additional example cannot hide behind a useful primary example',()=>{
 const inherited={...input,coreEntry:{...input.coreEntry,additionalExamples:[{text:'今日の話題は学校です。',source:{generation:'original-topic-context-v1'}}]},
  englishExplanation:{...input.englishExplanation,additionalExampleTranslations:["Today's topic is school."]},
  koreanExplanation:{...input.koreanExplanation,additionalExampleTranslations:['오늘의 주제는 학교입니다.']}};
 const primary={...pass,additionalExamplesReviewed:true};
 const result=run([primary],[approve(primary)],{inputs:[inherited]});
 assert.deepEqual(result.report.pendingExampleQuality,['school']);assert.equal(result.finalized.length,0);
});
test('a useful replacement with truthful original-context provenance still needs its fresh independent approval',()=>{
 const inherited={...input,coreEntry:{...input.coreEntry,example:{text:'今日の話題は学校です。',source:{generation:'original-neutral-context-frame-v1'}}},
  englishExplanation:{...input.englishExplanation,exampleTranslation:"Today's topic is school."},
  koreanExplanation:{...input.koreanExplanation,exampleTranslation:'오늘의 주제는 학교입니다.'}};
 const correction={...pass,verdict:'revise',proposedCoreEntry:{...input.coreEntry,example:{text:fields.exampleText,source:{kind:'app-authored',generation:'original-authored-context-v1'}}}};
 assert.deepEqual(run([correction],[],{inputs:[inherited]}).report.pendingIndependent,['school']);
 const result=run([correction],[approve(correction)],{inputs:[inherited]});
 assert.deepEqual(result.report.pendingExampleQuality,[]);assert.equal(result.report.complete,true);
});
test('explicit primary and independent example-quality findings require their own valid closure',()=>{
 for(const primary of [pass,{...pass,exampleQualityIssues:['The target sense is not demonstrated.']}]){
  const cross={...approve(primary),exampleQualityResolution:{required:true,status:'unresolved',reason:'The example does not demonstrate the selected sense.'}};
  const pending=run([primary],[cross]);
  assert.deepEqual(pending.report.pendingExampleQuality,['school']);assert.deepEqual(pending.report.pendingSource,[]);assert.equal(pending.finalized.length,0);
  cross.exampleQualityResolution={required:true,status:'resolved',reason:'Independently checked that the actual example demonstrates the selected school sense.'};
  assert.equal(run([primary],[cross]).report.complete,true);
  const stale={...cross,decisionDigest:'previous'};
  assert.deepEqual(run([primary],[stale]).report.pendingExampleQuality,['school']);
  assert.equal(run([primary],[{...cross,reviewer:'primary'}]).report.complete,false);
 }
});
test('example-quality observations cannot waive actual issue lists or malformed declarations',()=>{
 const note={required:false,status:'unresolved',reason:'Simple short examples can still be useful.'};
 const primary={...pass,exampleQualityIssues:['Actual missing target-sense context.']};
 assert.deepEqual(run([primary],[{...approve(primary),exampleQualityResolution:note}]).report.pendingExampleQuality,['school']);
 const independent={...approve(pass),exampleQualityIssues:['Actual missing target-sense context.'],exampleQualityResolution:note};
 assert.deepEqual(run([pass],[independent]).report.pendingExampleQuality,['school']);
 assert.equal(run([pass],[{...approve(pass),exampleQualityResolution:note}]).report.complete,true);
 const unclassified={...approve(pass),exampleQualityResolution:{status:'unresolved',reason:'Needs classification.'}};
 assert.deepEqual(run([pass],[unclassified]).report.pendingScopeClassification,[{id:'school',kind:'exampleQuality'}]);
 for(const changes of [{exampleQualityIssues:'not-a-list'},{exampleQualityResolution:null},{exampleQualityResolution:{required:'false',status:'resolved',reason:'Malformed.'}}]){
  assert.equal(run([pass],[{...approve(pass),...changes}]).report.complete,false);
 }
 assert.match(run([{...pass,exampleQualityIssues:'not-a-list'}]).report.errors[0].error,/Example quality/);
});

test('retired records preserve historical examples while independent/source/migration gates still apply',()=>{
 const inherited={...input,coreEntry:{...input.coreEntry,example:{text:fields.exampleText,source:{generation:'original-neutral-context-frame-v1'}}}};
 const retirement={...pass,verdict:'retire',reason:'Retire a duplicate learner card while preserving its exact original history.',exampleQualityIssues:['Historical example was a generic frame.']};
 const cross={...approve(retirement),exampleQualityResolution:{required:true,status:'unresolved',reason:'Historical example remains unchanged.'}};
 const result=run([retirement],[cross],{inputs:[inherited]});
 assert.equal(result.report.complete,true);assert.deepEqual(result.report.pendingExampleQuality,[]);
 assert.equal(result.finalized[0].verdict,'retire');assert.deepEqual(result.finalized[0].core.example,inherited.coreEntry.example);
 assert.deepEqual(run([retirement],[],{inputs:[inherited]}).report.pendingIndependent,['school']);
 assert.equal(run([retirement],[{...cross,decisionDigest:'previous'}],{inputs:[inherited]}).report.complete,false);
 for(const kind of ['source','usage']){
  const held={...retirement,[kind+'Issues']:['Retirement source or migration scope remains unresolved.']};
  const pending=run([held],[{...cross,decisionDigest:exampleDigest(held)}],{inputs:[inherited]});
  assert.deepEqual(pending.report[kind==='source'?'pendingSource':'pendingUsage'],['school']);
  assert.equal(pending.report.complete,false);assert.equal(pending.finalized.length,0);
 }
 assert.equal(run([retirement],[{...cross,exampleQualityResolution:null}],{inputs:[inherited]}).report.complete,false);
});
