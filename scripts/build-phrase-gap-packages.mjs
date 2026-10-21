import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {writePackageRelease} from './content/package-writer.mjs';
import {validateExplanation} from '../web/js/packages/schema.js';
import {joinGapAnswers,gradePhraseGaps} from '../web/js/shared/phrase-gaps.js';
/** Authoring records become validated data, never downloaded UI or executable code. */
export function buildPhraseGapRelease(core,pairs,source,version){
 core=structuredClone(core);pairs=structuredClone(pairs);core.version=version;
 const entries=new Set(core.entries.map(row=>row.id)),ids=new Set((core.exercises||[]).map(row=>row.id));
 core.exercises||=[];
 for(const pair of pairs){pair.version=version;pair.studyVersion=version;pair.exercises||=[];}
 for(const row of source.questions){
  if(!entries.has(row.entryId))throw new Error('Unknown gap anchor '+row.id);
  const gapFill={parts:row.parts,answers:row.answers,alternatives:row.alternatives||[]};
  if(!Array.isArray(row.distractors)||row.distractors.length!==3||row.distractors.some(values=>values.length!==row.answers.length||gradePhraseGaps(gapFill,values).correct))throw new Error('Invalid gap distractors '+row.id);
  for(const route of ['vocabinput','vocabmeaning']){
   const id=row.id+(route==='vocabinput'?'-input':'-choice');if(ids.has(id))throw new Error('Duplicate gap '+id);ids.add(id);
   const answer=joinGapAnswers(row.answers);
   core.exercises.push({id,entryId:row.entryId,category:row.category,route,prompt:row.parts.join('___'),answer,gapFill,...(route==='vocabmeaning'?{options:[answer,...row.distractors.map(joinGapAnswers)]}:{})});
   for(const pair of pairs){const ko=pair.explanationLanguage==='ko',locale=pair.explanationLanguage;
    const instruction=route==='vocabinput'?(ko?'각 빈칸에 표현의 빠진 부분을 입력하세요.':'Fill each blank with the missing part of the expression.'):(ko?'빈칸에 들어갈 표현을 순서대로 선택하세요.':'Choose the missing parts in order.');
    pair.exercises.push({id,instruction,context:row.context[locale],explanation:row.explanation[locale]});
   }
  }
 }
 for(const pack of [core,...pairs])pack.license.notice+='\n\n'+source.notice+' Grammar references: '+source.grammarReferences.join('; ')+'.\n';
 for(const pair of pairs)validateExplanation(core,pair);
 return {core,pairs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
 const release=await read('language-packages/sources/exercises/phrase-gaps-release.json');
 for(const row of release.sourcePackages)if(createHash('sha256').update(await readFile(new URL(row.path,root))).digest('hex')!==row.sha256)throw new Error('Changed phrase gap source '+row.path);
 const source=await read('language-packages/sources/exercises/phrase-gaps.json'),previous=await read(`language-packages/en-core-${release.from}.json`),pairs=await Promise.all(['en','ko'].map(locale=>read(`language-packages/en-${locale}-${release.from}.json`)));
 const built=buildPhraseGapRelease(previous,pairs,source,release.to);
 if(!process.argv.includes('--dry-run'))await writePackageRelease(root,built.core,built.pairs);
 console.log(`English ${release.to}: ${source.questions.length} separated-gap scenarios, ${source.questions.length*2} exercises; ${previous.entries.length} vocabulary IDs preserved; EN/KO contexts and explanations.`);
}
