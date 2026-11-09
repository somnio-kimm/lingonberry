import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEnglishSenseExamples} from '../scripts/content/english-sense-examples.mjs';

test('sense audit checks distinct examples across levels, including the visible reference fallback', () => {
 const money = {id:'money',word:'bank',partOfSpeech:'noun',level:'IELTS 1.0–3.5',
  meaning:'A financial institution.',example:{text:'The bank approved my loan.'}};
 const river = {id:'river',word:'bank',partOfSpeech:'noun',level:'IELTS 4.0–6.5',
  meaning:'The edge of a river.',referenceExamples:[{text:'A willow grew on the river bank.'}]};
 const audit = (...entries) => auditEnglishSenseExamples({
  targetLanguage:'en',explanationLanguage:'en',entries,
 });

 assert.deepEqual(audit(money,river),{
  repeatedHeadwords:1,entriesUnderRepeatedHeadwords:2,acrossLevels:1,
  missingExamples:[],repeatedExamples:[],combinedMeanings:[],
 });
 assert.deepEqual(audit(money,{...river,referenceExamples:[]}).missingExamples,['river']);
 assert.deepEqual(audit(money,{...river,example:{text:'  THE BANK approved my loan. '}}).repeatedExamples,[
  {word:'bank',ids:['money','river']},
 ]);
 assert.deepEqual(audit({...money,meanings:[money.meaning,river.meaning]}).combinedMeanings,['money']);
});
