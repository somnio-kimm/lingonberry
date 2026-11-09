import test from 'node:test';
import assert from 'node:assert/strict';
import {createVocabularyEngine} from '../web/js/shared/vocabulary.js';

const noun=(id,lemma,meaning_en,extra={})=>({id,lemma,pos:'noun',meaning_en, ...extra});
const financial=noun('bank-money','bank','a financial institution');
const riverside=noun('bank-river','bank','the land beside a river');
const shore=noun('shore','shore','the land beside a river');
const chair=noun('chair','chair','a seat for one person');
const selected=[financial,shore,chair];
const engine=createVocabularyEngine();
const questions=(words,meaningWords,locale='en')=>engine.createVocabularyPool(
 'vocabmeaning',words,locale,'vocabulary',{meaningWords},
).all(()=>0);

test('another bank meaning outside the selected level or study status cannot be a wrong option',()=>{
 const rows=questions(selected,[...selected,riverside]);
 const bank=rows.find(row=>row.word.id===financial.id);
 assert.deepEqual(new Set(bank.options.map(row=>row.id)),new Set(['bank-money','chair']));
 assert.ok(rows.every(row=>selected.includes(row.word)));
 assert.ok(rows.every(row=>row.options.every(option=>option.type==='noun'&&selected.some(word=>word.id===option.id))));
});

test('known meanings include reviewed spelling aliases and the chosen explanation language',()=>{
 const colour=noun('colour','colour','hue',{aliases:['color'],meaning_ko:'색상'});
 const character=noun('colour-character','color','character',{aliases:['colour'],meaning_ko:'특색'});
 const feature=noun('feature','feature','character',{meaning_ko:'특색'});
 const seat={...chair,meaning_ko:'의자'};
 const q=questions([colour,feature,seat],[colour,feature,seat,character],'ko').find(row=>row.word.id===colour.id);
 assert.deepEqual(new Set(q.options.map(row=>row.text)),new Set(['색상','의자']));
});

test('a filtered pool with no unambiguous wrong choice omits the question',()=>{
 assert.equal(questions([financial,shore],[financial,shore,riverside]).some(row=>row.word.id===financial.id),false);
});

test('an installed replacement inventory refreshes known meanings without changing the study filter',()=>{
 const before=questions(selected,[...selected]);
 assert.ok(before.find(row=>row.word.id===financial.id).options.some(row=>row.id===shore.id));
 const replacement=[...selected,riverside];
 assert.ok(!questions(selected,replacement).find(row=>row.word.id===financial.id).options.some(row=>row.id===shore.id));
});
