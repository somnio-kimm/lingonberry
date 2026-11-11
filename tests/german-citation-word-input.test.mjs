import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,explanationFixture} from './package-fixture.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords} from '../web/js/presentation/words.js';
import {vocabularyQuestions,vocabularyAnswerCorrect} from '../web/languages/de/js/core/vocabulary-tests.js';
import {nounPhraseAlternatives} from '../web/languages/de/js/core/form-alternatives.js';
import {caseQuestions,nominalAnswerCorrect} from '../web/languages/de/js/core/nominal-grammar.js';
import {listeningQuestions,listeningAnswerCorrect} from '../web/languages/de/js/core/listening-tests.js';
import {createStore} from '../web/languages/de/js/core/store.js';
const entries=[
 {id:'arabic',word:'Arabisch',article:'das',partOfSpeech:'noun',level:'B1',grammar:{declension:{nom:['das Arabisch / Arabische',null]}}},
 {id:'care',word:'kümmern',partOfSpeech:'verb',level:'B1',grammar:{infinitive:'sich kümmern',source_related_forms:['kümmert']}},
];
for(const locale of ['en','ko'])test(`German ${locale} Word Input accepts explicit noun and infinitive citations through saved Review`,()=>{
 const core=fixture({entries}).data,pair=explanationFixture(core,locale,{entries:[{id:'arabic',meaning:locale==='en'?'Arabic':'아랍어'},{id:'care',meaning:locale==='en'?'to take care of':'돌보다'}]}).data;
 const study=assembleStudy(core,pair),words=germanWords(study),questions=vocabularyQuestions('vocabinput',words,locale),data=new Map(),storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 const store=createStore(storage);store.setReviewContent(study);
 for(const q of questions){
  const accepted=q.word.id==='arabic'?['das Arabisch','das Arabische']:['kümmern','sich kümmern'];
  for(const answer of accepted)assert.equal(vocabularyAnswerCorrect(q,answer),true,answer);
  store.recordQuizAnswer('vocabinput',q,'wrong',false);const saved=createStore(storage).state.quizAnswers.vocabinput[q.id].questionSnapshot;
  for(const answer of accepted)assert.equal(vocabularyAnswerCorrect(saved,answer),true,answer);
 }
 const noun=questions.find(q=>q.word.id==='arabic'),verb=questions.find(q=>q.word.id==='care');
 for(const answer of ['Arabisch','Arabische','die Arabische','das des Arabische'])assert.equal(vocabularyAnswerCorrect(noun,answer),false);
 for(const answer of ['kümmert','mich kümmern','sich kümmere'])assert.equal(vocabularyAnswerCorrect(verb,answer),false);
 const listening=listeningQuestions('listenword',words.filter(word=>word.id==='care'),locale)[0];
 assert.equal(listeningAnswerCorrect(listening,'kümmern'),true);assert.equal(listeningAnswerCorrect(listening,'sich kümmern'),false);
});
test('noun article sharing preserves complete indefinite phrases without inventing double articles',()=>{
 assert.deepEqual(nounPhraseAlternatives('der Angeschuldigte / ein Angeschuldigter'),['der Angeschuldigte','ein Angeschuldigter']);
 assert.deepEqual(nounPhraseAlternatives('die Verwandte / eine Verwandte'),['die Verwandte','eine Verwandte']);
 assert.deepEqual(nounPhraseAlternatives('des Angeschuldigten / eines Angeschuldigten'),['des Angeschuldigten','eines Angeschuldigten']);
 const word={id:'accused',lemma:'Angeschuldigte',article:'der',gender:'masculine',pos:'noun',declension:{nom:['der Angeschuldigte / ein Angeschuldigter',null]}};
 const q=caseQuestions([word])[0];assert.equal(nominalAnswerCorrect(q,'Der Angeschuldigte'),true);assert.equal(nominalAnswerCorrect(q,'Der ein Angeschuldigter'),false);
});
