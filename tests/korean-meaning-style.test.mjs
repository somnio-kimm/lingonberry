import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';
import {meaningStyleSourceDigest,auditKoreanMeaningStyle,compileNaturalKoreanPair} from '../scripts/content/korean-meaning-style.mjs';

function fixture(){
 const license={identifier:'CC-BY-SA-4.0',notice:'Original contributors and source credits.',links:[]};
 const core={schemaVersion:2,id:'ja-core',kind:'study',targetLanguage:'ja',version:'4.4.0',license,entries:[{id:'tomorrow',word:'明日',pronunciation:'みょうにち',partOfSpeech:'noun',level:'N5',example:{text:'明日、連絡します。'}},{id:'work',word:'作',pronunciation:'さく',partOfSpeech:'noun',level:'N5',example:{text:'これは友人の作です。'}},{id:'eye',word:'目',pronunciation:'め',partOfSpeech:'noun',level:'N5',example:{text:'目を閉じる。'}}]};
 const pair={schemaVersion:2,id:'ja-ko',kind:'explanation',targetLanguage:'ja',explanationLanguage:'ko',version:'4.5.0',studyVersion:'4.4.0',license,entries:[{id:'tomorrow',meaning:'명일',exampleTranslation:'내일 연락할게요.',provenance:{creator:'Original source'}},{id:'work',meaning:'작',exampleTranslation:'이것은 친구의 작품이에요.'},{id:'eye',meaning:'눈',exampleTranslation:'눈을 감는다.'}]};
 const english={...pair,id:'ja-en',explanationLanguage:'en',entries:pair.entries.map((row,i)=>({...row,meaning:['tomorrow','work; production','eye'][i],exampleTranslation:['I will contact you tomorrow.','This is my friend’s work.','Close your eyes.'][i]}))};
 const inputs=core.entries.map((row,index)=>{const source={index,id:row.id,word:row.word,reading:row.pronunciation,pos:row.partOfSpeech,level:row.level,en:english.entries[index].meaning,ko:pair.entries[index].meaning,earlierKo:'Original selected definition',example:row.example.text,exampleKo:pair.entries[index].exampleTranslation};return {...source,sourceDigest:meaningStyleSourceDigest(source)};});
 const decisions=inputs.map((row,i)=>({id:row.id,sourceDigest:row.sourceDigest,author:'a',action:i<2?'change':'retain',...(i<2?{meaning:['내일','작품'][i],reason:'Use an ordinary complete Korean equivalent.'}:{})}));
 const reviews=decisions.filter(row=>row.action==='change').map(row=>({id:row.id,sourceDigest:row.sourceDigest,decisionDigest:exampleDigest(row),reviewer:'b',verdict:'pass',notes:['Read exact source context and proposed Korean meaning.']}));
 return {core,pair,english,inputs,decisions,reviews,version:'4.6.0'};
}
test('natural Korean edition changes 명일/작 while preserving familiar short words, examples and source credits',()=>{
 const data=fixture(),before=structuredClone(data),result=compileNaturalKoreanPair(data);assert.equal(result.report.completeDecisionCoverage,true);assert.deepEqual(result.pair.entries.map(row=>row.meaning),['내일','작품','눈']);assert.equal(result.pair.studyVersion,'4.4.0');
 for(let i=0;i<data.pair.entries.length;i++){const {meaning,...entry}=result.pair.entries[i],{meaning:old,...original}=data.pair.entries[i];assert.deepEqual(entry,original);}
 assert.ok(result.pair.license.notice.endsWith(data.pair.license.notice));assert.deepEqual(data,before);
});
test('missing decisions, uncertain senses and unreviewed edits block a release',()=>{
 for(const change of [d=>d.decisions.pop(),d=>d.decisions[0].action='uncertain',d=>d.reviews=[]]){const data=fixture();change(data);if(data.decisions[0].action==='uncertain')delete data.decisions[0].meaning;assert.equal(auditKoreanMeaningStyle(data).completeDecisionCoverage,false);assert.throws(()=>compileNaturalKoreanPair(data),/complete decisions/);}
});
test('edited proposals invalidate older passes and authors cannot review their own changes',()=>{
 const data=fixture();data.decisions[0].meaning='다음 날';assert.deepEqual(auditKoreanMeaningStyle(data).unreviewedIds,['tomorrow']);data.reviews[0].reviewer='a';assert.throws(()=>auditKoreanMeaningStyle(data),/independent/);
});
test('changed source senses and attempts to edit other lexical fields fail closed',()=>{
 for(const change of [d=>d.inputs[0].ko='다른 뜻',d=>d.pair.entries[0].meaning='다른 뜻',d=>d.core.entries[0].pronunciation='あした']){const data=fixture();change(data);assert.throws(()=>compileNaturalKoreanPair(data),/stale package binding/);}
 const data=fixture();data.decisions[0].word='翌日';assert.throws(()=>auditKoreanMeaningStyle(data),/fields/);
});
test('a later same-hash pass cannot erase a semantic finding without explicit resolution',()=>{
 const data=fixture(),finding={...data.reviews[0],verdict:'revise',notes:['Check selected sense.']};data.reviews.unshift(finding);assert.equal(auditKoreanMeaningStyle(data).completeDecisionCoverage,false);data.reviews[1].resolves=[exampleDigest(finding)];data.reviews[1].notes=['Re-read this exact proposal and resolved the earlier concern.'];assert.equal(auditKoreanMeaningStyle(data).completeDecisionCoverage,true);
});
test('empty or non-Korean edits and silent changes hidden in retain decisions are rejected',()=>{
 for(const meaning of ['', 'tomorrow', ' 내일 ']){const data=fixture();data.decisions[0].meaning=meaning;assert.throws(()=>auditKoreanMeaningStyle(data),/explicit Korean/);}
 const data=fixture();data.decisions[2].meaning='시선';assert.throws(()=>auditKoreanMeaningStyle(data),/retained meaning/);
});
test('a declared single-editor pass reports its actual review method without inventing peer approval',()=>{
 const data=fixture();data.reviews=[];const {report}=compileNaturalKoreanPair({...data,independentReviewRequired:false});assert.equal(report.completeDecisionCoverage,true);assert.equal(report.independentReviewRequired,false);assert.equal(report.independentlyReviewedChanges,0);
 data.reviews=[{...fixture().reviews[0],verdict:'revise'}];assert.equal(auditKoreanMeaningStyle({...data,independentReviewRequired:false}).completeDecisionCoverage,false,'Existing semantic findings still block publication');
});
test('unchanged screened entries are counted separately and screening cannot approve a changed meaning',()=>{
 const data=fixture();data.decisions[2].assessment='screening';const report=auditKoreanMeaningStyle(data);
 assert.equal(report.assessed,3);assert.equal(report.reviewed,2);assert.equal(report.screenedRetained,1);assert.equal(report.completeDecisionCoverage,true);
 data.decisions[0].assessment='screening';assert.throws(()=>auditKoreanMeaningStyle(data),/screening cannot approve edits/);
});
