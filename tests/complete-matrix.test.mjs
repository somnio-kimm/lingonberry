import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDY_LANGUAGES,allowsExplanation} from '../web/js/shared/language-pairs.js';
import {contentDigest,compileCompleteMatrix} from '../scripts/content/complete-matrix.mjs';
const native={de:'Buch',en:'book',es:'libro',fr:'livre',ja:'本',ko:'책',zh:'书'};
const explanation={de:'ein Werk zum Lesen',en:'a written work for reading',es:'obra escrita para leer',fr:'ouvrage écrit à lire',ja:'読むための書物',ko:'읽기 위한 저작물',zh:'供阅读的著作'};
const provenance={kind:'app-authored',creator:'Learn Language contributors',license:'CC-BY-4.0'};
function fixture(){
 const cores={},records={};
 for(const language of STUDY_LANGUAGES){
  const id=language+'-book',word=native[language],locales=STUDY_LANGUAGES.filter(locale=>allowsExplanation(language,locale));
  cores[language]={schemaVersion:2,id:language+'-core',kind:'study',targetLanguage:language,version:'3.0.0',license:{identifier:'CC-BY-4.0',notice:'Original attribution.'},entries:[{id,word,partOfSpeech:'noun'}]};
  const row={id,authoringAgent:'writer',meanings:Object.fromEntries(locales.map(locale=>[locale,{text:explanation[locale],provenance}])),examples:[{text:word+'.',focus:{text:word},provenance,translations:Object.fromEntries(locales.map(locale=>[locale,{text:native[locale]+'.',provenance}]))}]};
  row.review={status:'checked',method:'AI-editorial',reviewer:'checker',sourceDigest:contentDigest(row),checks:['selected-sense','part-of-speech','native-grammar','translation-meaning','tense-negation-quantity','explanation-language'],nativeSpeakerReview:'pending',findings:[]};records[language]=[row];
 }
 return {cores,records,version:'4.0.0'};
}
test('a complete reviewed corpus creates seven cores and exactly 43 explanation pairs',()=>{
 const data=fixture(),packages=compileCompleteMatrix(data);assert.equal(packages.length,50);assert.ok(packages.some(p=>p.id==='en-en'));assert.ok(!packages.some(p=>p.id==='ko-ko'));assert.ok(packages.every(p=>p.entries.length===1));assert.equal(packages.find(p=>p.id==='ja-de').entries[0].meaning,explanation.de);assert.equal(data.cores.ja.version,'3.0.0');
});
test('missing entries, definitions or sentence translations block the whole release',()=>{
 for(const damage of [data=>data.records.ja=[],data=>delete data.records.ja[0].meanings.de,data=>delete data.records.ja[0].examples[0].translations.de]){
  const data=fixture();damage(data);if(data.records.ja[0])data.records.ja[0].review.sourceDigest=contentDigest(data.records.ja[0]);assert.throws(()=>compileCompleteMatrix(data),/Incomplete reviewed content/);
 }
});
test('review decisions cannot be reused after an edit or substitute for an independent semantic check',()=>{
 const data=fixture();data.records.ja[0].meanings.de.text='wrong';assert.throws(()=>compileCompleteMatrix(data),/stale/);
 const own=fixture();own.records.ja[0].review.reviewer='writer';assert.throws(()=>compileCompleteMatrix(own),/independent/);
 const unresolved=fixture();unresolved.records.ja[0].review.findings=[{status:'open'}];assert.throws(()=>compileCompleteMatrix(unresolved),/unresolved/);
});
test('restricted licences and invalid focus cannot pass even with an attached review decision',()=>{
 const data=fixture();data.records.ja[0].meanings.de.provenance={...provenance,license:'CC-BY-NC-4.0'};data.records.ja[0].review.sourceDigest=contentDigest(data.records.ja[0]);assert.throws(()=>compileCompleteMatrix(data),/licence/);
 const wrong=fixture();wrong.records.ja[0].examples[0].focus.text='猫';wrong.records.ja[0].review.sourceDigest=contentDigest(wrong.records.ja[0]);assert.throws(()=>compileCompleteMatrix(wrong),/surface/);
});

import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildCompleteContent} from '../scripts/build-complete-content.mjs';
test('the release writer stages 50 complete files and refuses changed bytes under the same version',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'complete-content-test-')),data=fixture(),recordDirectory=join(directory,'records'),output=join(directory,'output'),packageDirectory=join(directory,'language-packages');
 try{
  await mkdir(recordDirectory);await mkdir(packageDirectory);const catalog=[];
  for(const language of STUDY_LANGUAGES){const filename=language+'-core-3.0.0.json';await writeFile(join(packageDirectory,filename),JSON.stringify(data.cores[language]));catalog.push({id:language+'-core',url:'/language-packages/'+filename});await writeFile(join(recordDirectory,language+'-reviewed.jsonl'),JSON.stringify(data.records[language][0])+'\n');}
  await writeFile(join(packageDirectory,'catalog.json'),JSON.stringify(catalog));
  const result=await buildCompleteContent({recordDirectory,output,version:'4.0.0',sourceDirectory:directory});assert.equal(result.explanationPackages,43);assert.equal(JSON.parse(await readFile(join(output,'catalog.json'),'utf8')).length,50);
  const original=await readFile(join(output,'ja-de-4.0.0.json'),'utf8');data.records.ja[0].meanings.de.text='eine neue Erklärung';data.records.ja[0].review.sourceDigest=contentDigest(data.records.ja[0]);await writeFile(join(recordDirectory,'ja-reviewed.jsonl'),JSON.stringify(data.records.ja[0])+'\n');
  await assert.rejects(buildCompleteContent({recordDirectory,output,version:'4.0.0',sourceDirectory:directory}),/immutable/);assert.equal(await readFile(join(output,'ja-de-4.0.0.json'),'utf8'),original);
  const incomplete=join(directory,'incomplete');await writeFile(join(recordDirectory,'ja-reviewed.jsonl'),'');await assert.rejects(buildCompleteContent({recordDirectory,output:incomplete,version:'4.0.0',sourceDirectory:directory}),/coverage/);await assert.rejects(stat(incomplete),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('placeholder text cannot be counted as a completed translation',()=>{const data=fixture();data.records.ja[0].meanings.de.text='TODO';data.records.ja[0].review.sourceDigest=contentDigest(data.records.ja[0]);assert.throws(()=>compileCompleteMatrix(data),/placeholder/);});

const wikiCredit=()=>({kind:'licensed-source',creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',url:'https://en.wiktionary.org/wiki/book',history:'https://en.wiktionary.org/w/index.php?title=book&action=history',sourceIdentity:{edition:'en',snapshotSha256:'a'.repeat(64),rowDigest:'b'.repeat(64),senseIndex:0},sourceSnapshot:{sha256:'a'.repeat(64),dumpDate:'unknown'}});
function refreshReview(record){record.review.sourceDigest=contentDigest(record);}

test('compiled Wiktionary sources and adaptations retain field credits and embed the shipped notice',async()=>{
 const data=fixture(),row=data.records.en[0],source=wikiCredit();
 const adapted={kind:'licensed-adaptation',creator:'Lingonberry contributors; '+source.creator,license:'CC-BY-SA-4.0',url:source.url,method:'AI-assisted-adaptation',sources:[structuredClone(source)]};
 row.examples[0].provenance=structuredClone(source);
 row.examples[0].translations.en.provenance=structuredClone(source);
 row.examples[0].translations.ko.provenance=structuredClone(adapted);
 row.meanings.ko.provenance=structuredClone(adapted);refreshReview(row);
 const before=structuredClone(data),packages=compileCompleteMatrix(data);
 const core=packages.find(p=>p.id==='en-core'),pair=packages.find(p=>p.id==='en-ko'),self=packages.find(p=>p.id==='en-en');
 assert.deepEqual(core.entries[0].example.provenance,source);
 assert.deepEqual(pair.entries[0].provenance,adapted);
 assert.deepEqual(pair.entries[0].exampleTranslationProvenance,adapted);
 assert.deepEqual(self.entries[0].exampleTranslationProvenance,source);
 const notice=(await readFile(new URL('../language-packages/credits/WIKTIONARY-SOURCE-REUSE.txt',import.meta.url),'utf8')).trim();
 for(const packageValue of [core,pair,self]){assert.ok(packageValue.license.notice.includes(notice));assert.ok(packageValue.license.identifier.includes('CC-BY-SA-4.0'));}
 assert.ok(!packages.find(p=>p.id==='ja-core').license.notice.includes(notice));
 assert.deepEqual(data,before);
});

test('legacy Wiktionary history and licence aliases remain valid without new snapshot identity fields',()=>{
 const data=fixture(),row=data.records.ja[0],source=wikiCredit();
 source.history_url=source.history;delete source.history;source.license_url=source.licenseUrl;delete source.licenseUrl;delete source.sourceIdentity;delete source.sourceSnapshot;
 row.meanings.en.provenance=source;refreshReview(row);
 const result=compileCompleteMatrix(data).find(p=>p.id==='ja-en');
 assert.deepEqual(result.entries[0].provenance,source);assert.ok(result.license.notice.includes('Wiktionary source reuse'));
});

test('incomplete Wiktionary credits and share-alike downgrades block final packaging',()=>{
 for(const change of [p=>delete p.history,p=>delete p.licenseUrl,p=>p.history='https://unrelated.example/history',p=>p.licenseUrl='https://example.org/license',p=>p.license='CC-BY-4.0',p=>p.license='CC-BY-SA-2.0-KR',p=>p.licenseUrl='https://creativecommons.org/licenses/by-sa/2.0/kr/',p=>p.history='https://en.wiktionary.org/w/index.php?title=unrelated&action=history',p=>p.history='https://en.wiktionary.org/wiki/book']){
  const data=fixture(),row=data.records.ja[0],source=wikiCredit();change(source);row.meanings.en.provenance=source;refreshReview(row);
  assert.throws(()=>compileCompleteMatrix(data),/Wiktionary/);
 }
 const data=fixture(),row=data.records.ja[0],source=wikiCredit();delete source.history;
 row.meanings.en.provenance={kind:'licensed-adaptation',creator:'App contributors',license:'CC-BY-SA-4.0',url:'https://example.org/translation',sources:[source]};refreshReview(row);
 assert.throws(()=>compileCompleteMatrix(data),/Wiktionary/);
});

test('unrelated starter packages do not receive the Wiktionary notice',()=>{
 assert.ok(compileCompleteMatrix(fixture()).every(p=>!p.license.notice.includes('Wiktionary source reuse')));
});

test('Wiktionary adaptations cannot downgrade a 4.0 source to an older share-alike licence',()=>{
 const data=fixture(),row=data.records.ja[0],source=wikiCredit();
 row.meanings.en.provenance={kind:'licensed-adaptation',creator:'App contributors',license:'CC-BY-SA-2.0-KR',url:source.url,sources:[source]};refreshReview(row);
 assert.throws(()=>compileCompleteMatrix(data),/Wiktionary share-alike licence/);
});
