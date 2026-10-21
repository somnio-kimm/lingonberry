import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {splitOkurigana,createJapaneseReadingExercises,japaneseReadings} from '../web/js/shared/japanese-reading.js';
import {exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
const policy={version:1,variants:[],excludedSpellings:[]};
const word=(lemma,pronunciation)=>({id:'word',lemma,pronunciation,studyMeaning:'to eat',level:'N5',aliases:[]});
for(const [lemma,reading,group,ending] of [['食べる','たべる','た','べる'],['可愛い','かわいい','かわい','い'],['大人びる','おとなびる','おとな','びる'],['行う','おこなう','おこな','う'],['書く','かく','か','く']])test(`keep the kanji group intact in ${lemma}`,()=>{const parts=splitOkurigana(word(lemma,reading));assert.equal(parts[0].reading,group);assert.equal(parts[1].text,ending);assert.equal(parts.map(part=>part.reading).join(''),reading);});
for(const [lemma,reading] of [['取り戻す','とりもどす'],['お祝い','おいわい'],['食べる','たべた'],['食べる','べる'],['行く','いく/ゆく'],['猫','ねこ'],['走る','hashiru']])test(`do not guess unsupported alignment ${lemma}/${reading}`,()=>assert.equal(splitOkurigana(word(lemma,reading)),undefined));
test('normalise kana script and combining marks without inventing alternative readings',()=>{const row={...word('食へ\u3099る','タベ ル'),aliases:['たべる']};assert.deepEqual(japaneseReadings(row),[]);row.pronunciation='たへ\u3099る';assert.equal(splitOkurigana(row)[1].text,'べる');});
test('test reading and written ending separately without leaking either answer',()=>{
 const rows=createJapaneseReadingExercises([word('食べる','たべる')],'ko',policy),read=rows.find(row=>row.boundaryKind==='reading'),ending=rows.find(row=>row.boundaryKind==='ending');
 assert.equal(read.answer,'た');assert.equal(ending.answer,'べる');assert.ok(!read.prompt.includes('たべる'));assert.ok(!ending.prompt.includes('食べる'));
 assert.ok(exerciseAnswerCorrect(read,'タ'));assert.ok(!exerciseAnswerCorrect(read,'たべ'));assert.ok(exerciseAnswerCorrect(ending,'べる'));assert.ok(!exerciseAnswerCorrect(ending,'たべる'));
 for(const row of [read,ending]){const html=renderExercisePrompt({...row,word:{},exercise:true});assert.ok(!html.includes('<rt>'));assert.match(row.instruction,/[가-힣]/);}
});
test('keep curated questions and context-specific reading ahead of generated alternatives',()=>{const words=[{...word('開く','ひらく'),studyMeaning:'to open wide',aliases:['あく']}],curated={id:'checked',entryId:'word',route:'vocabinput',category:'reading'};const rows=prepareLanguageExercises({targetLanguage:'ja',explanationLanguage:'en',exercises:[curated],readingPractice:policy},words);assert.equal(rows.filter(row=>row.category==='reading').length,1);assert.equal(rows[0].id,'checked');const generic=createJapaneseReadingExercises(words,'en',policy)[0];assert.equal(generic.answer,'ひらく');assert.deepEqual(generic.acceptedAnswers,[]);assert.equal(generic.context,'to open wide');});
test('existing dictionary readings supply practice at every Japanese level',async()=>{const core=JSON.parse(await readFile(new URL('../language-packages/ja-core-4.1.0.json',import.meta.url),'utf8'));const rows=createJapaneseReadingExercises(core.entries.map(row=>({...row,lemma:row.word})),'en',policy);for(const level of ['N5','N4','N3','N2','N1']){const ids=new Set(core.entries.filter(row=>row.level===level).map(row=>row.id));assert.ok(rows.some(row=>ids.has(row.entryId)&&row.category==='reading'));assert.ok(rows.some(row=>ids.has(row.entryId)&&row.boundaryKind==='ending'));}});

test('legacy packs do not opt into unchecked automatic readings',()=>assert.deepEqual(createJapaneseReadingExercises([word('明日','みょうにち')],'en'),[]));
test('verified same-sense variants are accepted and unresolved homographs excluded',()=>{const tomorrow={...word('明日','みょうにち'),id:'tomorrow'};const p={version:1,variants:[{entryId:'tomorrow',readings:['みょうにち','あした','あす']}],excludedSpellings:['抱く']};const rows=createJapaneseReadingExercises([tomorrow,word('抱く','だく')],'en',p);assert.equal(rows.length,1);assert.ok(exerciseAnswerCorrect(rows[0],'あした'));assert.ok(exerciseAnswerCorrect(rows[0],'アス'));});
