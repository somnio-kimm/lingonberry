import test from 'node:test';
import assert from 'node:assert/strict';
import {clozeQuestions,clozeOptions} from '../web/languages/de/js/core/sentence-quizzes.js';
import {snapshotQuestion} from '../web/js/shared/question-snapshot.js';
const text='Gut zu wissen: Das ist eine gute Idee.';
const word={id:'good-fixture',lemma:'gut',pos:'adjective',examples:[{de:text,focus:{start:text.indexOf('gute'),text:'gute'}}]};
test('explicit inflected German focus overrides an earlier lemma occurrence without a paradigm',()=>{
 const [q]=clozeQuestions([word]);assert.equal(q.start,text.indexOf('gute'));assert.equal(q.answer,'gute');assert.equal(q.example.de.slice(q.start,q.start+q.answer.length),'gute');
 const saved=snapshotQuestion(q);assert.equal(saved.start,q.start);assert.equal(saved.answer,'gute');assert.equal(clozeOptions(saved,[word])[0].text,'gute');
});
test('an exact explicit target keeps its existing typed form for distractor selection',()=>{
 const noun={id:'book-fixture',lemma:'Buch',pos:'noun',declension:{dat:['dem Buch / Buche',null]},examples:[{de:'Er liest aus dem Buche.',focus:{start:17,text:'Buche'}}]};
 const [q]=clozeQuestions([noun]);assert.equal(q.answer,'Buche');assert.equal(q.form.kind,'declension');assert.deepEqual(q.form.path,['dat',0]);assert.equal(q.form.alternativeIndex,1);
});
test('invalid or ambiguous explicit targets do not fall back to a different occurrence',()=>{
 for(const focus of [null,{}, {text:'gut',start:4},{text:'absent',start:0},{text:'gut',start:-1}])assert.equal(clozeQuestions([{...word,examples:[{de:text,focus}]}]).length,0);
 assert.equal(clozeQuestions([{...word,examples:[{de:'gut und gut',focus:{text:'gut'}}]}]).length,0);
 assert.equal(clozeQuestions([{...word,examples:[{de:'gut und gut',focus:{text:'gut',start:8}}]}])[0].start,8);
});
test('legacy examples without explicit focus retain their previous lemma and form lookup',()=>{
 const [q]=clozeQuestions([{...word,examples:[{de:text}]}]);assert.equal(q.start,0);assert.equal(q.answer,'Gut');assert.equal(q.form.kind,'lemma');
 const old=snapshotQuestion(q);clozeQuestions([word]);assert.equal(old.start,0);assert.equal(old.answer,'Gut');
});

test('inflected adjective distractors use the same possible degree and endings',()=>{
 const q=clozeQuestions([word])[0],modern={id:'modern',lemma:'modern',pos:'adjective'};
 assert.deepEqual(clozeOptions(q,[word,modern],()=>0).map(o=>o.text).sort(),['gute','moderne']);
 const high={...word,id:'high',lemma:'hoch',examples:[{de:'Das ist eine hohe Mauer.',focus:{start:13,text:'hohe'}}]};
 const expensive={id:'expensive',lemma:'teuer',pos:'adjective'};
 assert.deepEqual(clozeOptions(clozeQuestions([high])[0],[high,expensive],()=>0).map(o=>o.text).sort(),['hohe','teure']);
});
test('ambiguous adjective morphology excludes a distractor that cannot fit every analysis',()=>{
 const loud={...word,id:'loud',lemma:'laut',comparative:'lauter',examples:[{de:'Ein lauter Ton.',focus:{start:4,text:'lauter'}}]};
 const large={id:'large',lemma:'groß',comparative:'größer',pos:'adjective'},bright={id:'bright',lemma:'hell',comparative:'heller',pos:'adjective'};
 const options=clozeOptions(clozeQuestions([loud])[0],[loud,large,bright],()=>0);
 assert.deepEqual(options.map(o=>o.text).sort(),['heller','lauter']);
});
test('explicit unsupported inflection does not manufacture an uninflected adjective distractor',()=>{
 const unknown={...word,examples:[{de:'Eine unerfasste Form.',focus:{start:5,text:'unerfasste'}}]};
 const options=clozeOptions(clozeQuestions([unknown])[0],[unknown,{id:'modern',lemma:'modern',pos:'adjective'}]);
 assert.equal(options.length,1);
});

test('legacy Cloze recognises each standalone plural citation separately',()=>{
 const cactus={id:'cactus',lemma:'Kaktus',pos:'noun',plural:'Kakteen / Kaktusse',examples:[{de:'Am Fenster stehen drei Kaktusse.'}]};
 const q=clozeQuestions([cactus])[0];assert.equal(q.answer,'Kaktusse');assert.equal(q.form.kind,'plural');assert.equal(q.form.alternativeIndex,1);
 const pizza={id:'pizza',lemma:'Pizza',pos:'noun',plural:'Pizzen / Pizzas'};
 const options=clozeOptions(q,[cactus,pizza],()=>0);assert.deepEqual(options.map(r=>r.text).sort(),['Kaktusse','Pizzas']);
 const saved=snapshotQuestion(q),before=JSON.stringify(saved);clozeOptions(saved,[cactus,pizza]);assert.equal(JSON.stringify(saved),before);
});
test('plural distractors omit missing forms and fall back to a supported alternative',()=>{
 const book={id:'books',lemma:'Buch',pos:'noun',plural:'Bücher',examples:[{de:'Dort liegen die Bücher.'}]};
 const cactus={id:'cactus',lemma:'Kaktus',pos:'noun',plural:'Kakteen / Kaktusse'};
 const mass={id:'water',lemma:'Wasser',pos:'noun'},unknown={id:'unknown',lemma:'Hoffnung',pos:'noun',plural:'—'};
 const q=clozeQuestions([book])[0],options=clozeOptions(q,[book,cactus,mass,unknown],()=>0);
 assert.deepEqual(options.map(r=>r.text).sort(),['Bücher','Kakteen']);assert.ok(options.every(r=>!r.text.includes('/')));
 const alternate=clozeQuestions([{...cactus,examples:[{de:'Dort stehen Kaktusse.'}]}])[0];assert.deepEqual(clozeOptions(alternate,[alternate.word,book],()=>0).map(r=>r.text).sort(),['Bücher','Kaktusse']);
});
for(const [kind,forms,sentence,answer,other] of [
 ['comparative','schmaler / schmäler','Dieser Weg ist schmäler.','schmäler','dünner'],
 ['superlative','am schmalsten / am schmälsten','Dieser Weg ist am schmälsten.','am schmälsten','am dünnsten'],
])test(`standalone ${kind} alternatives use the same parser without uninflected substitutes`,()=>{
 const narrow={id:'narrow',lemma:'schmal',pos:'adjective',[kind]:forms,examples:[{de:sentence}]};
 const thin={id:'thin',lemma:'dünn',pos:'adjective',[kind]:other},missing={id:'small',lemma:'klein',pos:'adjective'};
 const q=clozeQuestions([narrow])[0];assert.equal(q.answer,answer);assert.equal(q.form.kind,kind);assert.equal(q.form.alternativeIndex,1);
 assert.deepEqual(clozeOptions(q,[narrow,thin,missing],()=>0).map(r=>r.text).sort(),[answer,other].sort());
});
