import test from 'node:test';
import assert from 'node:assert/strict';
import {japaneseReadingContext} from '../web/js/shared/japanese-reading-prompt.js';
const word={lemma:'学校',studyMeaning:'school',examples:[{text:'学校へ行きます。',studyTranslation:'I go to school.'}]};
test('sentence clues use the matching complete translation',()=>{assert.equal(japaneseReadingContext(word,'学校へ行きます。'),'I go to school.');});
test('a word gloss is not substituted for an unmatched sentence translation',()=>{assert.equal(japaneseReadingContext(word,'学校で会いました。','school'),'');assert.equal(japaneseReadingContext(word,'学校で会いました。','We met at school.'),'We met at school.');});
test('a standalone reading question keeps its concise word meaning',()=>{assert.equal(japaneseReadingContext(word,'学校'),'school');});
