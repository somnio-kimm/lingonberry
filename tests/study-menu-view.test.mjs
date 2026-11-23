import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStudyMenu,renderStudyLevels} from '../web/js/shared/study-menu-view.js';
test('menu variants preserve route IDs and provide one decorative shared icon per button',()=>{
 for(const variant of ['menu','quiz']){const html=renderStudyMenu([{id:'flashcard',label:'플래시카드'}],{variant,label:'학습'});assert.match(html,/플래시카드/);assert.match(html,/aria-label="학습"/);assert.match(html,new RegExp(variant==='quiz'?'data-quiz="flashcard"':'data-route="flashcard"'));assert.equal((html.match(/<svg /gu)||[]).length,1);assert.match(html,/type="button"/);}
});
test('labels and identifiers cannot inject markup or handlers',()=>{const html=renderStudyMenu([{id:'" onclick="x',label:'<script>'}],{label:'"study"'});assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/ onclick="x/);assert.throws(()=>renderStudyMenu([],{variant:'raw"'}));});
test('numeric HSK levels and ordinary level strings select the same logical value',()=>{
 const hsk=renderStudyLevels({title:'학습 레벨',levels:[{id:1,label:'HSK 1'},{id:7,label:'HSK 7–9'}],selected:'7',variant:'hsk'});assert.match(hsk,/class="hsk-chip active" data-lv="7" aria-pressed="true"/);assert.equal((hsk.match(/aria-pressed="true"/gu)||[]).length,1);
 const normal=renderStudyLevels({title:'Study Level',levels:[{id:'N5',label:'JLPT N5'}],selected:'N5'});assert.match(normal,/data-level="N5" aria-pressed="true"/);assert.match(normal,/role="group"/);
});
test('wide labels reuse the established layout without changing level text',()=>{const html=renderStudyLevels({title:'Study Level',levels:[{id:'IELTS 1.0–3.5',label:'IELTS 1.0–3.5'}],selected:'IELTS 1.0–3.5',wideLabels:true});assert.match(html,/english-level-options/);assert.match(html,/>IELTS 1.0–3.5<\/button>/);assert.throws(()=>renderStudyLevels({title:'x',levels:[],variant:'raw'}));});
