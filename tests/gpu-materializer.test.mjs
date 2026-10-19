import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assembleGpuEntry,queueContentDigest as digest} from '../scripts/content/materialize-gpu-content.mjs';
import {validateReviewedEntry} from '../scripts/content/complete-matrix.mjs';
import {STUDY_LANGUAGES,allowsExplanation} from '../web/js/shared/language-pairs.js';

const words={de:'Buch',en:'book',es:'libro',fr:'livre',ja:'本',ko:'책',zh:'书'};
const meanings={de:'ein Werk zum Lesen',en:'a written work for reading',es:'obra escrita para leer',fr:'ouvrage écrit à lire',ja:'読むための書物',ko:'읽기 위한 저작물',zh:'供阅读的著作'};
const app={kind:'app-authored',creator:'Learn Language contributors',license:'CC-BY-4.0'};
const external={kind:'licensed-source',creator:'Dictionary contributors',license:'CC-BY-SA-2.0-KR',url:'https://dictionary.example/entry/book'};
const clone=value=>JSON.parse(JSON.stringify(value));
const locales=language=>STUDY_LANGUAGES.filter(l=>allowsExplanation(language,l));
const codes=result=>result.blocked.map(x=>x.code);
function fixture(language='ja'){
 const entry={id:language+'-book',word:words[language],partOfSpeech:'noun',provenance:clone(app)};
 const translations=Object.fromEntries(locales(language).map(l=>[l,words[l]+'.']));
 const example={text:words[language]+'.',focus:{text:words[language]},provenance:clone(app),translations};
 const evidence={original:clone(entry),meanings:Object.fromEntries(locales(language).map(l=>[l,{text:meanings[l],provenance:clone(app)}])),
  examples:[example],authored:{id:entry.id,text:example.text,translations:clone(translations),provenance:clone(app)},installed:{},meaningCandidates:{},generation_revision:'test'};
 return {entry,evidence,checkedResults:[],studyLanguage:language};
}
function makeJob(envelope,{id=1,task='meaning',locale='de',output={text:meanings[locale]},index=-1,parent=null,sourceExample=null,sourceDigest=null,dependencies=[]}={}){
 const entryDigest=digest({entry:envelope.entry,evidence:envelope.evidence});
 const payload={task,entryId:envelope.entry.id,studyLanguage:envelope.studyLanguage,target_language:locale,example_index:index,
  entry_digest:entryDigest,source_digest:sourceDigest??entryDigest,dependency_job_ids:dependencies};
 if(task==='example_translation')Object.assign(payload,{text:sourceExample.text,source_example:clone(sourceExample),source_digest:sourceDigest??digest(sourceExample),source_job_id:parent});
 const output_digest=digest(output);
 return {job:{id,task,locale,example_index:index,study_language:envelope.studyLanguage,entry_id:envelope.entry.id,payload,input_hash:digest(payload),status:'checked'},
  output:clone(output),output_digest,producer:{role:'local-draft',model:'same-local-model',revision:'pinned-r1'},
  reviewer:{role:'local-review',model:'same-local-model',revision:'pinned-r1'},
  review:{contentDigest:output_digest,review:{verdict:'pass',issues:[]},nativeSpeakerReview:'pending',method:'same-model-AI-review'}};
}
function missingTranslation(envelope,locale='de'){
 delete envelope.evidence.examples[0].translations[locale];delete envelope.evidence.authored.translations[locale];
}
function nativeDraftFixture(language='ja'){
 const e=fixture(language);e.evidence.examples=[];e.evidence.authored={};
 const output={text:words[language]+'.',focus:{text:words[language]},uncertainties:[]};
 const parent=makeJob(e,{id:10,task:'native_example',locale:language,index:0,output});
 e.checkedResults.push(parent);
 for(const [i,l]of locales(language).filter(l=>l!==language).entries())e.checkedResults.push(makeJob(e,{id:20+i,task:'example_translation',locale:l,index:0,output:{text:words[l]+'.'},parent:10,sourceExample:output,dependencies:[10]}));
 return e;
}

test('all seven source languages materialise exactly the 43 allowed pairs without a fabricated review',()=>{
 let pairs=0;
 for(const language of STUDY_LANGUAGES){
  const e=fixture(language),before=clone(e),result=assembleGpuEntry(e);
  assert.deepEqual(result.blocked,[]);assert.equal(result.linguisticApproval,false);assert.equal(result.reviewStatus,'needs-assembled-review');
  assert.equal(result.requiredExplanationPairs,43);assert.equal(result.record.id,e.entry.id);assert.ok(!('review' in result.record));
  assert.equal(Object.keys(result.record.meanings).length,locales(language).length);pairs+=Object.keys(result.record.meanings).length;
  assert.deepEqual(result.record.lexical,e.entry);assert.deepEqual(e,before);
  assert.throws(()=>validateReviewedEntry(result.record,e.entry,language),/explicit AI editorial review/);
 }
 assert.equal(pairs,43);
});

test('missing definitions and translations block the entry rather than returning a partial complete record',()=>{
 const e=fixture();delete e.evidence.meanings.de;missingTranslation(e,'fr');
 const result=assembleGpuEntry(e);assert.ok(codes(result).includes('missing_meaning'));assert.ok(codes(result).includes('missing_translation'));assert.equal(result.record,undefined);
});

test('checked generated definitions retain exact candidate licensing or mark licensed adaptations',()=>{
 for(const modified of [false,true]){
  const e=fixture();delete e.evidence.meanings.de;
  e.evidence.meaningCandidates.de={text:'Buch zum Lesen',provenance:clone(external),source_digest:'licensed-snapshot',accepted:false};
  const job=makeJob(e,{output:{text:modified?'Ein geschriebenes Werk zum Lesen.':'Buch zum Lesen'},sourceDigest:'licensed-snapshot'});
  job.job.payload.candidate=clone(e.evidence.meaningCandidates.de);job.job.input_hash=digest(job.job.payload);e.checkedResults=[job];
  const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);
  const p=r.record.meanings.de.provenance;assert.equal(p.kind,modified?'licensed-adaptation':'licensed-source');assert.equal(p.license,modified?'CC-BY-SA-4.0':'CC-BY-SA-2.0-KR');assert.equal(p.url,external.url);
  if(modified)assert.deepEqual(p.sources[0],external);
 }
});

test('model-supplied provenance and approval fields never become authoritative',()=>{
 const e=fixture();delete e.evidence.meanings.de;e.checkedResults=[makeJob(e,{output:{text:meanings.de,provenance:{kind:'app-authored',creator:'invented',license:'CC0-1.0'},review:{status:'checked'},approved:true}})];
 const result=assembleGpuEntry(e);assert.deepEqual(result.blocked,[]);assert.equal(result.record.meanings.de.provenance.license,'CC-BY-4.0');assert.notEqual(result.record.meanings.de.provenance.creator,'invented');assert.ok(!('review' in result.record));
});

test('checked native drafts and dependent translations form complete candidates; English self pair is copied',()=>{
 for(const language of ['ja','en']){
  const e=nativeDraftFixture(language),result=assembleGpuEntry(e);assert.deepEqual(result.blocked,[]);
  assert.equal(result.record.examples[0].provenance.kind,'app-authored');assert.equal(result.record.examples[0].provenance.license,'CC-BY-4.0');
  if(language==='en')assert.equal(result.record.examples[0].translations.en.text,result.record.examples[0].text);
 }
});

test('modified licensed sentence translations retain source and share-alike attribution',()=>{
 const e=fixture();e.evidence.examples[0].provenance=clone(external);e.evidence.authored.provenance=clone(external);missingTranslation(e);
 e.checkedResults=[makeJob(e,{task:'example_translation',locale:'de',index:0,sourceExample:e.evidence.examples[0],output:{text:'Ein Buch.'}})];
 const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);assert.equal(r.record.examples[0].translations.de.provenance.kind,'licensed-adaptation');assert.equal(r.record.examples[0].translations.de.provenance.license,'CC-BY-SA-4.0');assert.equal(r.record.examples[0].translations.de.provenance.url,external.url);
});

test('stale identity, payload, candidate and review digests block materialisation',()=>{
 for(const [expected,damage]of [
  ['job_identity_mismatch',j=>{j.job.entry_id='other';}],['stale_entry_digest',j=>{j.job.payload.entry_digest='old';}],
  ['input_digest_mismatch',j=>{j.job.payload.word='other';}],['output_digest_mismatch',j=>{j.output.text='Changed.';}],
  ['invalid_field_review',j=>{j.review.contentDigest='old';}],['unchecked_job',j=>{j.job.status='draft';}],
  ['invalid_producer_binding',j=>{j.reviewer.role='local-draft';}],['invalid_review_claim',j=>{j.review.nativeSpeakerReview='checked';}],
 ]){
  const e=fixture();delete e.evidence.meanings.de;const j=makeJob(e);damage(j);e.checkedResults=[j];const r=assembleGpuEntry(e);assert.ok(codes(r).includes(expected),JSON.stringify(r));assert.equal(r.record,undefined);
 }
});

test('missing dependencies, changed native outputs and dependency cycles cannot pass',()=>{
 const missing=nativeDraftFixture();missing.checkedResults=missing.checkedResults.filter(x=>x.job.id!==10);assert.ok(codes(assembleGpuEntry(missing)).includes('unchecked_dependency'));
 const changed=nativeDraftFixture();const child=changed.checkedResults[1];child.job.payload.source_job_id=99;child.job.input_hash=digest(child.job.payload);assert.ok(codes(assembleGpuEntry(changed)).includes('native_dependency_changed'));
 const cycle=nativeDraftFixture();const parent=cycle.checkedResults[0];parent.job.payload.dependency_job_ids=[cycle.checkedResults[1].job.id];parent.job.input_hash=digest(parent.job.payload);assert.ok(codes(assembleGpuEntry(cycle)).includes('dependency_cycle'));
});

test('translation source must match the exact existing source-example snapshot',()=>{
 const e=fixture();missingTranslation(e);const j=makeJob(e,{task:'example_translation',locale:'de',index:0,sourceExample:e.evidence.examples[0],output:{text:'Ein Buch.'}});
 j.job.payload.source_example.text='別の文章。';j.job.payload.text='別の文章。';j.job.input_hash=digest(j.job.payload);e.checkedResults=[j];assert.ok(codes(assembleGpuEntry(e)).includes('translation_source_changed'));
 j.job.payload.source_digest=digest(j.job.payload.source_example);j.job.input_hash=digest(j.job.payload);assert.ok(codes(assembleGpuEntry(e)).includes('installed_example_changed'));
});

test('disallowed self pairs, duplicate checked fields and silent overwrites are blocked',()=>{
 const e=fixture();e.checkedResults=[makeJob(e,{task:'example_translation',locale:'ja',index:0,sourceExample:e.evidence.examples[0],output:{text:'本。'}})];assert.ok(codes(assembleGpuEntry(e)).includes('disallowed_pair'));
 const duplicate=fixture();delete duplicate.evidence.meanings.de;duplicate.checkedResults=[makeJob(duplicate),makeJob(duplicate,{id:2})];assert.ok(codes(assembleGpuEntry(duplicate)).includes('duplicate_checked_field'));
 const overwrite=fixture();overwrite.checkedResults=[makeJob(overwrite)];assert.ok(codes(assembleGpuEntry(overwrite)).includes('existing_meaning_collision'));
});

test('trusted corrections must already be applied, and ambiguous focus remains blocked',()=>{
 const e=fixture();e.evidence.correction={id:e.entry.id,word:'別の語'};assert.ok(codes(assembleGpuEntry(e)).includes('unapplied_correction'));
 const ambiguous=fixture('en');ambiguous.evidence.examples[0].text='book and book';delete ambiguous.evidence.examples[0].focus;ambiguous.evidence.authored.text='book and book';ambiguous.evidence.examples[0].translations.en='book and book';assert.ok(codes(assembleGpuEntry(ambiguous)).includes('unresolved_focus'));
});

test('legacy app-editorial credit migration retains licence and original source notices',()=>{
 const e=fixture('zh');const legacy={kind:'app-editorial',license:'CC-BY-SA-4.0',changes:'Original Chinese example and translations prepared for learn_chinese; target pronunciation follows the official syllabus.'};
 e.evidence.examples[0].provenance=clone(legacy);e.evidence.authored.provenance=clone(legacy);
 const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);const p=r.record.examples[0].provenance;
 assert.equal(p.kind,'app-authored');assert.equal(p.creator,'Learn Language contributors');assert.equal(p.license,'CC-BY-SA-4.0');assert.equal(p.changes,legacy.changes);assert.equal(p.attributionMigration.packageUrl,'/language-packages/zh-core-2.0.0.json');assert.equal(p.attributionMigration.originalCredit,'learn_chinese contributors');
 const externalMissing=fixture();externalMissing.evidence.meanings.de.provenance={kind:'licensed-source',license:'CC-BY-SA-4.0',url:'https://dict.example/word'};
 assert.ok(codes(assembleGpuEntry(externalMissing)).includes('missing_valid_attribution'));
});

test('Tatoeba Chinese, English and Korean attribution remains distinct',()=>{
 const e=fixture('zh');const source={kind:'tatoeba',license:'CC-BY-2.0-FR',chinese:{id:100,author:'Chinese author'},english:{id:200,author:'English author'},changes:'Chinese simplified; English directly linked.',koreanTranslation:{creator:'learn_chinese contributors',license:'CC-BY-SA-4.0'}};
 e.evidence.examples[0].provenance=source;e.evidence.authored={};
 for(const l of locales('zh'))e.evidence.installed[l]={exampleTranslation:e.evidence.examples[0].translations[l]};
 // Real legacy data contains EN/KO; extra locale maps here carry explicit attribution.
 for(const l of ['de','es','fr','ja'])e.evidence.examples[0].translations[l]={text:words[l]+'.',provenance:clone(app)};
 const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);const x=r.record.examples[0];
 assert.equal(x.provenance.creator,'Chinese author');assert.equal(x.translations.en.provenance.creator,'English author');assert.equal(x.translations.en.provenance.url,'https://tatoeba.org/en/sentences/show/200');assert.equal(x.translations.ko.provenance.license,'CC-BY-SA-4.0');assert.equal(x.translations.ko.provenance.creator,'learn_chinese contributors');assert.equal(x.translations.de.provenance.creator,app.creator);
});

function canonical(value){return Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);}
const rawHash=value=>createHash('sha256').update(value).digest('hex');
test('exact exported Python JSON preserves integral-float digest identity',()=>{
 const e=fixture();e.entry.frequency=1;missingTranslation(e);e.evidence.examples[0].confidence=1;
 e.entryJson=canonical(e.entry).replace('"frequency":1','"frequency":1.0');e.evidenceJson=canonical(e.evidence).replace('"confidence":1','"confidence":1.0');
 e.entryDigest=rawHash('{"entry":'+e.entryJson+',"evidence":'+e.evidenceJson+'}');
 const j=makeJob(e,{task:'example_translation',locale:'de',index:0,sourceExample:e.evidence.examples[0],output:{text:'Ein Buch.',confidence:1}});
 j.job.payload.entry_digest=e.entryDigest;j.sourceExampleJson=canonical(j.job.payload.source_example).replace('"confidence":1','"confidence":1.0');j.job.payload.source_digest=rawHash(j.sourceExampleJson);
 j.payloadJson=canonical(j.job.payload).replace('"confidence":1','"confidence":1.0');j.job.input_hash=rawHash(j.payloadJson);
 j.outputJson=canonical(j.output).replace('"confidence":1','"confidence":1.0');j.output_digest=rawHash(j.outputJson);j.review.contentDigest=j.output_digest;e.checkedResults=[j];
 assert.notEqual(e.entryDigest,digest({entry:e.entry,evidence:e.evidence}));assert.deepEqual(assembleGpuEntry(e).blocked,[]);
 e.entry.word='違う';assert.ok(codes(assembleGpuEntry(e)).includes('non_json_envelope'));
});

test('placeholder text and missing CJK script block otherwise checked records',()=>{
 for(const [locale,text,expected]of [['fr','TODO','invalid_text'],['ko','English only','missing_language_script']]){
  const e=fixture();e.evidence.meanings[locale].text=text;assert.ok(codes(assembleGpuEntry(e)).includes(expected));
 }
});

test('explicit invalid source attribution never falls back to unrelated app credit',()=>{
 for(const field of ['example','meaning','candidate']){
  const e=fixture();const bad={kind:'licensed-source',license:'CC-BY-NC-4.0',creator:'Other author',url:'https://dict.example/word'};
  if(field==='example')e.evidence.examples[0].provenance=bad;
  if(field==='meaning')e.evidence.meanings.de.provenance=bad;
  if(field==='candidate'){
   delete e.evidence.meanings.de;e.evidence.meaningCandidates.de={text:'Buch',provenance:bad,source_digest:'source'};
   e.checkedResults=[makeJob(e,{output:{text:'Buch'},sourceDigest:'source'})];
  }
  const r=assembleGpuEntry(e);assert.equal(r.record,undefined);assert.ok(codes(r).includes('missing_valid_attribution'),JSON.stringify(r));
 }
});

test('legacy sense corrections use their matched entry source and retain declared adaptation licence',()=>{
 const e=fixture();e.entry.provenance={kind:'licensed-equivalent-adaptation',source:clone(external)};
 e.evidence.correction={id:e.entry.id,meaningEn:'A corrected written work.',provenance:{kind:'editorial-sense-correction',license:'CC-BY-SA-4.0'}};
 e.evidence.meanings.en={text:e.evidence.correction.meaningEn,origin:'editorial-correction',provenance:e.evidence.correction.provenance};
 const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);const p=r.record.meanings.en.provenance;
 assert.equal(p.kind,'licensed-adaptation');assert.equal(p.license,'CC-BY-SA-4.0');assert.equal(p.url,external.url);
 e.evidence.meanings.en.text='Unmatched replacement';assert.ok(codes(assembleGpuEntry(e)).includes('missing_valid_attribution'));
});

test('German installed attribution wrappers preserve original MIT credits',()=>{
 const e=fixture('de');e.evidence.meanings.en.provenance={source:'app-editorial',attribution:{kind:'app-editorial',creator:'learn_german contributors',license:'MIT',created:'2026-10-08'}};
 const r=assembleGpuEntry(e);assert.deepEqual(r.blocked,[]);const p=r.record.meanings.en.provenance;
 assert.equal(p.license,'MIT');assert.equal(p.creator,'learn_german contributors');assert.equal(p.created,'2026-10-08');assert.equal(p.kind,'app-authored');
});

test('malformed or unresolved author uncertainty cannot become an assembled candidate',()=>{
 for(const uncertainty of [['The sense is unclear.'],{issue:'Wrong sense.'},null]){
  const e=fixture();delete e.evidence.meanings.de;e.checkedResults=[makeJob(e,{output:{text:meanings.de,uncertainties:uncertainty}})];
  const r=assembleGpuEntry(e);assert.ok(codes(r).includes('unresolved_author_change'));assert.equal(r.record,undefined);
 }
});

test('non-model licensed imports require exact candidate text, provenance and snapshot binding',()=>{
 const e=fixture();delete e.evidence.meanings.de;
 const candidate={text:'Buch',provenance:clone(external),source_digest:'source-digest',source_snapshot_sha256:'a'.repeat(64),accepted:false};e.evidence.meaningCandidates.de=candidate;
 const j=makeJob(e,{output:{text:'Buch',provenance:{...external,kind:'licensed-source'}},sourceDigest:candidate.source_digest});
 j.job.payload.candidate=clone(candidate);j.job.input_hash=digest(j.job.payload);
 j.producer={role:'local-draft',method:'licensed-source-import',model:null,revision:candidate.source_snapshot_sha256,source_digest:candidate.source_digest};j.review.method='source-candidate-AI-review';e.checkedResults=[j];
 assert.deepEqual(assembleGpuEntry(e).blocked,[]);
 for(const mutate of [x=>{x.output.text='Different';x.output_digest=digest(x.output);x.review.contentDigest=x.output_digest;},x=>{x.producer.revision='wrong';},x=>{x.output.provenance.creator='Unrelated';x.output_digest=digest(x.output);x.review.contentDigest=x.output_digest;},x=>{x.producer.method='model-generation';}]){
  const bad=clone(e);mutate(bad.checkedResults[0]);assert.equal(assembleGpuEntry(bad).record,undefined);
 }
});

test('control tokens cannot survive materialisation even with passing field metadata',()=>{
 const e=fixture();e.evidence.meanings.de.text='Ein Buch.<end_of_turn>';
 assert.ok(codes(assembleGpuEntry(e)).includes('model_token_leakage'));
});

function bindSource(item,candidate){
 item.job.payload.licensed_source_candidate=clone(candidate);
 item.job.payload.licensed_source_candidate_digest=digest(candidate);
 item.job.payload.source_import_of_job_id=99;
 item.job.input_hash=digest(item.job.payload);
 item.output={text:candidate.text,provenance:{...candidate.provenance,kind:candidate.provenance.kind??'licensed-source'},...(candidate.focus?{focus:candidate.focus}:{}),...(candidate.pinyin?{pinyin:candidate.pinyin}:{})};
 item.output_digest=digest(item.output);item.review.contentDigest=item.output_digest;
 item.producer={role:'local-draft',method:'licensed-source-import',model:null,revision:candidate.source_snapshot_sha256,source_digest:candidate.source_digest,candidate_digest:digest(candidate)};
 item.review.method='source-candidate-AI-review';
}
const sourceCandidate=(text,extra={})=>({text,provenance:{...external,license:'CC-BY-SA-4.0'},source_digest:'b'.repeat(64),source_snapshot_sha256:'a'.repeat(64),...extra});

test('bound source meaning imports preserve entry evidence and reject forged attribution and stale bindings',()=>{
 const e=fixture();delete e.evidence.meanings.de;const before=digest(e.evidence);
 const item=makeJob(e);bindSource(item,sourceCandidate(meanings.de));e.checkedResults=[item];
 const result=assembleGpuEntry(e);assert.deepEqual(result.blocked,[]);assert.equal(digest(e.evidence),before);
 assert.equal(result.record.meanings.de.provenance.creator,external.creator);
 for(const mutate of [j=>{j.output.provenance.creator='Forged';j.output_digest=digest(j.output);j.review.contentDigest=j.output_digest;},j=>{j.producer.source_digest='c'.repeat(64);},j=>{j.job.payload.licensed_source_candidate.text='Changed';j.job.input_hash=digest(j.job.payload);},j=>{j.job.status='draft';}]){
  const bad=clone(e);mutate(bad.checkedResults[0]);assert.equal(assembleGpuEntry(bad).record,undefined);
 }
});

test('source native imports pass their share-alike source through every generated translation',()=>{
 const e=nativeDraftFixture('en'),native=e.checkedResults[0];
 bindSource(native,sourceCandidate('book.',{focus:{text:'book'}}));
 for(const child of e.checkedResults.slice(1)){
  child.job.payload.source_example=clone(native.output);child.job.payload.text=native.output.text;child.job.payload.source_digest=digest(native.output);child.job.input_hash=digest(child.job.payload);
 }
 const result=assembleGpuEntry(e);assert.deepEqual(result.blocked,[]);
 assert.equal(result.record.examples[0].provenance.license,'CC-BY-SA-4.0');
 for(const [locale,value] of Object.entries(result.record.examples[0].translations)){
  assert.equal(value.provenance.license,'CC-BY-SA-4.0');
  if(locale==='en')assert.equal(value.text,'book.');else assert.equal(value.provenance.sources[0].creator,external.creator);
 }
});

test('source translation imports require exact native binding and preserve both source credits when adapting',()=>{
 const e=fixture();missingTranslation(e);e.evidence.examples[0].provenance={...external,license:'CC-BY-SA-4.0'};
 const source=e.evidence.examples[0],item=makeJob(e,{task:'example_translation',locale:'de',index:0,sourceExample:source});
 bindSource(item,sourceCandidate('Buch.',{source_text:source.text,source_example_digest:digest(source),provenance:{...external,creator:'Translation contributors',license:'CC-BY-4.0'}}));e.checkedResults=[item];
 const result=assembleGpuEntry(e);assert.deepEqual(result.blocked,[]);
 assert.equal(result.record.examples[0].translations.de.provenance.license,'CC-BY-SA-4.0');
 assert.deepEqual(result.record.examples[0].translations.de.provenance.sources.map(p=>p.creator),[external.creator,'Translation contributors']);
 const bad=clone(e),j=bad.checkedResults[0];j.job.payload.licensed_source_candidate.source_text='Different sentence';j.job.payload.licensed_source_candidate_digest=digest(j.job.payload.licensed_source_candidate);j.producer.candidate_digest=j.job.payload.licensed_source_candidate_digest;j.job.input_hash=digest(j.job.payload);
 assert.ok(codes(assembleGpuEntry(bad)).includes('unverified_source_import'));
});
