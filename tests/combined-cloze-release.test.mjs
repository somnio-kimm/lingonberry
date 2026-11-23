import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseCombinedCloze,clearCombinedClozeCache} from '../web/js/shared/combined-cloze.js';
import {createLexiconQuestions} from '../web/js/shared/lexicon-questions.js';
import {studyProfiles} from '../web/js/presentation/study-profiles.js';
test('content release clears only the requested combined preparation and both answer modes',()=>{
 const engine=createLexiconQuestions(studyProfiles.en),other=createLexiconQuestions(studyProfiles.en),words=['cat','dog','bird'].map(lemma=>({id:lemma,lemma,pos:'noun',studyMeaning:lemma,studyExplanationLanguage:'en',examples:[{text:`The ${lemma} is here.`,studyTranslation:'Here.'}]})),exercises=[];
 const draw=(owner,answerMode='choice')=>chooseCombinedCloze({engine:owner,words,exercises,locale:'en',answerMode,random:()=>0});
 for(const mode of ['choice','input']){assert.equal(draw(engine,mode).word.id,'cat');assert.equal(draw(engine,mode).word.id,'dog');}
 assert.equal(draw(other).word.id,'cat');clearCombinedClozeCache(engine);clearCombinedClozeCache(engine);
 for(const mode of ['choice','input'])assert.equal(draw(engine,mode).word.id,'cat');
 assert.equal(draw(other).word.id,'dog','Releasing one study does not reset another engine');
});
