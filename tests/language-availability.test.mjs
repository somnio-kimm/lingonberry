import test from 'node:test';
import assert from 'node:assert/strict';
import {AVAILABLE_STUDY_LANGUAGES,STUDY_LANGUAGES,isStudyLanguageAvailable,allowsExplanation,explanationMatrix} from '../web/js/shared/language-pairs.js';

test('only the four released study languages are visible, independently of explanation support',()=>{
 assert.deepEqual(AVAILABLE_STUDY_LANGUAGES,['de','en','ja','zh']);
 for(const language of ['fr','es','ko',undefined,null,'unknown'])assert.equal(isStudyLanguageAvailable(language),false);
 for(const language of AVAILABLE_STUDY_LANGUAGES){assert.equal(isStudyLanguageAvailable(language),true);assert.equal(allowsExplanation(language,'ko'),true);}
 assert.equal(STUDY_LANGUAGES.length,7);assert.equal(explanationMatrix().length,43);
});
