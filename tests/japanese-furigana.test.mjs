import test from 'node:test';
import assert from 'node:assert/strict';
import {renderJapaneseRuby,createJapaneseFurigana} from '../web/js/shared/japanese-furigana.js';
test('known Japanese readings attach above kanji groups while written kana stays outside',()=>{
 for(const [text,reading,html]of [['食べる','たべる','<ruby>食<rt>た</rt></ruby>べる'],['学校','がっこう','<ruby>学校<rt>がっこう</rt></ruby>'],['お土産','おみやげ','お<ruby>土産<rt>みやげ</rt></ruby>'],['取り扱う','とりあつかう','<ruby>取<rt>と</rt></ruby>り<ruby>扱<rt>あつか</rt></ruby>う'],['パン','パン','パン']])assert.equal(renderJapaneseRuby(text,reading),html);
 assert.ok(!renderJapaneseRuby('<img>食','た').includes('<img>'));assert.equal(renderJapaneseRuby('食','unknown'),'食');
});
test('sentence furigana uses exact dictionary/forms and respects ambiguity and punctuation',()=>{
 const words=[{id:'school',lemma:'学校',pronunciation:'がっこう'},{id:'eat',lemma:'食べる',pronunciation:'たべる'},{id:'today',lemma:'今日',pronunciation:'きょう'},{id:'nowadays',lemma:'今日',pronunciation:'こんにち'},{id:'come',lemma:'来る',pronunciation:'くる'},{id:'go',lemma:'行く',pronunciation:'いく'}];
 const data={forms:[{entryId:'eat',groups:[{formKind:'negative',answers:['食べない','たべない']},{formKind:'past',answers:['食べた','たべた']}]},{entryId:'come',groups:[{formKind:'negative',answers:['来ない','こない']}]},{entryId:'go',groups:[{formKind:'negative',answers:['行かない','いかない']},{formKind:'past',answers:['行った','いった']}]}]};
 const view=createJapaneseFurigana(words,data,{excludedSpellings:['今日']});
 assert.match(view.renderSentence('学校で食べました。'),/<ruby>学校<rt>がっこう<\/rt><\/ruby>で<ruby>食<rt>た<\/rt><\/ruby>べました。/);
 assert.equal(view.renderSentence('今日、未知語。'),'今日、未知語。');assert.match(view.renderSentence('今日。',words[2]),/<rt>きょう<\/rt>/);
 assert.match(view.renderSentence('来ます。'),/<ruby>来<rt>き<\/rt><\/ruby>ます。/);assert.match(view.renderSentence('来ない。'),/<rt>こ<\/rt>/);assert.match(view.renderSentence('行きます。'),/<rt>い<\/rt>/);assert.match(view.renderSentence('行った。'),/<rt>い<\/rt>/);
 assert.equal(view.renderQuestion({kind:'word',word:words[1],answer:'食べる'}),'<ruby>食<rt>た</rt></ruby>べる');
 assert.ok(!view.renderSentence('学校。').includes('<rt>。</rt>'));
 const ambiguous=createJapaneseFurigana(words,data,{variants:[{entryId:'go',readings:['いく','ゆく']}]});assert.equal(ambiguous.renderSentence('行きます。'),'行きます。');assert.match(ambiguous.renderSentence('行きます。',words[5]),/<rt>い<\/rt>/);
});
