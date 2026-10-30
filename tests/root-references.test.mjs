import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePracticeData} from '../web/js/packages/practice-data.js';
const root={id:'root-la-claudere',term:'claudere',language:'la',members:[{entryId:'include',references:['https://en.wiktionary.org/wiki/include']},{entryId:'occlude',references:['https://en.wiktionary.org/wiki/occlude']}]};
const words=[{id:'include',lemma:'include',studyMeaning:'포함하다'},{id:'occlude',lemma:'occlude',studyMeaning:'막다'}];
test('reject unsafe source links, repeated members and unregistered entry IDs',()=>{
 const pack={kind:'study',targetLanguage:'en',entries:words,practiceData:{version:1,rootFamilies:[root]}};assert.doesNotThrow(()=>validatePracticeData(pack));
 for(const edit of [p=>p.practiceData.rootFamilies[0].members.push(root.members[0]),p=>p.practiceData.rootFamilies[0].members[0].references=['javascript:alert(1)'],p=>p.practiceData.rootFamilies[0].members[0].entryId='unknown']){const p=structuredClone(pack);edit(p);assert.throws(()=>validatePracticeData(p),/Invalid language package/);}
});
