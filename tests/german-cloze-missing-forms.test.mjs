import test from 'node:test';
import assert from 'node:assert/strict';
import {clozeQuestions,clozeOptions} from '../web/languages/de/js/core/sentence-quizzes.js';
const keepOrder=()=>.999999;
test('a dative-plural blank excludes nouns without the declared plural slot',()=>{
 const word={id:'megapixel',lemma:'Megapixel',pos:'noun',declension:{dat:['dem Megapixel','den Megapixeln']},examples:[{de:'Die Kamera hat eine Auflösung von zwölf Megapixeln.'}]};
 const [question]=clozeQuestions([word]);
 assert.equal(question.answer,'Megapixeln');assert.deepEqual(question.form.path,['dat',1]);
 const words=[{id:'luggage',lemma:'Gepäck',pos:'noun',number_restriction:'singular',declension:{dat:['dem Gepäck',null]}},
  {id:'missing',lemma:'Obst',pos:'noun',declension:{dat:['dem Obst','—']}},
  ...[['parcel','Paket','Paketen'],['room','Zimmer','Zimmern'],['letter','Brief','Briefen']].map(([id,lemma,plural])=>({id,lemma,pos:'noun',declension:{dat:[null,'den '+plural]}})),word];
 const before=JSON.stringify({question,words}),options=clozeOptions(question,words,keepOrder);
 assert.deepEqual(options.map(option=>option.text),['Megapixeln','Paketen','Zimmern','Briefen']);
 assert.equal(options.some(option=>option.word.id==='luggage'),false);
 assert.equal(JSON.stringify({question,words}),before);
});
test('a finite-verb blank excludes verbs missing the requested person slot',()=>{
 const word={id:'go',lemma:'gehen',pos:'verb',forms:{Präsens:{ich:'gehe'}},examples:[{de:'Ich gehe heute zu Fuß nach Hause.'}]};
 const [question]=clozeQuestions([word]);
 assert.equal(question.answer,'gehe');assert.deepEqual(question.form.path,['Präsens','ich']);
 const words=[{id:'work',lemma:'arbeiten',pos:'verb',forms:{Präsens:{du:'arbeitest'}}},
  ...[['learn','lernen','lerne'],['ask','fragen','frage'],['say','sagen','sage']].map(([id,lemma,form])=>({id,lemma,pos:'verb',forms:{Präsens:{ich:form}}})),word];
 assert.deepEqual(clozeOptions(question,words,keepOrder).map(option=>option.text),['gehe','lerne','frage','sage']);
});
test('legacy explicit-focus questions retain their lemma options',()=>{
 const word={id:'house',lemma:'Haus',pos:'noun'},question={word,answer:'Haus',start:4,form:{kind:'focus',path:[],text:'Haus'}};
 const words=[word,...['Baum','Auto','Buch'].map(lemma=>({id:lemma,lemma,pos:'noun'}))];
 assert.deepEqual(clozeOptions(question,words,keepOrder).map(option=>option.text),['Haus','Baum','Auto','Buch']);
});
