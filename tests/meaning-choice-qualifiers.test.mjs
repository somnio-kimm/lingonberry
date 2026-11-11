import test from'node:test';import assert from'node:assert/strict';import{createVocabularyEngine}from'../web/js/shared/vocabulary.js';
const word=(id,lemma,en,ko=en)=>({id,lemma,pos:'noun',meaning_en:[en],meaning_ko:[ko]});
const others=()=>[word('bird','Vogel','bird','새'),word('stone','Stein','stone','돌'),word('house','Haus','house','집')];
for(const locale of['en','ko'])test(`qualified retained mushroom meaning cannot become a wrong option in ${locale}`,()=>{
 const target=word('marone','Marone','chestnut; bay bolete (colloquial mushroom name)','밤; 갈색그물버섯(구어)'),sibling=word('bolete','Maronenröhrling','bay bolete','갈색그물버섯'),engine=createVocabularyEngine();const q=engine.vocabularyQuestions('vocabmeaning',[target,sibling,...others()],locale,()=>.999)[0];assert.equal(q.options.length,4);assert.ok(!q.options.some(o=>o.id==='bolete'));assert.ok(q.options.find(o=>o.id==='marone').text.includes(locale==='en'?'(colloquial mushroom name)':'(구어)'));
});
test('qualifier-insensitive wrong-choice blocking never merges exact Word Input senses',()=>{
 const finance=word('finance','Bank','bank (finance)'),river=word('river','Ufer','bank (river)'),engine=createVocabularyEngine();const q=engine.vocabularyQuestions('vocabinput',[finance,river],'en')[0];assert.deepEqual(q.acceptedAnswers,['Bank']);assert.equal(engine.vocabularyAnswerCorrect(q,'Ufer'),false);assert.equal(engine.vocabularyAnswerCorrect(q,'Bank'),true);
});
test('nested and fullwidth qualifiers are conservative distractor keys only',()=>{
 const target=word('marone','Marone','chestnut; bay bolete （a mushroom (colloquial)）'),sibling=word('bolete','Maronenröhrling','bay bolete'),engine=createVocabularyEngine();const q=engine.vocabularyQuestions('vocabmeaning',[target,sibling,...others()],'en',()=>.999)[0];assert.ok(!q.options.some(o=>o.id==='bolete'));assert.equal(q.options.find(o=>o.id==='marone').text,'chestnut; bay bolete （a mushroom (colloquial)）');
});
