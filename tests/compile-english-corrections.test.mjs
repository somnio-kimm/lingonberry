import test from 'node:test';
import assert from 'node:assert/strict';
import {compileEnglishCorrections,decisionDigest} from '../scripts/content/compile-english-corrections.mjs';
import {prepareEnglishReview} from '../scripts/content/english-meaning-review.mjs';
import {createReviewContentPolicy} from '../web/js/shared/review-content.js';
import {assembleStudy} from '../web/js/packages/study.js';
const evidence=[{creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',url:'https://en.wiktionary.org/wiki/spin',historyUrl:'https://en.wiktionary.org/w/index.php?title=spin&action=history',snapshotSha256:'a'.repeat(64),sourceRowDigest:'b'.repeat(64),sourceLine:1,senseOrdinal:1,glosses:['Intrinsic angular momentum.']}];
function fixture(){
 const core={schemaVersion:2,kind:'study',id:'en-core',targetLanguage:'en',version:'3.0.0',license:{identifier:'CC-BY-SA-4.0',notice:'Original source provenance and attribution.'},exam:{id:'ielts'},entries:[
  {id:'spin',word:'spin',partOfSpeech:'noun',level:'8.0',provenance:{kind:'licensed-adaptation'},referenceExamples:[{text:'The old example.',source:{url:'https://en.wiktionary.org/wiki/spin',license:'CC-BY-SA-4.0'}}]},
  {id:'blacksmith',word:'blacksmith',partOfSpeech:'noun',level:'8.0',provenance:{kind:'licensed-adaptation'},aliases:['bad old alias']},
  {id:'many',word:'many',partOfSpeech:'determiner',level:'1.0',provenance:{kind:'app-authored'}},
  {id:'duplicate-many',word:'many',partOfSpeech:'determiner',level:'1.0',provenance:{kind:'licensed-adaptation'}},
 ]};
 const pairs=['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:'en-'+locale,targetLanguage:'en',explanationLanguage:locale,version:'3.0.0',studyVersion:'3.0.0',license:core.license,entries:core.entries.map(row=>({id:row.id,meaning:locale==='en'?'Old meaning.':'이전 뜻.'}))}));
 const prepared=prepareEnglishReview(core,pairs[0],pairs[1]);
 const review=prepared.map(row=>({index:row.index,id:row.id,digest:row.digest,status:row.id==='many'?'accepted':'correction-proposed',issues:row.id==='many'?[]:['meaning'],reason:'Test review finding.',proposed:row.id==='many'?{}:{en:'New meaning.'}}));
 const base=index=>({index,id:prepared[index].id,digest:prepared[index].digest,reason:'Verified correction to the selected sense.',evidence});
 const decisions=[{...base(0),decision:'correct',en:'Intrinsic angular momentum of a particle.',ko:'입자의 고유한 각운동량.'},{...base(1),decision:'replace',en:'A person who makes things from iron.',ko:'쇠를 다루어 물건을 만드는 사람.'},{...base(3),decision:'retire',duplicateOf:'many'}];
 return {core,pairs,review,decisions,sourceValidation:{checked:decisions.length,decisionDigest:decisionDigest(decisions),failures:[]},version:'4.0.0'};
}
test('corrections preserve concepts, replace invalid senses with new IDs and retire duplicates explicitly',()=>{
 const data=fixture(),before=structuredClone(data),result=compileEnglishCorrections(data),[core,en,ko]=result.packages;
 assert.deepEqual(data,before);assert.equal(core.entries.length,3);assert.equal(core.entries[0].id,'spin');assert.notEqual(core.entries[1].id,'blacksmith');assert.equal(core.entries[2].id,'many');
 assert.equal(core.entries[1].aliases,undefined);assert.equal(core.retiredEntries.find(row=>row.id==='blacksmith').replacementId,core.entries[1].id);assert.equal(core.retiredEntries.find(row=>row.id==='duplicate-many').replacementId,'many');assert.equal(core.retiredEntries.find(row=>row.id==='duplicate-many').sameConcept,true);assert.equal(core.retiredEntries.find(row=>row.id==='blacksmith').sameConcept,undefined);
 assert.equal(en.entries[0].meaning,data.decisions[0].en);assert.equal(ko.entries[0].meaning,data.decisions[0].ko);assert.deepEqual(en.entries.map(row=>row.id),core.entries.map(row=>row.id));
 assert.equal(core.entries[0].level,'IELTS 8.5–9.0');assert.equal(core.entries[0].provenance.license,'CC-BY-SA-4.0');
 const policy=createReviewContentPolicy(assembleStudy(core,en));assert.equal(policy.isCurrent({word:{id:'spin'}}),false);assert.equal(policy.isCurrent({word:{id:'blacksmith'}}),false);assert.equal(policy.isCurrent({word:{id:'many'}}),true);
});
for(const [name,change] of [
 ['missing decision',data=>{data.decisions.pop();data.sourceValidation.checked=data.decisions.length;data.sourceValidation.decisionDigest=decisionDigest(data.decisions);}],
 ['unresolved hold',data=>{data.decisions[0].decision='hold';data.sourceValidation.decisionDigest=decisionDigest(data.decisions);}],
 ['stale evidence report',data=>{data.decisions[0].en='Changed after source validation.';}],
 ['same version',data=>{data.version='3.0.0';}],
])test('correction build rejects '+name,()=>{const data=fixture();change(data);assert.throws(()=>compileEnglishCorrections(data));});
test('valid spelling variants can be aliases, but old errors are not automatically accepted',()=>{
 const data=fixture();data.decisions[0].word='new spelling';data.sourceValidation.decisionDigest=decisionDigest(data.decisions);
 assert.equal(compileEnglishCorrections(data).packages[0].entries[0].aliases,undefined);
 data.decisions[0].retainOldSpellingAlias=true;data.sourceValidation.decisionDigest=decisionDigest(data.decisions);
 assert.deepEqual(compileEnglishCorrections(data).packages[0].entries[0].aliases,['spin']);
});

test('sense replacement refuses to reuse an example for the old concept',()=>{
 const data=fixture();data.core.entries[1].example={text:'The workshop is open.'};
 data.pairs[0].entries[1].exampleTranslation='The workshop is open.';data.pairs[1].entries[1].exampleTranslation='작업장이 열려 있다.';
 const updated=prepareEnglishReview(data.core,data.pairs[0],data.pairs[1]);data.review[1].digest=updated[1].digest;data.decisions[1].digest=updated[1].digest;data.sourceValidation.decisionDigest=decisionDigest(data.decisions);
 assert.throws(()=>compileEnglishCorrections(data),/replacement examples need explicit re-authoring/);
});

test('retiring a verified spelling duplicate preserves its alias on the surviving concept',()=>{
 const data=fixture();data.decisions[2].aliases=['many-variant'];data.sourceValidation.decisionDigest=decisionDigest(data.decisions);
 const {packages,report}=compileEnglishCorrections(data);assert.deepEqual(packages[0].entries.find(row=>row.id==='many').aliases,['many-variant']);assert.ok(packages[0].reviewInvalidations.some(row=>row.id==='many'));assert.equal(report.aliasMerges[0].to,'many');
});

test('correction package output is deterministic when decision files are reordered',()=>{
 const data=fixture(),expected=compileEnglishCorrections(data);data.decisions.reverse();assert.deepEqual(compileEnglishCorrections(data),expected);
});
