import test from 'node:test';
import assert from 'node:assert/strict';
import {caseQuestions,nominalAnswerCorrect} from '../web/languages/de/js/core/nominal-grammar.js';
import {verbFormQuestions,verbFormCorrect} from '../web/languages/de/js/core/grammar-quizzes.js';
import {clozeQuestions} from '../web/languages/de/js/core/sentence-quizzes.js';
import {perfectVerbAlternatives} from '../web/languages/de/js/core/form-alternatives.js';
const book={id:'book',lemma:'Buch',pos:'noun',gender:'neuter',article:'das',declension:{nom:['das Buch','die Bücher'],gen:['des Buches / Buchs','der Bücher']},examples:[{de:'Der Titel des Buchs ist kurz.'}]};
test('case input accepts either complete genitive instead of requiring the slash notation',()=>{
 const q=caseQuestions([book]).find(q=>q.case==='gen'&&q.number==='singular');
 assert.equal(q.answer,'des Buches');assert.equal(nominalAnswerCorrect(q,'des Buchs'),true);assert.equal(nominalAnswerCorrect(q,'des Buch'),false);
});
test('cloze recognises a shortened noun variant in an example sentence',()=>{
 assert.equal(clozeQuestions([book])[0].answer,'Buchs');
});
test('verb input accepts both attested finite variants with a single displayed answer',()=>{
 const backen={id:'backen',lemma:'backen',pos:'verb',meaning_en:['bake'],meaning_ko:['굽다'],forms:{praesens:{du:'backst / bäckst'}}};
 const q=verbFormQuestions([backen]).find(q=>q.tense==='praesens');
 assert.equal(q.answer,'backst');assert.equal(verbFormCorrect(q,'bäckst'),true);assert.equal(verbFormCorrect(q,'backt'),false);
});
test('a separable main-clause prompt rejects the joined subordinate form',()=>{
 const word={id:'abbiegen',lemma:'abbiegen',pos:'verb',separable_prefix:'ab',meaning_en:['turn'],meaning_ko:['방향을 바꾸다'],forms:{praesens:{ich:'biege ab / abbiege'}}};
 const q=verbFormQuestions([word]).find(q=>q.tense==='praesens');
 assert.equal(q.answer,'biege ab');assert.equal(verbFormCorrect(q,'abbiege'),false);
});
test('compound tenses repeat the auxiliary for each participle alternative',()=>{
 const haben={id:'haben',lemma:'haben',pos:'verb',meaning_en:['have'],meaning_ko:['가지다'],forms:{praesens:{ich:'habe'},praeteritum:{ich:'hatte'}}};
 const backen={id:'backen',lemma:'backen',pos:'verb',auxiliary:'haben',meaning_en:['bake'],meaning_ko:['굽다'],forms:{perfekt:'hat gebacken / gebackt'}};
 const q=verbFormQuestions([backen],[backen,haben]).find(q=>q.tense==='perfekt'&&q.person==='ich');
 assert.equal(q.answer,'habe gebacken');assert.equal(verbFormCorrect(q,'habe gebackt'),true);assert.equal(verbFormCorrect(q,'gebackt'),false);
});

const auxiliaries=[
 {id:'have',lemma:'haben',pos:'verb',forms:{praesens:{ich:'habe',du:'hast',er:'hat',wir:'haben',ihr:'habt',sie:'haben'},praeteritum:{ich:'hatte',du:'hattest',er:'hatte',wir:'hatten',ihr:'hattet',sie:'hatten'}}},
 {id:'be',lemma:'sein',pos:'verb',forms:{praesens:{ich:'bin',du:'bist',er:'ist',wir:'sind',ihr:'seid',sie:'sind'},praeteritum:{ich:'war',du:'warst',er:'war',wir:'waren',ihr:'wart',sie:'waren'}}},
];
const swim={id:'swim',lemma:'schwimmen',pos:'verb',auxiliary:'haben / sein',meaning_en:['swim'],meaning_ko:['수영하다'],forms:{perfekt:'hat geschwommen / ist geschwommen'}};
test('mixed auxiliaries retain valid answers for each compound tense instead of stacking them',()=>{
 const questions=verbFormQuestions([swim],[swim,...auxiliaries]);
 assert.equal(questions.filter(q=>['perfekt','plusquamperfekt','futur_ii'].includes(q.tense)).length,18);
 for(const [tense,expected] of [
  ['perfekt',['habe geschwommen','bin geschwommen']],
  ['plusquamperfekt',['hatte geschwommen','war geschwommen']],
  ['futur_ii',['werde geschwommen haben','werde geschwommen sein']],
 ]){
  const q=questions.find(q=>q.tense===tense&&q.person==='ich');assert.deepEqual(q.acceptedAnswers,expected);
  for(const answer of expected)assert.equal(verbFormCorrect(q,answer),true);
  for(const malformed of ['habe ist geschwommen','bin hat geschwommen','werde ist geschwommen haben'])assert.equal(verbFormCorrect(q,malformed),false);
 }
 const plural=questions.find(q=>q.tense==='perfekt'&&q.person==='wir');assert.deepEqual(plural.acceptedAnswers,['haben geschwommen','sind geschwommen']);
});
test('each full auxiliary stays paired with its own participle',()=>{
 const word={...swim,id:'startle',lemma:'erschrecken',auxiliary:'sein',forms:{perfekt:'ist erschrocken / hat erschreckt'}};
 const questions=verbFormQuestions([word],[word,...auxiliaries]);
 for(const [tense,expected] of [
  ['perfekt',['bin erschrocken','habe erschreckt']],
  ['plusquamperfekt',['war erschrocken','hatte erschreckt']],
  ['futur_ii',['werde erschrocken sein','werde erschreckt haben']],
 ])assert.deepEqual(questions.find(q=>q.tense===tense&&q.person==='ich').acceptedAnswers,expected);
});
test('shared citation prefixes and same-auxiliary shorthand parse without duplicating answers',()=>{
 assert.deepEqual(perfectVerbAlternatives('hat / ist geschwommen'),[{auxiliary:'haben',participle:'geschwommen'},{auxiliary:'sein',participle:'geschwommen'}]);
 assert.deepEqual(perfectVerbAlternatives('hat gebacken / gebackt / hat gebacken'),[{auxiliary:'haben',participle:'gebacken'},{auxiliary:'haben',participle:'gebackt'}]);
});
test('compound forms skip malformed citations and missing finite auxiliary data safely',()=>{
 assert.deepEqual(perfectVerbAlternatives('gegangen / ist / hat ist gegangen'),[]);
 assert.deepEqual(perfectVerbAlternatives('hat gebacken / ist / gegangen'),[{auxiliary:'haben',participle:'gebacken'}]);
 const questions=verbFormQuestions([swim],[swim]);
 assert.ok(!questions.some(q=>['perfekt','plusquamperfekt'].includes(q.tense)));
 assert.deepEqual(questions.find(q=>q.tense==='futur_ii'&&q.person==='ich').acceptedAnswers,['werde geschwommen haben','werde geschwommen sein']);
});

test('cloze recognises an alternative finite verb form',()=>{
 const word={id:'backen',lemma:'backen',pos:'verb',forms:{praesens:{er:'backt / bäckt'}},examples:[{de:'Sie bäckt Brot.'}]};
 assert.equal(clozeQuestions([word])[0].answer,'bäckt');
});

test('nominal exercises use case forms matching the displayed noun gender',()=>{
 const word={...book,id:'blog',lemma:'Blog',declension:{nom:['der Blog / das Blog',null],acc:['den Blog / das Blog',null]}};
 const q=caseQuestions([word]).find(q=>q.case==='acc');assert.equal(q.base,'das Blog');assert.equal(q.answer,'das Blog');
});
