import test from 'node:test';
import assert from 'node:assert/strict';
import {clozeQuestions,clozeOptions} from '../web/languages/de/js/core/sentence-quizzes.js';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewCatalog,reviewItems} from '../web/languages/de/js/core/retest.js';
const noun=(id,lemma,gen)=>({id,lemma,pos:'noun',article:'der',gender:'masculine',meaning_en:[lemma],meaning_ko:[lemma],declension:{nom:['der '+lemma,null],gen:[gen,null]}});
const target=()=>({...noun('synod','Heilige Synod','des Heiligen Synods'),examples:[{de:'Der Bericht beschreibt die Aufgaben des Heiligen Synods.',focus:{start:36,text:'des Heiligen Synods'}}]});
const others=()=>[noun('man','Mann','des Mannes'),noun('friend','Freund','des Freundes'),noun('teacher','Lehrer','des Lehrers')];

test('a complete article-bearing focus keeps the existing genitive slot and complete options',()=>{
 const word=target(),q=clozeQuestions([word])[0];assert.equal(q.answer,'des Heiligen Synods');assert.equal(q.start,36);assert.equal(q.form.kind,'declension');assert.deepEqual(q.form.path,['gen',0]);assert.equal(q.form.withArticle,true);
 assert.deepEqual(new Set(clozeOptions(q,[word,...others()],()=>.4).map(o=>o.text)),new Set(['des Heiligen Synods','des Mannes','des Freundes','des Lehrers']));
});

test('bare noun-form blanks keep their prior article-free options',()=>{
 const word={...target(),examples:[{de:'Der Bericht beschreibt die Aufgaben des Heiligen Synods.',focus:{start:40,text:'Heiligen Synods'}}]},q=clozeQuestions([word])[0];assert.equal(q.form.withArticle,undefined);
 assert.deepEqual(new Set(clozeOptions(q,[word,...others()],()=>.4).map(o=>o.text)),new Set(['Heiligen Synods','Mannes','Freundes','Lehrers']));
});

test('sentence-initial capitalisation retains the complete nominative phrase descriptor',()=>{
 const word={...target(),examples:[{de:'Der Heilige Synod tagt heute.',focus:{start:0,text:'Der Heilige Synod'}}]},q=clozeQuestions([word])[0];assert.equal(q.answer,'Der Heilige Synod');assert.equal(q.form.kind,'declension');assert.equal(q.form.withArticle,true);
 assert.deepEqual(new Set(clozeOptions(q,[word,...others()],()=>.4).map(o=>o.text)),new Set(['Der Heilige Synod','Der Mann','Der Freund','Der Lehrer']));
});

test('explicit indefinite case phrases preserve complete source alternatives',()=>{
 const word={...noun('accused','Angeschuldigte','des Angeschuldigten / eines Angeschuldigten'),examples:[{de:'Das ist die Aussage eines Angeschuldigten.',focus:{start:20,text:'eines Angeschuldigten'}}]},q=clozeQuestions([word])[0],foils=others().map(w=>({...w,declension:{...w.declension,gen:[w.declension.gen[0]+' / eines '+w.declension.gen[0].slice(4),null]}}));
 assert.equal(q.form.withArticle,true);assert.equal(q.form.alternativeIndex,1);assert.deepEqual(new Set(clozeOptions(q,[word,...foils],()=>.4).map(o=>o.text)),new Set(['eines Angeschuldigten','eines Mannes','eines Freundes','eines Lehrers']));
});

test('Store reload and Review preserve the original sentence, focus and article-bearing options',()=>{
 const word=target(),words=[word,...others()],q=clozeQuestions([word])[0],data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=createStore(storage);store.setReviewContent({studyVersion:'1.0.0'});store.recordQuizAnswer('cloze',q,'wrong',false);
 const reopened=createStore(storage);reopened.setReviewContent({studyVersion:'1.0.0'});const rows=wrongEntries([],reopened.state,words,reopened.reviewContent),replay=reviewItems(rows,reviewCatalog(words,rows));assert.equal(replay.items.length,1);const saved=replay.items[0].question;
 assert.equal(saved.id,q.id);assert.equal(saved.start,36);assert.equal(saved.example.de,q.example.de);assert.equal(saved.form.withArticle,true);assert.equal(saved.example.de.slice(saved.start,saved.start+saved.answer.length),saved.answer);assert.deepEqual(new Set(clozeOptions(saved,words,()=>.4).map(o=>o.text)),new Set(['des Heiligen Synods','des Mannes','des Freundes','des Lehrers']));
});
