import test from 'node:test';
import assert from 'node:assert/strict';
import {listEnglishProposalFiles,assertEnglishProposalLedger} from '../scripts/content/english-review-files.mjs';
import {exampleDigest} from '../scripts/content/reviewed-examples.mjs';

test('numbered authored ledgers join review without importing model drafts or review outputs',()=>{
 assert.deepEqual(listEnglishProposalFiles(['headword-additions-10.jsonl','headword-additions-2.jsonl',
  'expression-additions-1.jsonl','sense-additions-7.jsonl','qwen-drafts.jsonl','supplemental-review-1-decisions.jsonl',
  'headword-additions-2-input.jsonl','headword-additions-latest.jsonl']),[
  'root-additional-senses.jsonl','useful-expression-additions.jsonl',
  'expression-additions-1.jsonl','headword-additions-2.jsonl','headword-additions-10.jsonl','sense-additions-7.jsonl',
 ]);
});

test('author identity and frozen selection both bind a proposal to its numbered batch',()=>{
 const input={word:'synchronize'},other={word:'different'};
 const row={reviewer:'english-headword-author-2',selectionDigest:exampleDigest(input),candidate:{word:'synchronise'}};
 assert.doesNotThrow(()=>assertEnglishProposalLedger('headword-additions-2.jsonl',[row],[input]));
 assert.throws(()=>assertEnglishProposalLedger('headword-additions-3.jsonl',[row],[input]),/different authoring batch/);
 assert.throws(()=>assertEnglishProposalLedger('headword-additions-2.jsonl',[row],[other]),/different authoring batch/);
 assert.throws(()=>assertEnglishProposalLedger('headword-additions-2.jsonl',[row]),/Missing frozen/);
 assert.doesNotThrow(()=>assertEnglishProposalLedger('expression-additions-1.jsonl',[{reviewer:'root-sense-review'}]));
});
