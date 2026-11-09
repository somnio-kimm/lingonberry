import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {assembleReviewedEnglishEntries,loadReviewedEnglishSnapshot,englishDefinitionFieldsDigest,auditEnglishDefinitionSourceCorrections,auditEnglishExampleSourceCorrections} from '../scripts/content/english-reviewed-entries.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';
const authored={kind:'app-authored',creator:'Lingonberry contributors',license:'CC-BY-4.0'};
const dictionary={url:'https://en.wiktionary.org/wiki/bank#English',creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0'};
const fields={word:'bank',partOfSpeech:'noun',meaningEn:'A financial institution that holds money.',meaningKo:'은행',
 exampleText:'She deposited the money at the bank.',exampleTranslation:'그녀는 은행에 돈을 예금했다.'};
const money={id:'bank-money',verdict:'revise',reviewedFields:fields,proposedLevel:'IELTS 1.0–3.5',levelRationale:'Everyday financial institution.'};
const river={id:'bank-river',verdict:'add',reviewedFields:{...fields,meaningEn:'The land alongside a river.',meaningKo:'강둑',
 exampleText:'They rested on the bank beside the river.',exampleTranslation:'그들은 강가의 둑에서 쉬었다.'},
 proposedLevel:'IELTS 4.0–6.5',levelRationale:'Common landscape meaning, separate from finance.',proposal:{sourceIds:[money.id]}};
function fixture(extra=[]){
 const reviews=[structuredClone(money),...structuredClone(extra)];
 return {audit:{complete:true,expected:reviews.length,reviewed:reviews.length},reviews,inputs:reviews.map(r=>({id:r.id})),version:'7.0.0',
  baselineCore:{entries:[{id:money.id,word:fields.word,partOfSpeech:fields.partOfSpeech,level:money.proposedLevel,
   provenance:dictionary,example:{text:fields.exampleText,source:authored}}]},
  baselineEnglish:{entries:[{id:money.id,meaning:fields.meaningEn,provenance:dictionary}]},
  baselineKorean:{entries:[{id:money.id,meaning:fields.meaningKo,exampleTranslation:fields.exampleTranslation}]}};
}

test('each meaning gets matching English/Korean rows and its own level and example',()=>{
 const args=fixture([river]),result=assembleReviewedEnglishEntries(args);
 assert.deepEqual(result.entries.map(r=>[r.id,r.level,r.example.text]),[
  [money.id,money.proposedLevel,fields.exampleText],[river.id,river.proposedLevel,river.reviewedFields.exampleText],
 ]);
 assert.deepEqual(result.englishEntries.map(r=>r.id),result.koreanEntries.map(r=>r.id));
 assert.equal(result.koreanEntries[1].meaning,'강둑');assert.equal(result.koreanEntries[1].exampleTranslation,river.reviewedFields.exampleTranslation);
 assert.equal(result.englishEntries[1].exampleTranslation,river.reviewedFields.exampleText);
 assert.equal(result.entries[1].provenance.sources[0].url,dictionary.url);
 assert.equal(result.entries[1].example.source.license,'CC-BY-4.0');
 result.entries[0].provenance.sources[0].creator='Changed';assert.equal(args.baselineCore.entries[0].provenance.creator,dictionary.creator);
});

test('unreviewed reference and additional examples never leak into learner content',()=>{
 const args=fixture();args.baselineCore.entries[0].referenceExamples=[{text:'Unreviewed research quotation.'}];
 args.baselineCore.entries[0].additionalExamples=[{text:'An old unreviewed sentence.'}];
 const entry=assembleReviewedEnglishEntries(args).entries[0];
 assert.equal(entry.referenceExamples,undefined);assert.equal(entry.additionalExamples,undefined);
 assert.equal(entry.example.text,fields.exampleText);
});

test('new dictionary-derived proposals retain their definition and exact example attribution',()=>{
 const args=fixture([river]);
 args.reviews[1].proposal={origins:[{candidate:{definitionSource:dictionary,
  exampleText:river.reviewedFields.exampleText,exampleSource:dictionary}}]};
 const result=assembleReviewedEnglishEntries(args);
 assert.equal(result.entries[1].provenance.license,'CC-BY-SA-4.0');
 assert.ok(result.entries[1].provenance.sources.some(source=>source.url===dictionary.url));
 assert.equal(result.entries[1].example.source.url,dictionary.url);
 assert.equal(result.koreanEntries[1].exampleTranslationProvenance.license,'CC-BY-SA-4.0');
 args.reviews[1].proposal.origins[0].candidate.exampleText='A different unretained source sentence.';
 assert.equal(assembleReviewedEnglishEntries(args).entries[1].example.source.kind,'app-authored');
 args.reviews[1].proposal.origins[0].candidate.definitionSource={...dictionary,license:'CC-BY-NC-4.0'};
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Unreviewed definition licence/);
});

test('the exact legacy original-authorship declaration is normalised while unknown source strings fail',()=>{
 const args=fixture([river]);
 args.reviews[1].proposal={origins:[{candidate:{exampleText:river.reviewedFields.exampleText,
  exampleSource:'Original Lingonberry editorial bilingual example.'}}]};
 assert.equal(assembleReviewedEnglishEntries(args).entries[1].example.source.license,'CC-BY-4.0');
 args.reviews[1].proposal.origins[0].candidate.exampleSource='Copied from an unknown dictionary.';
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Missing definition licence/);
});

test('reviewed source correction replaces a wrong proposal sense and binds the exact lexical fields',()=>{
 const args=fixture([river]);
 args.reviews[1].proposal={origins:[{candidate:{definitionSource:{...dictionary,sourceLine:20,senseIndex:0}}}]};
 args.reviews[1].sourceVerification={requiresDefinitionSourceCorrection:true};
 assert.equal(auditEnglishDefinitionSourceCorrections(args.reviews).complete,false);
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Unapplied reviewed definition source correction/);
 const corrected={...dictionary,sourceLine:19,senseIndex:1};
 args.reviews[1].definitionSource=corrected;
 args.reviews[1].definitionSourceFieldsDigest=englishDefinitionFieldsDigest(args.reviews[1].reviewedFields);
 assert.deepEqual(auditEnglishDefinitionSourceCorrections(args.reviews),{expected:1,resolved:1,errors:[],complete:true});
 const sources=assembleReviewedEnglishEntries(args).entries[1].provenance.sources;
 assert.ok(sources.some(source=>source.sourceLine===19));
 assert.ok(!sources.some(source=>source.sourceLine===20));
 args.reviews[1].reviewedFields.meaningEn='A different meaning that needs another source check.';
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Stale reviewed definition source correction/);
});

test('only an exact sentence attribution binding supplies source and translation licence',()=>{
 const args=fixture();args.attributionBindings=[{id:money.id,exampleText:fields.exampleText,exampleTextDigest:exampleDigest(fields.exampleText),
  sourceExampleType:'example',source:dictionary,koreanTranslationProvenance:{kind:'licensed-adaptation',license:'CC-BY-SA-4.0',source:dictionary}}];
 const result=assembleReviewedEnglishEntries(args);
 assert.equal(result.entries[0].example.source.url,dictionary.url);
 assert.equal(result.koreanEntries[0].exampleTranslationProvenance.license,'CC-BY-SA-4.0');
 const revised=structuredClone(args);revised.reviews[0].reviewedFields.exampleText='The bank opened a new branch yesterday.';
 revised.reviews[0].reviewedFields.exampleTranslation='그 은행은 어제 새 지점을 열었다.';
 assert.equal(assembleReviewedEnglishEntries(revised).entries[0].example.source.license,'CC-BY-4.0');
 args.attributionBindings[0].sourceExampleType='quotation';
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Publication quotation/);
});

test('licensed usage examples retain ShareAlike in Korean and source credit in the English self-pair',()=>{
 const args=fixture([river]);
 const candidate={exampleText:river.reviewedFields.exampleText,exampleSource:{...dictionary,sourceExampleType:'example'},
  exampleTranslationSource:authored};
 args.reviews[1].proposal={origins:[{candidate}]};
 assert.throws(()=>assembleReviewedEnglishEntries(args),/translation must retain the source ShareAlike/);
 candidate.exampleTranslationSource={kind:'licensed-adaptation',creator:authored.creator,license:'CC-BY-SA-4.0',source:dictionary};
 const result=assembleReviewedEnglishEntries(args);
 assert.equal(result.koreanEntries[1].exampleTranslationProvenance.license,'CC-BY-SA-4.0');
 assert.equal(result.englishEntries[1].exampleTranslationProvenance.url,dictionary.url);
 candidate.exampleSource.sourceExampleType='quotation';
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Uncleared quotation/);
});

test('reviewed example metadata overrides remove misleading licence claims and bind the exact sentence',()=>{
 const args=fixture([river]),row=args.reviews[1];
 row.proposal={origins:[{candidate:{exampleText:row.reviewedFields.exampleText,
  exampleSource:{...dictionary,translationSource:authored}}}]};
 assert.throws(()=>assembleReviewedEnglishEntries(args),/ShareAlike/);
 row.sourceVerification={requiresExampleSourceCorrection:true};
 assert.equal(auditEnglishExampleSourceCorrections(args.reviews).complete,false);
 row.exampleSource={...dictionary,sourceExampleType:'example'};
 row.exampleSourceTextDigest=exampleDigest(row.reviewedFields.exampleText);
 row.exampleTranslationSource={kind:'licensed-adaptation',creator:authored.creator,license:'CC-BY-SA-4.0',source:dictionary};
 assert.deepEqual(auditEnglishExampleSourceCorrections(args.reviews),{expected:1,resolved:1,errors:[],complete:true});
 const entry=assembleReviewedEnglishEntries(args).entries[1];
 assert.equal(entry.example.source.translationSource,undefined);
 row.reviewedFields.exampleText='The riverbank was flooded after the storm.';
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Stale reviewed example source correction/);
});

test('reviewed equivalences migrate progress and search forms; invalid concepts never do',()=>{
 const duplicate={id:'banks-duplicate',verdict:'revise',mergeWith:money.id,reviewedFields:{...fields,word:'banks'},reason:'Ordinary plural of the same financial noun.'};
 const invalid={id:'bad-bank',verdict:'retire',mergeWith:money.id,reason:'Incorrect source identity must not transfer mastery.'};
 const args=fixture([duplicate,invalid]);args.baselineCore.entries.push(
  {id:duplicate.id,word:'banks',partOfSpeech:'noun'},
  {id:invalid.id,word:'a-wrong-source-form',partOfSpeech:'noun'},
 );args.invalidConceptIds=[invalid.id];
 const result=assembleReviewedEnglishEntries(args);
 assert.deepEqual(result.retiredEntries.find(r=>r.id===duplicate.id),{id:duplicate.id,reason:duplicate.reason,replacementId:money.id,sameConcept:true});
 assert.equal(result.retiredEntries.find(r=>r.id===invalid.id).replacementId,undefined);
 assert.ok(result.entries[0].aliases.includes('banks'));assert.ok(!result.entries[0].aliases.includes('a-wrong-source-form'));
 assert.deepEqual(result.entries[0].listeningAliases,[]);
});

test('new reused proposals contribute searchable forms and only explicitly verified listening spellings',()=>{
 const args=fixture([
  {id:'us-spelling',verdict:'reuse',mergeWith:money.id,proposal:{word:'center'},aliases:['center'],listeningAliases:['center']},
  {id:'plural-form',verdict:'reuse',mergeWith:money.id,proposal:{word:'centres'}},
 ]);
 const f={word:'centre',partOfSpeech:'noun',meaningEn:'The middle point or part of something.',meaningKo:'중심',
  exampleText:'The square is in the centre of the town.',exampleTranslation:'그 광장은 마을 중심에 있다.'};
 args.reviews[0].reviewedFields=f;
 Object.assign(args.baselineCore.entries[0],{word:f.word,example:{text:f.exampleText,source:authored}});
 args.baselineEnglish.entries[0].meaning=f.meaningEn;
 Object.assign(args.baselineKorean.entries[0],{meaning:f.meaningKo,exampleTranslation:f.exampleTranslation});
 const entry=assembleReviewedEnglishEntries(args).entries[0];
 assert.deepEqual(entry.aliases,['center','centres']);
 assert.deepEqual(entry.listeningAliases,['center']);
});

test('unchanged words retain prior review boundaries while changed homograph inventories refresh affected questions',()=>{
 const args=fixture();args.baselineCore.reviewInvalidations=[{id:money.id,minimumVersion:'5.0.0'}];
 assert.deepEqual(assembleReviewedEnglishEntries(args).reviewInvalidations,[{id:money.id,minimumVersion:'5.0.0'}]);
 args.reviews.push(structuredClone(river));args.inputs.push({id:river.id});args.audit.expected=args.audit.reviewed=2;
 assert.deepEqual(assembleReviewedEnglishEntries(args).reviewInvalidations,[{id:money.id,minimumVersion:'7.0.0'}]);
});

test('incomplete, circular or untranslated records cannot enter a completed edition',()=>{
 const incomplete=fixture();incomplete.audit.complete=false;assert.throws(()=>assembleReviewedEnglishEntries(incomplete),/incomplete/);
 for(const change of [{meaningEn:'bank'},{meaningKo:'bank'},{exampleTranslation:'English placeholder.'},{exampleText:''}]){
  const args=fixture();Object.assign(args.reviews[0].reviewedFields,change);
  assert.throws(()=>assembleReviewedEnglishEntries(args),/Circular|Missing Korean|Incomplete reviewed/);
 }
 const unknown=fixture();unknown.inputs.push({id:'unreviewed'});unknown.audit.expected=unknown.audit.reviewed=2;
 assert.throws(()=>assembleReviewedEnglishEntries(unknown),/coverage changed/);
});

test('known invalid concepts cannot reactivate and aliases cannot terminate in excluded records',()=>{
 const args=fixture();args.invalidConceptIds=[money.id];assert.throws(()=>assembleReviewedEnglishEntries(args),/invalid concept/);
 const alias=fixture([{id:'alias',verdict:'revise',mergeWith:'missing'}]);
 assert.throws(()=>assembleReviewedEnglishEntries(alias),/Inactive semantic replacement/);
});

test('loading a release snapshot requires complete audit and exact bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'english-reviewed-'));
 try{
  const report=join(dir,'audit.json'),records=join(dir,'records.jsonl'),body=JSON.stringify(money)+'\n';
  const sha=createHash('sha256').update(body).digest('hex');await writeFile(records,body);
  await writeFile(report,JSON.stringify({complete:false,effectiveReviewSha256:sha}));
  await assert.rejects(loadReviewedEnglishSnapshot(report,records),/incomplete/);
  await writeFile(report,JSON.stringify({complete:true,effectiveReviewSha256:sha}));
  assert.equal((await loadReviewedEnglishSnapshot(report,records)).reviews[0].id,money.id);
  await writeFile(records,body+'\n');await assert.rejects(loadReviewedEnglishSnapshot(report,records),/does not match/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('older Korean ShareAlike source credit survives the compatible adaptation and unreviewed licences block assembly',()=>{
 const args=fixture(),source={creator:'National Institute of Korean Language',license:'CC-BY-SA-2.0-KR',url:'https://krdict.korean.go.kr/'};
 args.baselineCore.entries[0].provenance={kind:'licensed-equivalent-adaptation',source,adaptationLicense:'CC-BY-SA-4.0'};
 args.baselineEnglish.entries[0].provenance=source;
 const provenance=assembleReviewedEnglishEntries(args).entries[0].provenance;
 assert.equal(provenance.license,'CC-BY-SA-4.0');
 assert.ok(provenance.sources.some(item=>item.source?.license==='CC-BY-SA-2.0-KR'));
 args.baselineEnglish.entries[0].provenance={creator:'Other',license:'CC-BY-NC-4.0'};
 assert.throws(()=>assembleReviewedEnglishEntries(args),/Unreviewed definition licence/);
});
