import test from 'node:test';
import assert from 'node:assert/strict';
import {rebuildReviewedEnglishReferences} from '../scripts/content/english-reviewed-references.mjs';

const credit={creator:'English Wiktionary contributors',license:'CC-BY-SA-4.0',url:'https://en.wiktionary.org/wiki/book'};
const entry=(id,word=id)=>({id,word,partOfSpeech:'noun'});
const translation=(id,meaning)=>({id,meaning});
function exercise(id,entryId='book',answer='book'){
 return {id,entryId,category:'collocations',route:'vocabinput',prompt:'Please read a ___.',answer,source:credit};
}
function fixture(){
 const entries=[entry('book'),entry('books'),entry('reader'),entry('removed'),entry('unpaired')];
 const englishEntries=entries.map(row=>translation(row.id,row.id==='books'?'A written work.':row.id==='book'?'A written work.':'A person who reads.'));
 const koreanEntries=entries.map(row=>translation(row.id,['book','books'].includes(row.id)?'책':'독자'));
 const exercises=[exercise('keep'),exercise('mapped','books','books'),exercise('removed','removed'),exercise('unpaired')];
 const pairExercises=locale=>exercises.filter(row=>row.id!=='unpaired'||locale==='en').map(row=>({id:row.id,
  instruction:locale==='en'?'Complete the sentence.':'문장을 완성하세요.',
  explanation:locale==='en'?'Use the stated noun.':'제시된 명사를 쓰세요.'}));
 const family={id:'family-book',root:'book',kind:'root',origin:'ang',source:credit,members:[
  {entryId:'book',word:'book',parts:'book'},
  {entryId:'books',word:'books',parts:'book + s'},
  {entryId:'removed',word:'removed'},
 ]};
 const morpheme={id:'morph-book',form:'book',variants:[],kind:'root',origin:'English',source:credit.url,
  examples:['book','books','reader','reference-only'],senses:[{id:'morph-book-0',tags:['root']},{id:'morph-book-1'}]};
 const basePair=locale=>({entries:structuredClone(locale==='en'?englishEntries:koreanEntries),exercises:pairExercises(locale),
  families:[{id:family.id,meaning:locale==='en'?'written work':'책',members:family.members.map(member=>({entryId:member.entryId,note:'Previous note.'}))}],
  morphemes:[{id:morpheme.id,senses:[{id:'morph-book-0',meaning:locale==='en'?'A written work.':'책'}]}]});
 return {baselineCore:{entries,exercises,families:[family],morphemes:[morpheme],practiceData:{version:1,
  countability:[{entryId:'book',labels:['countable'],references:[credit.url]},{entryId:'removed',labels:['countable'],references:[credit.url]}],
  rootFamilies:[{id:'historical-keep',term:'book',language:'ang',members:[
   {entryId:'books',references:[credit.url]},{entryId:'reader',references:['https://en.wiktionary.org/wiki/reader']}]},
  {id:'historical-collapse',term:'book',language:'ang',members:[{entryId:'book',references:[credit.url]},{entryId:'books',references:[credit.url]}]}]}},
  baselineEnglish:basePair('en'),baselineKorean:basePair('ko'),
  entries:[{...entry('book'),aliases:['books']},entry('reader'),entry('unpaired')],
  englishEntries:englishEntries.filter(row=>row.id!=='books'&&row.id!=='removed'),
  koreanEntries:koreanEntries.filter(row=>row.id!=='books'&&row.id!=='removed'),
  reviews:[{id:'book',verdict:'pass'},{id:'books',verdict:'reuse',mergeWith:'book'},
   {id:'reader',verdict:'pass'},{id:'removed',verdict:'exclude',excludedFromStudy:true},{id:'unpaired',verdict:'pass'}]};
}

test('baseline exercises survive only with active concepts and both original translations',()=>{
 const args=fixture(),before=structuredClone(args),result=rebuildReviewedEnglishReferences(args);
 assert.deepEqual(result.core.exercises.map(row=>row.id),['keep','mapped']);
 assert.equal(result.core.exercises[1].entryId,'book');
 assert.deepEqual(result.core.exercises[0].source,credit);
 assert.deepEqual(result.english.exercises,args.baselineEnglish.exercises.slice(0,2));
 assert.deepEqual(result.korean.exercises,args.baselineKorean.exercises.slice(0,2));
 assert.ok(result.report.dropped.some(row=>row.id==='removed'&&row.reason==='excluded-entry'));
 assert.ok(result.report.dropped.some(row=>row.id==='unpaired'&&row.reason==='missing-bilingual-exercise'));
 assert.deepEqual(args,before,'The helper must not mutate caller-owned packages or reviews.');
});

test('a changed sense or POS cannot retain old questions, and removed countability metadata stays absent',()=>{
 for(const change of ['meaning','pos']){
  const args=fixture();
  if(change==='meaning')args.englishEntries.find(row=>row.id==='book').meaning='A set of accounts.';
  else args.entries.find(row=>row.id==='book').partOfSpeech='verb';
  const result=rebuildReviewedEnglishReferences(args);
  assert.ok(!result.core.exercises.some(row=>row.id==='keep'||row.id==='mapped'));
  assert.equal(result.core.practiceData.countability,undefined);
  // Family notes come from the final paired definitions, never stale baseline notes.
  assert.equal(result.english.families[0].members[0].note,args.englishEntries.find(row=>row.id==='book').meaning);
  assert.equal(result.korean.families[0].members[0].note,'책');
 }
});

test('same spelling and arbitrary search aliases do not invent canonical ID mappings',()=>{
 const args=fixture();args.reviews=args.reviews.filter(row=>row.id!=='books');
 const result=rebuildReviewedEnglishReferences(args);
 assert.ok(!result.core.exercises.some(row=>row.id==='mapped'));
 assert.ok(result.report.dropped.some(row=>row.id==='mapped'&&row.reason==='inactive-or-unknown-entry'));
 assert.ok(!result.core.morphemes[0].examples.includes('books'));
});

test('explicit canonical chains resolve while cycles and invalid concepts remain unusable',()=>{
 const args=fixture();args.reviews.find(row=>row.id==='books').mergeWith='middle';
 args.reviews.push({id:'middle',verdict:'reuse',mergeWith:'book'});
 assert.equal(rebuildReviewedEnglishReferences(args).core.exercises.find(row=>row.id==='mapped').entryId,'book');
 args.reviews.find(row=>row.id==='middle').mergeWith='books';
 assert.ok(rebuildReviewedEnglishReferences(args).report.dropped.some(row=>row.id==='mapped'&&row.reason==='canonical-cycle'));
 const invalid=fixture();invalid.invalidConceptIds=['books'];
 assert.ok(rebuildReviewedEnglishReferences(invalid).report.dropped.some(row=>row.id==='mapped'&&row.reason==='invalid-concept'));
});

test('obsolete categories, malformed questions and mismatched answer anchors are dropped',()=>{
 const args=fixture();
 for(const [id,change] of [['inactive',{category:'confusables'}],['malformed',{route:'forms'}],
  ['wrong-anchor',{answer:'illicit'}],['substring',{answer:'bookkeeper'}]]){
  args.baselineCore.exercises.push({...exercise(id),...change});
  for(const pair of [args.baselineEnglish,args.baselineKorean])pair.exercises.push({id,instruction:'Complete it.',explanation:'Original example.'});
 }
 const result=rebuildReviewedEnglishReferences(args);
 assert.deepEqual(result.core.exercises.map(row=>row.id),['keep','mapped']);
 assert.equal(result.report.dropped.find(row=>row.id==='inactive').reason,'inactive-exercise-category');
 assert.equal(result.report.dropped.find(row=>row.id==='malformed').reason,'invalid-exercise-content');
 for(const id of ['wrong-anchor','substring'])assert.equal(result.report.dropped.find(row=>row.id===id).reason,'exercise-does-not-test-referenced-word');
});

test('existing reviewed phrase gaps remain paired but no new gap exercises are generated',()=>{
 const args=fixture();const row={id:'gap',entryId:'book',category:'collocations',route:'vocabinput',
  prompt:'Please read a ___.',answer:'book',gapFill:{parts:['Please read a ','.'],answers:['book']}};
 args.baselineCore.exercises.push(row);
 for(const pair of [args.baselineEnglish,args.baselineKorean])pair.exercises.push({id:'gap',instruction:'Complete it.',explanation:'Read a book.',context:'Please read a book.'});
 const result=rebuildReviewedEnglishReferences(args);
 assert.deepEqual(result.core.exercises.find(row=>row.id==='gap'),row);
 assert.equal(result.core.exercises.length,3);
});

test('families and historical root references retain valid links and remove inactive or duplicate members',()=>{
 const args=fixture();args.baselineCore.families.push({id:'empty-family',root:'lost',members:[{entryId:'removed',word:'removed'}]});
 for(const pair of [args.baselineEnglish,args.baselineKorean])pair.families.push({id:'empty-family',meaning:'Lost.',members:[{entryId:'removed',note:'Lost.'}]});
 const result=rebuildReviewedEnglishReferences(args);
 assert.deepEqual(result.core.families[0].members,[{entryId:'book',word:'book',parts:'book'}]);
 assert.equal(result.core.families.length,1);
 assert.deepEqual(result.core.families[0].source,credit);
 assert.equal(result.english.families[0].meaning,'written work');
 assert.equal(result.korean.families[0].meaning,'책');
 assert.deepEqual(result.core.practiceData.rootFamilies.map(row=>row.id),['historical-keep']);
 assert.deepEqual(result.core.practiceData.rootFamilies[0].members,[
  {entryId:'book',references:[credit.url]},{entryId:'reader',references:['https://en.wiktionary.org/wiki/reader']}]);
});

test('morpheme senses preserve exact paired meanings and source credit without introducing reference-only words',()=>{
 const args=fixture(),result=rebuildReviewedEnglishReferences(args);
 assert.deepEqual(result.core.morphemes[0].examples,['book','books','reader']);
 assert.deepEqual(result.core.morphemes[0].senses,[{id:'morph-book-0',tags:['root']}]);
 assert.equal(result.core.morphemes[0].source,credit.url);
 assert.deepEqual(result.english.morphemes,args.baselineEnglish.morphemes);
 assert.deepEqual(result.korean.morphemes,args.baselineKorean.morphemes);
 assert.equal(result.entries,undefined);
 assert.ok(result.report.dropped.some(row=>row.kind==='morpheme-example'&&row.id.endsWith(':reference-only')));
 assert.deepEqual(result.report.counts.exercises,{input:4,retained:2,dropped:2});
});

test('roots with no active related words disappear from both pairs along with retired countability metadata',()=>{
 const args=fixture(),unused=structuredClone(args.baselineCore.morphemes[0]);
 unused.id='unused-root';unused.examples=['reference-only'];unused.senses=[{id:'unused-root-0'}];
 args.baselineCore.morphemes.push(unused);
 for(const pair of [args.baselineEnglish,args.baselineKorean])pair.morphemes.push({id:'unused-root',senses:[{id:'unused-root-0',meaning:'Unused reference.'}]});
 delete args.baselineCore.practiceData.rootFamilies;
 const result=rebuildReviewedEnglishReferences(args);
 assert.equal(result.core.practiceData,undefined);
 assert.deepEqual(result.core.morphemes.map(row=>row.id),['morph-book']);
 for(const pair of [result.english,result.korean])assert.deepEqual(pair.morphemes.map(row=>row.id),['morph-book']);
 assert.ok(result.report.dropped.some(row=>row.id==='unused-root'&&row.reason==='no-active-related-words'));
 assert.equal(result.report.counts.countability.dropped,2);
});

test('missing current meanings and duplicate identities fail instead of producing an unpaired release',()=>{
 const args=fixture();args.koreanEntries=args.koreanEntries.filter(row=>row.id!=='book');
 assert.throws(()=>rebuildReviewedEnglishReferences(args),/Missing current paired meaning/);
 const duplicate=fixture();duplicate.reviews.push({id:'book',verdict:'pass'});
 assert.throws(()=>rebuildReviewedEnglishReferences(duplicate),/Duplicate or missing review ID/);
});
