import test from 'node:test';
import assert from 'node:assert/strict';
import {caseQuestions,nominalAnswerCorrect} from '../web/languages/de/js/core/nominal-grammar.js';
import {verbFormQuestions,verbFormCorrect} from '../web/languages/de/js/core/grammar-quizzes.js';
import {clozeQuestions} from '../web/languages/de/js/core/sentence-quizzes.js';
import {perfectVerbAlternatives,inflectReflexiveComplement} from '../web/languages/de/js/core/form-alternatives.js';
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

const reflexiveIr={id:'err',lemma:'irren',pos:'verb',meaning_en:['be mistaken; wander'],meaning_ko:['착각하다; 헤매다'],reflexive_case:'accusative',infinitive:'irren / sich irren',forms:{perfekt:'ist geirrt / hat geirrt / hat sich geirrt'}};
test('each person keeps bare and accusative-reflexive alternatives with their own perfect auxiliaries',()=>{
 const questions=verbFormQuestions([reflexiveIr],[reflexiveIr,...auxiliaries]);
 const people=[
  ['ich','bin','habe','war','hatte','werde','mich'],['du','bist','hast','warst','hattest','wirst','dich'],
  ['er','ist','hat','war','hatte','wird','sich'],['wir','sind','haben','waren','hatten','werden','uns'],
  ['ihr','seid','habt','wart','hattet','werdet','euch'],['sie','sind','haben','waren','hatten','werden','sich'],
 ];
 for(const [person,be,have,was,had,future,pronoun]of people){
  for(const [tense,expected]of [
   ['perfekt',[be+' geirrt',have+' geirrt',have+' '+pronoun+' geirrt']],
   ['plusquamperfekt',[was+' geirrt',had+' geirrt',had+' '+pronoun+' geirrt']],
   ['futur_ii',[future+' geirrt sein',future+' geirrt haben',future+' '+pronoun+' geirrt haben']],
   ['futur_i',[future+' irren',future+' '+pronoun+' irren']],
  ]){
   const q=questions.find(q=>q.person===person&&q.tense===tense);assert.deepEqual(q.acceptedAnswers,expected);
   for(const answer of expected)assert.equal(verbFormCorrect(q,answer),true);
  }
 }
 const q=questions.find(q=>q.person==='ich'&&q.tense==='perfekt');
 for(const wrong of ['habe sich geirrt','habe mir geirrt','bin mich geirrt','bin hat sich geirrt'])assert.equal(verbFormCorrect(q,wrong),false);
});
test('simple reflexive perfect citations infer a reflexive FutureI without adding a bare recovery form',()=>{
 const word={...reflexiveIr,id:'recover',lemma:'erholen',infinitive:undefined,forms:{perfekt:'hat sich erholt',praesens:{ich:'erhole mich'}}};
 const questions=verbFormQuestions([word],[word,...auxiliaries]);
 for(const [tense,expected]of [['perfekt','habe mich erholt'],['plusquamperfekt','hatte mich erholt'],['futur_i','werde mich erholen'],['futur_ii','werde mich erholt haben']]){
  const q=questions.find(q=>q.person==='ich'&&q.tense===tense);assert.deepEqual(q.acceptedAnswers,[expected]);assert.equal(verbFormCorrect(q,expected),true);
  assert.equal(verbFormCorrect(q,expected.replace('mich ','sich ')),false);
 }
 assert.equal(verbFormCorrect(questions.find(q=>q.person==='ich'&&q.tense==='futur_i'),'werde erholen'),false);
 assert.equal(questions.find(q=>q.tense==='praesens').answer,'erhole mich');
});
test('dative reflexives use mir and dir while keeping explicit objects and infinitives',()=>{
 const word={...reflexiveIr,id:'remember',lemma:'merken',reflexive_case:'dative',infinitive:'sich etwas merken',forms:{perfekt:'hat sich etwas gemerkt'}};
 const questions=verbFormQuestions([word],[word,...auxiliaries]);
 for(const [person,have,had,future,pronoun]of [['ich','habe','hatte','werde','mir'],['du','hast','hattest','wirst','dir'],['er','hat','hatte','wird','sich'],['wir','haben','hatten','werden','uns'],['ihr','habt','hattet','werdet','euch'],['sie','haben','hatten','werden','sich']]){
  for(const [tense,expected]of [['perfekt',have+' '+pronoun+' etwas gemerkt'],['plusquamperfekt',had+' '+pronoun+' etwas gemerkt'],['futur_i',future+' '+pronoun+' etwas merken'],['futur_ii',future+' '+pronoun+' etwas gemerkt haben']])assert.deepEqual(questions.find(q=>q.person===person&&q.tense===tense).acceptedAnswers,[expected]);
 }
 assert.equal(verbFormCorrect(questions.find(q=>q.person==='ich'&&q.tense==='perfekt'),'habe mich etwas gemerkt'),false);
});
test('explicit abbreviated source cases retain person-correct reflexive answers',()=>{
 for(const [grammaticalCase,lemma,participle,pronoun]of [['acc','irren','geirrt','mich'],['dat','merken','gemerkt','mir']]){
  const word={...reflexiveIr,lemma,infinitive:'sich '+lemma,reflexive_case:grammaticalCase,forms:{perfekt:'hat sich '+participle}};
  const q=verbFormQuestions([word],[word,...auxiliaries]).find(q=>q.person==='ich'&&q.tense==='perfekt');
  assert.ok(q.acceptedAnswers.includes('habe '+pronoun+' '+participle));
 }
 assert.equal(inflectReflexiveComplement('sich geirrt','ich','unknown'),null);
});
test('missing case or an unspecified complex infinitive withholds incomplete answer inventories',()=>{
 const noCase={...reflexiveIr,reflexive_case:undefined,forms:{...reflexiveIr.forms,praesens:{ich:'irre / irre mich'}}};
 const questions=verbFormQuestions([noCase],[noCase,...auxiliaries]);
 assert.ok(!questions.some(q=>['perfekt','plusquamperfekt','futur_i','futur_ii'].includes(q.tense)));
 assert.deepEqual(questions.find(q=>q.tense==='praesens').acceptedAnswers,['irre','irre mich']);
 const complex={...reflexiveIr,lemma:'merken',infinitive:undefined,reflexive_case:'dative',forms:{perfekt:'hat sich etwas gemerkt'}};
 assert.ok(!verbFormQuestions([complex],[complex,...auxiliaries]).some(q=>q.tense==='futur_i'));
 const missingBe=verbFormQuestions([reflexiveIr],[reflexiveIr,auxiliaries[0]]);
 assert.ok(!missingBe.some(q=>['perfekt','plusquamperfekt'].includes(q.tense)));
 assert.equal(missingBe.filter(q=>q.tense==='futur_ii').length,6);
});
test('embedded or quoted sich is not rewritten as a subject reflexive pronoun',()=>{
 assert.equal(inflectReflexiveComplement('„sich“ zitiert','ich','accusative'),'„sich“ zitiert');
 assert.equal(inflectReflexiveComplement('ihn sich vorstellen lassen','ich','accusative'),'ihn sich vorstellen lassen');
 assert.equal(inflectReflexiveComplement('sich','ich','accusative'),null);
});

test('cloze recognises an alternative finite verb form',()=>{
 const word={id:'backen',lemma:'backen',pos:'verb',forms:{praesens:{er:'backt / bäckt'}},examples:[{de:'Sie bäckt Brot.'}]};
 assert.equal(clozeQuestions([word])[0].answer,'bäckt');
});

test('nominal exercises use case forms matching the displayed noun gender',()=>{
 const word={...book,id:'blog',lemma:'Blog',declension:{nom:['der Blog / das Blog',null],acc:['den Blog / das Blog',null]}};
 const q=caseQuestions([word]).find(q=>q.case==='acc');assert.equal(q.base,'das Blog');assert.equal(q.answer,'das Blog');
});
