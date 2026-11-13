import assert from 'node:assert/strict';
import test from 'node:test';
import {createStore} from '../web/languages/de/js/core/store.js';
import {wrongEntries} from '../web/languages/de/js/core/wrong.js';
import {reviewItems} from '../web/languages/de/js/core/retest.js';

test('historical course notes and answers survive reopening and a saved-question retest',()=>{
 const question={id:'old-question',prompt:'Ich ___ hier.',accepted:['wohne'],answer:'wohne'},unit={id:'old-unit',level:'A1',reading:{questions:[question]}};
 const oldUnit={stage:'practice',drafts:{writing:'My saved draft'},checks:{reading:{0:true}},listened:true,transcriptShown:true,recording:{id:'saved-recording'},hints:{'old-question':true},answers:{'old-question':{input:'wohnen',correct:false,run:3,attempts:[{input:'wohnen',correct:false,run:3,at:10}]}}};
 const values=new Map([['learn-language.de.progress.v1',JSON.stringify({version:1,units:{'old-unit':oldUnit},concepts:{},skills:{},lastUnit:'old-unit'})]]),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const store=createStore(storage);assert.deepEqual(store.state.units['old-unit'],oldUnit);
 const rows=wrongEntries([unit],store.state,[]),retest=reviewItems(rows,new Map());assert.equal(retest.unavailable.length,0);assert.equal(retest.items[0].mode,'saved');assert.equal(retest.items[0].question.prompt,question.prompt);
 store.recordReviewAnswer(unit.id,question,'wohne',{correct:true,explanation:'Original review'});
 const restored=createStore(storage).state.units[unit.id];assert.deepEqual(restored.answers[question.id].attempts[0],oldUnit.answers[question.id].attempts[0]);assert.equal(restored.answers[question.id].attempts[1].review,true);assert.equal(restored.answers[question.id].attempts[1].run,3);
 for(const field of ['stage','drafts','checks','listened','transcriptShown','recording','hints'])assert.deepEqual(restored[field],oldUnit[field]);
});
