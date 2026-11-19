import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStudyReset} from '../web/js/shared/study-components.js';
test('reset is an icon button with a translated accessible name',()=>{const html=renderStudyReset({label:'초기화',id:'reset'});assert.match(html,/aria-label="초기화"/);assert.match(html,/<svg/);assert.doesNotMatch(html,/>초기화</);});
test('reset escapes names and rejects executable attribute names',()=>{assert.match(renderStudyReset({label:'"reset"',attribute:'data-sentence-reset'}),/&quot;reset&quot;/);assert.throws(()=>renderStudyReset({label:'Reset',attribute:'onclick=alert(1)'}));});
