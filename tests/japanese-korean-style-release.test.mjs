import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadKoreanMeaningReview} from '../scripts/review-korean-meanings.mjs';
import {compileNaturalKoreanPair} from '../scripts/content/korean-meaning-style.mjs';
import {validatePackage} from '../web/js/packages/schema.js';

test('Japanese Korean 4.6 reproduces its declared editorial corrections without changing examples or lexical content',async()=>{
 const root=new URL('../',import.meta.url),base='language-packages/sources/meaning-style/ja-ko-4.6.0/',read=path=>readFile(new URL(path,root)),json=async path=>JSON.parse(await read(path));
 const completion=await loadKoreanMeaningReview(fileURLToPath(new URL(base,root))),proof=await json(base+'report.json');
 for(const file of proof.files){const bytes=await read(file.path);assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 const expected=compileNaturalKoreanPair({...completion,version:'4.6.0'}),actualBytes=await read('language-packages/ja-ko-4.6.0.json'),actual=JSON.parse(actualBytes),{meaningReview,...payload}=actual;
 assert.deepEqual(payload,expected.pair);assert.deepEqual(meaningReview,{...proof,status:'targeted-AI-editorial-corrections',nativeSpeakerReview:'pending'});
 assert.equal(proof.target,12027);assert.equal(proof.changed,771);assert.equal(proof.reviewed,2530);assert.equal(proof.screenedRetained,9497);assert.equal(proof.independentlyReviewedChanges,0);assert.equal(proof.completeDecisionCoverage,true);
 validatePackage(actual);
 for(const pinned of completion.manifest.sourcePackages.filter(row=>row.id!=='ja-ko')){
  const bytes=await read(pinned.url.slice(1));assert.equal(bytes.length,pinned.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pinned.sha256);
 }
 const byId=new Map(actual.entries.map(row=>[row.id,row.meaning]));
 for(const [word,reading,meaning]of [['明日','みょうにち','내일'],['作','さく','작품'],['女優','じょゆう','여배우'],['幅','はば','너비; 폭'],['祖父','そふ','할아버지'],['空欄','くうらん','빈칸'],['鼻汁','はなじる','콧물']]){
  const entry=completion.core.entries.find(row=>row.word===word&&row.pronunciation===reading);assert.ok(entry,word);assert.equal(byId.get(entry.id),meaning,word);
 }
 for(let i=0;i<actual.entries.length;i++){
  const {meaning,meanings,meaningStyle,...updated}=actual.entries[i],{meaning:old,meanings:oldList,meaningStyle:oldStyle,...original}=completion.pair.entries[i];assert.deepEqual(updated,original,'Only meaning-related fields may change: '+updated.id);assert.ok(updated.exampleTranslation);
 }
});
