import test from 'node:test';
import assert from 'node:assert/strict';
import {sentenceTokens,joinSentenceTokens,scrambleCorrect} from '../web/languages/de/js/core/sentence-quizzes.js';
import {Pinyin} from '../web/languages/zh/js/services/pinyin.js';
test('German commas and full stops are independent tiles and join naturally',()=>{
 const text='Ja, das ist gut.',tokens=['Ja',',','das','ist','gut','.'];
 assert.deepEqual(sentenceTokens(text),tokens);assert.equal(joinSentenceTokens(tokens),text);assert.equal(scrambleCorrect({example:{de:text}},tokens),true);
 assert.equal(scrambleCorrect({example:{de:text}},['Ja','das',',','ist','gut','.']),false);
 assert.equal(scrambleCorrect({example:{de:text}},['Ja',',','das','ist','gut']),false);
 // Existing saved token lists remain gradeable without rewriting records.
 assert.equal(scrambleCorrect({example:{de:text}},['Ja,','das','ist','gut.']),true);
});
test('Chinese sentence columns already keep punctuation separate with no pinyin',()=>{
 assert.deepEqual(Pinyin.sentenceColumns({hanzi:'好，好。',pinyin:'hao3 ， hao3 。'}),[{hanzi:'好',pinyin:'hǎo'},{hanzi:'，',pinyin:''},{hanzi:'好',pinyin:'hǎo'},{hanzi:'。',pinyin:''}]);
});
test('punctuation-free readings retain the same Chinese columns and blank alignment',()=>{
 const hanzi='好，好。';
 assert.deepEqual(Pinyin.sentenceColumns({hanzi,pinyin:'hao3 hao3'}),Pinyin.sentenceColumns({hanzi,pinyin:'hao3 ， hao3 。'}));
 const html=Pinyin.htmlSentence({hanzi:'有点儿咸。',pinyin:'you3 dianr3 xian2'},{blank:'点儿'});
 assert.match(html,/cloze-blank/);assert.match(html,/diǎnr/);
 assert.doesNotMatch(html,/class="example-pinyin"/);
 assert.deepEqual(Pinyin.sentenceColumns({hanzi:'「好！」',pinyin:'hao3'}),[
  {hanzi:'「',pinyin:''},{hanzi:'好',pinyin:'hǎo'},{hanzi:'！',pinyin:''},{hanzi:'」',pinyin:''},
 ]);
});
test('missing or extra spoken syllables still fail instead of shifting readings',()=>{
 assert.equal(Pinyin.sentenceColumns({hanzi:'你好。',pinyin:'ni3'}),null);
 assert.equal(Pinyin.sentenceColumns({hanzi:'你。',pinyin:'ni3 hao3'}),null);
});
