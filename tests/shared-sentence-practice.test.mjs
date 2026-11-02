import {snapshotQuestion as chineseSnapshot,resolveWrongQuestion} from '../web/languages/zh/js/services/wrong-review.js';
import {DEFAULT_STUDY_MODES,orderStudyModes} from '../web/js/shared/study-modes.js';
import {HOME_MODES as germanModes} from '../web/languages/de/js/app-definition.js';
import {HOME_MODES as chineseModes} from '../web/languages/zh/js/app-definition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sentenceTiles,findSentenceFocus,createSentenceEngine,joinSentenceTiles} from '../web/js/shared/lexicon-sentences.js';
import {studyProfiles,studyWords} from '../web/js/presentation/study-profiles.js';
import {readFile} from 'node:fs/promises';
const words=(a,b,sentence,translation='Translation')=>[{id:'a',lemma:a,pos:'noun',studyMeaning:'first',examples:[{text:sentence,studyTranslation:translation}]},{id:'b',lemma:b,pos:'noun',studyMeaning:'second',examples:[]}];
test('every new language has real Cloze and Scramble questions in its first study level',async()=>{
 for(const language of Object.keys(studyProfiles)){
  const core=JSON.parse(await readFile(new URL(`../language-packages/${language}-core-2.0.0.json`,import.meta.url))),pair=JSON.parse(await readFile(new URL(`../language-packages/${language}-en-2.0.0.json`,import.meta.url))),meanings=new Map(pair.entries.map(row=>[row.id,row]));
  const study={...core,explanationLanguage:'en',entries:core.entries.map(row=>({...row,meaning:meanings.get(row.id).meaning,...(row.example?{example:{...row.example,translation:meanings.get(row.id).exampleTranslation}}:{})}))};
  const pool=studyWords(study).filter(word=>word.level===studyProfiles[language].levels[0]),engine=createSentenceEngine(studyProfiles[language]);
  assert.ok(engine.createSentencePool('cloze',pool).choose(),language+' cloze');assert.ok(engine.createSentencePool('scramble',pool).choose(),language+' scramble');
 }
});
test('Korean particles can follow a noun blank without matching an unrelated compound',()=>{
 assert.deepEqual(findSentenceFocus({lemma:'한국'},{text:'한국에서 살아요.'},'ko'),{start:0,text:'한국'});
 assert.equal(findSentenceFocus({lemma:'입'},{text:'입장이 달라요.'},'ko'),null);
});
test('explicit inflected forms must actually occur in the sentence',()=>{
 assert.deepEqual(findSentenceFocus({lemma:'食べる'},{text:'パンを食べました。',focus:{text:'食べました'}},'ja'),{start:3,text:'食べました'});
 assert.equal(findSentenceFocus({lemma:'食べる'},{text:'水を飲みます。',focus:{text:'食べました'}},'ja'),null);
});
test('commas/full stops are separate tiles and CJK does not become one giant tile',()=>{
 assert.deepEqual(sentenceTiles('Yes, I can.','en'),['Yes',',','I','can','.']);
 assert.ok(sentenceTiles('今日は雨です。','ja').length>2);assert.ok(sentenceTiles('저는 학교에 가요.','ko').length>2);
 assert.equal(joinSentenceTiles(['Yes',',','I','can','.'],'en'),'Yes, I can.');
});
test('Cloze distractors match the part of speech and incomplete examples are not questions',()=>{
 const pool=words('book','table','The book is here.');pool.push({id:'c',lemma:'run',pos:'verb',studyMeaning:'move',examples:[]});
 const engine=createSentenceEngine(studyProfiles.en),questions=engine.sentenceQuestions('cloze',pool,'fr');assert.equal(questions.length,1);assert.equal(questions[0].locale,'fr');assert.ok(questions[0].options.every(option=>option.type==='noun'));assert.equal(engine.sentenceAnswerCorrect(questions[0],'a'),true);assert.equal(engine.sentenceAnswerCorrect(questions[0],'b'),false);
 pool[0].examples[0].studyTranslation='';assert.equal(engine.sentenceQuestions('cloze',pool).length,0);
});
test('Scramble accepts swapped identical tiles but rejects reusing one tile twice',()=>{
 const engine=createSentenceEngine(studyProfiles.en),[q]=engine.sentenceQuestions('scramble',[{id:'a',lemma:'go',examples:[{text:'Go go.',studyTranslation:'Go.'}]}]);
 assert.equal(engine.sentenceAnswerCorrect(q,[0,1,2]),true);assert.equal(engine.sentenceAnswerCorrect(q,[1,0,2]),false);
 const repeated={...q,tokens:['go','go','.']};assert.equal(engine.sentenceAnswerCorrect(repeated,[1,0,2]),true);assert.equal(engine.sentenceAnswerCorrect(repeated,[0,0,2]),false);
});

test('the seven shared defaults lead menus before language-specific quizzes',()=>{
 assert.deepEqual(DEFAULT_STUDY_MODES,['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble','listening']);
 assert.deepEqual(germanModes,[...DEFAULT_STUDY_MODES,'articles','verbforms']);
 assert.deepEqual(chineseModes,[...DEFAULT_STUDY_MODES.map(id=>id==='flashcards'?'flashcard':id),'pinyin','tone']);
 for(const ids of [germanModes,chineseModes])assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(orderStudyModes(['vocabinput','scramble','vocabmeaning','wordlist','flashcards','cloze']),['wordlist','flashcards','vocabmeaning','vocabinput','cloze','scramble']);
});

test('all five multilingual presentations render the seven defaults in English and Korean',async()=>{
 const {createPresentation}=await import('../web/js/presentation/multilingual.js');
 const previous=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 try{
  for(const language of ['ja','ko','en','es','fr']){
   const presentation=createPresentation({language,navigate:()=>{},refresh:()=>{},onPreferences:()=>{}});
   for(const uiLanguage of ['en','ko']){
    presentation.setPreferences({theme:'system',uiLanguage});
    const host={dataset:{},innerHTML:'',querySelectorAll:()=>[]};presentation.render('home',host);
    const routes=[...host.innerHTML.matchAll(/data-route="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual(routes,DEFAULT_STUDY_MODES,`${language}/${uiLanguage}`);
    assert.match(host.innerHTML,uiLanguage==='en'?/Meaning Quiz/:/뜻 선택/);
    assert.match(host.innerHTML,uiLanguage==='en'?/Word Input/:/단어 입력/);
    assert.ok(presentation.screens.vocabmeaning&&presentation.screens.vocabinput);
   }
  }
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('Chinese sentence review retains a non-English/Korean explanation snapshot',()=>{
 const word={id:'book',hanzi:'书',hskLevel:1,syllables:[{hanzi:'书',base:'shu',tone:1}],studyMeaning:'本',studyExplanationLanguage:'ja'};
 const question=chineseSnapshot('cloze',word,{hanzi:'这是我的书。',studyTranslation:'これは私の本です。'});
 const resolved=resolveWrongQuestion({mode:'cloze',wordId:'book',question},[]);
 assert.equal(resolved.word.studyMeaning,'本');assert.equal(resolved.word.studyExplanationLanguage,'ja');assert.equal(resolved.sentence.studyTranslation,'これは私の本です。');
});

test('ambiguous repeated forms require an explicit location rather than blanking the wrong part of speech',()=>{
 assert.equal(findSentenceFocus({lemma:'will'},{text:'She will show her will.'},'en'),null);
 assert.equal(findSentenceFocus({lemma:'will'},{text:'She will show her will.',focus:{text:'will'}},'en'),null);
 assert.deepEqual(findSentenceFocus({lemma:'will'},{text:'She will show her will.',focus:{text:'will',start:18}},'en'),{start:18,text:'will'});
 assert.deepEqual(findSentenceFocus({lemma:'la'},{text:'La cantante canta un la.'},'es'),{start:21,text:'la'});
});
