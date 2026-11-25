import test from 'node:test';
import assert from 'node:assert/strict';
import {meaningDisplayLines,renderStudyMeaning,renderQuizMeaning,renderQuizMeaningChoices} from '../web/js/shared/meaning-display.js';

test('semicolons inside a gloss keep comparable meanings on the same line',()=>{
 assert.deepEqual(meaningDisplayLines('쉽다; 간단하다'),['쉽다, 간단하다']);
 assert.deepEqual(meaningDisplayLines('easy; simple'),['easy, simple']);
});
test('Chinese usage groups separate the clock sense from point and spot',()=>{
 const meaning='시(시각 단위) (양사, HSK 1); 점; 지점 (추가 사전 용법)';
 assert.deepEqual(meaningDisplayLines(meaning),['시','점, 지점']);
 assert.equal(renderQuizMeaning(meaning),'시 시각 단위<br>점, 지점');
});
test('separately recorded senses stay separate in a grouped dictionary card',()=>{
 const senses=[{studyMeaning:'호소; 요청'},{studyMeaning:'항소; 이의 신청'}];
 const word={senses,studyMeaning:'호소; 요청; 항소; 이의 신청'};
 assert.deepEqual(meaningDisplayLines(word.studyMeaning,word),['호소, 요청','항소, 이의 신청']);
});
test('reviewed unmarked senses render consistently in dictionary and quiz',()=>{
 const word={id:'hsk2_26'},meaning='치다; (전화를) 걸다; (구기 운동을) 하다';
 assert.deepEqual(meaningDisplayLines(meaning,word),['치다','걸다','하다']);
 assert.equal(renderQuizMeaning(meaning,word),'치다<br>전화를 걸다<br>구기 운동을 하다');
 assert.deepEqual(renderQuizMeaningChoices([{...word,text:meaning},{id:'b',text:'닫다; 닫아 놓다'}]),['치다<br>전화를 걸다<br>구기 운동을 하다','닫다, 닫아 놓다']);
});
test('nested notes are removed without splitting commas and content stays escaped',()=>{
 assert.deepEqual(meaningDisplayLines(['  red, orange （rare (literary; old)）; blue','green']),['red, orange, blue','green']);
 assert.equal(renderStudyMeaning(['<b>first</b> (old)','Fish & chips']), '&lt;b&gt;first&lt;/b&gt;<br>Fish &amp; chips');
});
test('historical quiz choices keep their original distinctions if the projection collides',()=>{
 const options=[{id:'a',text:'study (HSK 1)'},{id:'b',text:'study (HSK 4)'}],before=structuredClone(options);
 assert.deepEqual(renderQuizMeaningChoices(options),['study (HSK 1)','study (HSK 4)']);
 assert.deepEqual(options,before);
});
