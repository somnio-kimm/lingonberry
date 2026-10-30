import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {splitOkurigana,createJapaneseReadingExercises,japaneseReadings,createOkuriganaSpellingQuestion,indexJapaneseSpellings} from '../web/js/shared/japanese-reading.js';
import {exerciseAnswerCorrect} from '../web/js/shared/language-exercises.js';
import {prepareLanguageExercises} from '../web/js/shared/exercise-pools.js';
import {renderExercisePrompt} from '../web/js/shared/exercise-view.js';
const policy={version:1,variants:[],excludedSpellings:[]};
const word=(lemma,pronunciation)=>({id:'word',lemma,pronunciation,studyMeaning:'to eat',level:'N5',aliases:[]});
for(const [lemma,reading,group,ending] of [['食べる','たべる','た','べる'],['可愛い','かわいい','かわい','い'],['大人びる','おとなびる','おとな','びる'],['行う','おこなう','おこな','う'],['書く','かく','か','く']])test(`keep the kanji group intact in ${lemma}`,()=>{const parts=splitOkurigana(word(lemma,reading));assert.equal(parts[0].reading,group);assert.equal(parts[1].text,ending);assert.equal(parts.map(part=>part.reading).join(''),reading);});
for(const [lemma,reading] of [['取り戻す','とりもどす'],['お祝い','おいわい'],['食べる','たべた'],['食べる','べる'],['行く','いく/ゆく'],['猫','ねこ'],['走る','hashiru']])test(`do not guess unsupported alignment ${lemma}/${reading}`,()=>assert.equal(splitOkurigana(word(lemma,reading)),undefined));
test('normalise kana script and combining marks without inventing alternative readings',()=>{const row={...word('食へ\u3099る','タベ ル'),aliases:['たべる']};assert.deepEqual(japaneseReadings(row),[]);row.pronunciation='たへ\u3099る';assert.equal(splitOkurigana(row)[1].text,'べる');});
test('Okurigana shows a whole kana reading and requires the complete written word',()=>{
 const rows=createJapaneseReadingExercises([word('久しい','ひさしい')],'ko',policy),question=rows.find(row=>row.category==='okurigana');
 assert.equal(rows.filter(row=>row.category==='okurigana').length,1);assert.equal(question.prompt,'ひさしい');assert.equal(question.answer,'久しい');assert.equal(question.boundaryKind,'spelling');
 assert.ok(exerciseAnswerCorrect(question,'久しい'));for(const wrong of ['ひさしい','久い','しい','久'])assert.equal(exerciseAnswerCorrect(question,wrong),false,wrong);
 const html=renderExercisePrompt({...question,word:{},exercise:true});assert.ok(!html.includes('久'));assert.ok(!html.includes('<rt>'));assert.match(question.instruction,/단어 전체/);
 const reading=rows.find(row=>row.category==='reading');assert.equal(reading.prompt,'久しい');assert.equal(reading.answer,'ひさしい');
});
test('attested KANJIDIC and dictionary spellings remain accepted without inventing readings',()=>{
 const entry={...word('行う','おこなう'),aliases:['おこなう','行なう']},kanji=new Map([['行',{kun:['い.く','おこな.う','おこ.なう']}]]);
 const question=createOkuriganaSpellingQuestion(entry,'en',{kanji,spellings:indexJapaneseSpellings([entry])});assert.ok(exerciseAnswerCorrect(question,'行なう'));assert.ok(!question.acceptedAnswers.includes('行く'));assert.ok(!question.acceptedAnswers.includes('おこなう'));
 const sameReading=[word('表す','あらわす'),{...word('表わす','あらわす'),id:'alternate'}];
 const alternate=createOkuriganaSpellingQuestion(sameReading[0],'en',{spellings:indexJapaneseSpellings(sameReading)});assert.ok(exerciseAnswerCorrect(alternate,'表わす'));
});
test('legacy partial Okurigana rows become one new spelling question without changing their saved answers',()=>{
 const entry=word('食べる','たべる'),old=[{id:'old-reading',entryId:entry.id,route:'vocabinput',category:'okurigana',answer:'た'},{id:'old-ending',entryId:entry.id,route:'vocabinput',category:'okurigana',answer:'べる'}];
 const study={targetLanguage:'ja',explanationLanguage:'en',exercises:old,readingPractice:policy};const rows=prepareLanguageExercises(study,[entry]);
 const typing=rows.filter(row=>row.category==='okurigana'&&row.route==='vocabinput');assert.equal(typing.length,1);assert.equal(typing[0].id,'okurigana-spelling-word');assert.equal(typing[0].prompt,'たべる');assert.equal(typing[0].answer,'食べる');assert.deepEqual(old.map(row=>row.answer),['た','べる']);assert.ok(exerciseAnswerCorrect(old[0],'た'));
});
test('keep curated questions and context-specific reading ahead of generated alternatives',()=>{const words=[{...word('開く','ひらく'),studyMeaning:'to open wide',aliases:['あく']}],curated={id:'checked',entryId:'word',route:'vocabinput',category:'reading'};const rows=prepareLanguageExercises({targetLanguage:'ja',explanationLanguage:'en',exercises:[curated],readingPractice:policy},words);assert.equal(rows.filter(row=>row.category==='reading').length,1);assert.equal(rows[0].id,'checked');const generic=createJapaneseReadingExercises(words,'en',policy)[0];assert.equal(generic.answer,'ひらく');assert.deepEqual(generic.acceptedAnswers,[]);assert.equal(generic.context,'to open wide');});
test('existing dictionary readings supply practice at every Japanese level',async()=>{const core=JSON.parse(await readFile(new URL('../language-packages/ja-core-4.1.0.json',import.meta.url),'utf8'));const rows=createJapaneseReadingExercises(core.entries.map(row=>({...row,lemma:row.word})),'en',policy);for(const level of ['N5','N4','N3','N2','N1']){const ids=new Set(core.entries.filter(row=>row.level===level).map(row=>row.id));assert.ok(rows.some(row=>ids.has(row.entryId)&&row.category==='reading'));assert.ok(rows.some(row=>ids.has(row.entryId)&&row.boundaryKind==='spelling'));}});

test('legacy packs do not opt into unchecked automatic readings',()=>assert.deepEqual(createJapaneseReadingExercises([word('明日','みょうにち')],'en'),[]));
test('verified same-sense variants are accepted and unresolved homographs excluded',()=>{const tomorrow={...word('明日','みょうにち'),id:'tomorrow'};const p={version:1,variants:[{entryId:'tomorrow',readings:['みょうにち','あした','あす']}],excludedSpellings:['抱く']};const rows=createJapaneseReadingExercises([tomorrow,word('抱く','だく')],'en',p);assert.equal(rows.length,1);assert.ok(exerciseAnswerCorrect(rows[0],'あした'));assert.ok(exerciseAnswerCorrect(rows[0],'アス'));});
