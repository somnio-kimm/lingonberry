import test from 'node:test';
import assert from 'node:assert/strict';
import {projectScrambleTiles} from '../web/js/shared/lexicon-sentences.js';
test('view projection preserves duplicate glyph objects and chosen/pool order',()=>{
 const first={hanzi:'人',pinyin:'rén'},second={hanzi:'人',pinyin:'rén'},period={hanzi:'。',pinyin:''},chosen=[first],pool=[period,second],before=structuredClone({chosen,pool});const view=projectScrambleTiles(chosen,pool,tile=>tile.hanzi);
 assert.deepEqual(view.tokens,['人','。','人']);assert.deepEqual(view.chosenTokens,[0]);assert.deepEqual(view.pool.filter(id=>!view.chosenTokens.includes(id)),[1,2]);assert.equal(view.tiles[2],second);assert.deepEqual({chosen,pool},before);
});
test('an empty answer retains every source token and punctuation as distinct indices',()=>{
 const pool=[{text:'“'},{text:'Hello'},{text:','},{text:'world'},{text:'”'}],view=projectScrambleTiles([],pool,tile=>tile.text);assert.deepEqual(view.tokens,['“','Hello',',','world','”']);assert.deepEqual(view.pool,[0,1,2,3,4]);assert.deepEqual(view.chosenTokens,[]);assert.equal(projectScrambleTiles([],[],String).tokens.length,0);
});
