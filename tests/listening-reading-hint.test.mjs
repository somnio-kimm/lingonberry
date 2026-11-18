import test from 'node:test';
import assert from 'node:assert/strict';
import {listeningReadingHint} from '../web/js/shared/listening.js';
import {listeningLabels} from '../web/js/shared/listening-text.js';
import {germanWords,chineseWords} from '../web/js/presentation/words.js';
test('word hints use supplied IPA, kana or pinyin without changing the answer',()=>{
 for(const [answer,pronunciation]of [['car','/kɑː/'],['車','くるま'],['车','chē']]){const q={kind:'word',answer,word:{pronunciation}};assert.equal(listeningReadingHint(q),pronunciation);assert.equal(q.answer,answer);}
});
test('sentence, missing and answer-identical readings do not fabricate a hint',()=>{
 assert.equal(listeningReadingHint({kind:'sentence',answer:'Hello',word:{pronunciation:'/həˈləʊ/'}}),'');
 assert.equal(listeningReadingHint({kind:'word',answer:'car',word:{}}),'');
 assert.equal(listeningReadingHint({kind:'word',answer:'かな',word:{pronunciation:'かな'}}),'');
});
test('legacy adapters preserve the imported pronunciation and labels follow the display language',()=>{
 for(const adapt of [germanWords,chineseWords]){const word=adapt({targetLanguage:adapt===germanWords?'de':'zh',explanationLanguage:'en',entries:[{id:'a',word:'word',partOfSpeech:'noun',meaning:'word',pronunciation:'/word/'}]})[0];assert.equal(word.pronunciation,'/word/');}
 assert.equal(listeningLabels('ko').readingHint,'발음 힌트');assert.equal(listeningLabels('en').readingHint,'Pronunciation Hint');
});
