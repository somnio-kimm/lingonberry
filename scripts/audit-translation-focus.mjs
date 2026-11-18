import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assembleStudy} from '../web/js/packages/study.js';
import {germanWords,chineseWords} from '../web/js/presentation/words.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
import {clozeQuestions} from '../web/languages/de/js/core/sentence-quizzes.js';
import {practiceSentences} from '../web/languages/zh/js/services/sentence-focus.js';
import {findTranslationFocus} from '../web/js/shared/translation-focus.js';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8')),catalog=await read('language-packages/catalog.json'),report=[];let seed=17;
const drawRandom=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function recordSample(list,row,count){if(list.length<12)list.push(row);else{const at=Math.floor(drawRandom()*count);if(at<12)list[at]=row;}}
for(const language of ['de','zh','ja','en'])for(const locale of ['en','ko']){
 if(language==='en'&&locale==='en'){report.push({language,locale,excluded:'English self-study uses definition hints'});continue;}
 const descriptor=catalog.find(row=>row.id===language+'-'+locale),pair=await read(descriptor.url.slice(1)),core=await read(catalog.find(row=>row.id===language+'-core'&&row.version===pair.studyVersion).url.slice(1)),study=assembleStudy(core,pair),words=(language==='de'?germanWords:language==='zh'?chineseWords:studyWords)(study),examples=[];
 if(language==='de')for(const q of clozeQuestions(words))examples.push({word:q.word,example:q.example,text:q.example.de});
 else for(const word of words)for(const example of language==='zh'?practiceSentences(word,{cloze:true}):(word.examples||[]).filter(example=>example.practiceEligible!==false&&example.clozeEligible!==false&&findSentenceFocus(word,example,language)))examples.push({word,example,text:example.text||example.hanzi});
 let eligible=0,matched=0,unmatched=0;const matchedSamples=[],unmatchedSamples=[];
 for(const {word,example,text}of examples){
  const translation=example.studyTranslation;if(!translation?.trim())continue;eligible++;const spans=findTranslationFocus({text:translation,word,locale,studyLanguage:language,focus:example.translationFocus});
  const sample={id:word.id,word:word.lemma||word.hanzi,pos:word.pos||word.partOfSpeech,meaning:word.studyMeaning,sentence:text,translation,spans};
  if(spans.length){matched++;recordSample(matchedSamples,sample,matched);}else{unmatched++;recordSample(unmatchedSamples,sample,unmatched);}
 }
 const result={language,locale,eligible,matched,unmatched,coverage:eligible?matched/eligible:0,matchedSamples,unmatchedSamples};report.push(result);console.log(`${language}-${locale}: ${matched}/${eligible} (${(result.coverage*100).toFixed(1)}%) conservatively aligned`);
}
const directory=join(tmpdir(),'lingonberry-translation-focus');await mkdir(directory,{recursive:true});await writeFile(join(directory,'audit.json'),JSON.stringify(report,null,2));console.log('Audit:',join(directory,'audit.json'));
