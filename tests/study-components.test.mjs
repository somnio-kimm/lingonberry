import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStudySearch,renderStudyTabs,renderStudyReferenceHeading} from '../web/js/shared/study-components.js';
test('shared search preserves typed text safely and uses the established device-search input',()=>{
 const html=renderStudySearch({id:'query',value:'<script>"',label:'검색'});assert.match(html,/class="card study-search"/);assert.match(html,/inputmode="text"/);assert.match(html,/enterkeyhint="search"/);assert.match(html,/aria-label="검색"/);assert.ok(!html.includes('<script>'));
});
test('shared choices retain order, selected state and safe event attributes',()=>{
 const html=renderStudyTabs({label:'Answer Mode',options:[{value:'choice',label:'Selection'},{value:'input',label:'Typing'}],selected:'input',attribute:'data-answer-mode'});assert.ok(html.indexOf('Selection')<html.indexOf('Typing'));assert.match(html,/data-answer-mode="input" aria-pressed="true"/);assert.match(html,/role="group"/);assert.throws(()=>renderStudyTabs({options:[],attribute:'onclick'}),/safe data attribute/);
});
test('reference heading uses shared typography classes and escapes source text',()=>{
 const html=renderStudyReferenceHeading({word:'<aud>',origin:'Latin'});assert.match(html,/study-reference-heading/);assert.match(html,/&lt;aud&gt;/);assert.match(html,/study-reference-origin/);
});
