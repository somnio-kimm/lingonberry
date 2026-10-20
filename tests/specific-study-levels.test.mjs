import test from 'node:test';
import assert from 'node:assert/strict';
import {createLexiconStore} from '../web/js/shared/lexicon-store.js';
import {studyProfiles,matchesStudyLevel} from '../web/js/presentation/study-profiles.js';
for(const profile of Object.values(studyProfiles))test(profile.id+': migrate All to the first level without losing progress or history',()=>{
 const key=`learn-language.${profile.id}.lexicon.v1`,saved={version:1,wordStatus:{word:'mastered'},wrongs:{wrong:{count:2}},preferences:{studyLevel:'all',uiLanguage:'ko'}},data=new Map([[key,JSON.stringify(saved)]]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const store=createLexiconStore(storage,profile);assert.equal(store.state.preferences.studyLevel,profile.levels[0]);assert.deepEqual(store.state.wordStatus,saved.wordStatus);assert.deepEqual(store.state.wrongs,saved.wrongs);assert.equal(store.state.preferences.uiLanguage,'ko');assert.equal(JSON.parse(data.get(key)).preferences.studyLevel,profile.levels[0]);
 assert.throws(()=>store.preference('studyLevel','all'));assert.equal(matchesStudyLevel({level:profile.levels[1]},'all',profile),false);store.preference('studyLevel',profile.levels[1]);assert.equal(createLexiconStore(storage,profile).state.preferences.studyLevel,profile.levels[1]);
});
