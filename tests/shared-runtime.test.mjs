import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotQuestion} from '../web/js/shared/question-snapshot.js';
import {selectDeviceVoice,createDeviceSpeech} from '../web/js/shared/device-speech.js';
import {collectBugDiagnostics} from '../web/js/shared/bug-diagnostics.js';
import {prepareBugReport} from '../web/js/shared/bug-report.js';

test('review snapshots retain the selected explanation and detach nested answers',()=>{
 const question={word:{id:'de-haus',lemma:'Haus',studyMeaning:'집',studyExplanationLanguage:'ko',unused:'large data'},options:[{text:'집'}]};
 const saved=snapshotQuestion(question);question.options[0].text='changed';
 assert.equal(saved.options[0].text,'집');assert.equal(saved.word.studyExplanationLanguage,'ko');assert.equal(saved.word.unused,undefined);
});
test('device voices prefer installed matching languages and reject remote voices',()=>{
 const voices=[{lang:'de-DE',localService:false},{lang:'de-AT',localService:true},{lang:'de-DE',localService:true}];
 assert.equal(selectDeviceVoice(voices,'de-DE'),voices[2]);assert.equal(selectDeviceVoice(voices,'ko-KR'),undefined);
 assert.equal(selectDeviceVoice([{lang:'zh-HK',localService:true}],'zh-CN'),undefined);
});
test('missing device speech reports an error without claiming playback completed',async()=>{
 const errors=[];const speech=createDeviceSpeech({});
 assert.equal(await speech.speak('Haus',{language:'de-DE',onError:code=>errors.push(code),onEnd:()=>assert.fail('No voice played')}),false);
 assert.deepEqual(errors,['NO_VOICE']);
});
test('reports retain English form language and fallback OS diagnostics',async()=>{
 const diagnostics=await collectBugDiagnostics({app:'Learn German',webVersion:'0.1.0',uiLanguage:'ko',theme:'system',studyLevel:'A1'},{navigator:{userAgent:'iPhone OS 27_0',language:'ko',onLine:true}});
 assert.match(diagnostics,/OS: iOS 27.0/);const url=new URL(prepareBugReport({app:'Learn German',diagnostics}).url);
 assert.equal(url.searchParams.get('hl'),'en');assert.equal(url.searchParams.get('entry.582897232'),'Learn German');
});
test('shared HTML escaping protects text and attribute interpolations',async()=>{
 const {escapeHtml}=await import('../web/js/shared/ui.js');
 assert.equal(escapeHtml('<img src="x" onerror=\'bad\'>&'),'&lt;img src=&quot;x&quot; onerror=&#39;bad&#39;&gt;&amp;');assert.equal(escapeHtml(null),'');
});
