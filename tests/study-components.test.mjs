import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStudySearch,renderStudyTabs,renderStudyReferenceHeading,renderStudyQuizHeader,renderStudyReviewFilters} from '../web/js/shared/study-components.js';
test('shared search preserves typed text safely and uses the established device-search input',()=>{
 const html=renderStudySearch({id:'query',value:'<script>"',label:'검색'});assert.match(html,/class="card study-search"/);assert.match(html,/inputmode="text"/);assert.match(html,/enterkeyhint="search"/);assert.match(html,/aria-label="검색"/);assert.ok(!html.includes('<script>'));
});
test('shared choices retain order, selected state and safe event attributes',()=>{
 const html=renderStudyTabs({label:'Answer Mode',options:[{value:'choice',label:'Selection'},{value:'input',label:'Typing'}],selected:'input',attribute:'data-answer-mode'});assert.ok(html.indexOf('Selection')<html.indexOf('Typing'));assert.match(html,/data-answer-mode="input" aria-pressed="true"/);assert.match(html,/role="group"/);assert.throws(()=>renderStudyTabs({options:[],attribute:'onclick'}),/safe data attribute/);
});
test('reference heading uses shared typography classes and escapes source text',()=>{
 const html=renderStudyReferenceHeading({word:'<aud>',origin:'Latin'});assert.match(html,/study-reference-heading/);assert.match(html,/&lt;aud&gt;/);assert.match(html,/study-reference-origin/);
});

test('Dictation tabs reuse the German/Chinese full-width control variant with safe labels',()=>{
 const html=renderStudyTabs({label:'받아쓰기 모드',options:[{value:'word',label:'단어'},{value:'sentence',label:'문장 <>'}],selected:'word',attribute:'data-kind',variant:'listening'});
 assert.match(html,/class="listening-mode-controls"/);assert.match(html,/class="btn-small" data-kind="word" aria-pressed="true"/);assert.ok(html.indexOf('단어')<html.indexOf('문장'));assert.match(html,/문장 &lt;&gt;/);assert.throws(()=>renderStudyTabs({options:[],attribute:'data-kind',variant:'unknown'}),/variant/);
});

test('Dictation header keeps the initial score and baseline header geometry instead of omitting zero',()=>{
 const html=renderStudyQuizHeader({title:'<Dictation>'});assert.match(html,/vocab-quiz-header/);assert.match(html,/&lt;Dictation&gt;/);assert.match(html,/class="score-pill">0 \/ 0<\/span>/);
 assert.match(renderStudyQuizHeader({title:'Dictation',score:{correct:2,total:3}}),/>2 \/ 3<\/span>/);
});


test('combined Review filters preserve groups, counts, selection and escaped package values',()=>{
 const html=renderStudyReviewFilters({open:true,groups:[{key:'mode',title:'Exercise Type',selected:'cloze',options:[{value:'cloze',label:'Cloze',count:2},{value:'<x>',label:'<Unsafe>',count:0}]}]});
 assert.match(html,/wrong-filter-panel" open/);assert.match(html,/data-review-filter="mode" data-value="cloze" aria-pressed="true">Cloze \(2\)/);
 assert.match(html,/data-value="&lt;x&gt;"/);assert.ok(!html.includes('<Unsafe>'));
});
