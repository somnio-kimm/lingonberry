import {allowsExplanation} from '../web/js/shared/language-pairs.js';
/** Version 2 keeps broad dictionary senses separate from unfinished example translations. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePackage,validateDescriptor,validateExplanation} from '../web/js/packages/schema.js';
import {britishEnglish} from './content/british-english.mjs';
import {assignIeltsTopics} from './content/ielts-topics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),version='2.0.0',languages=['ja','ko','en','es','fr'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const countBy=items=>items.reduce((counts,key)=>(counts[key]=(counts[key]||0)+1,counts),{});
export function isCircularDefinition(word,definition){const clean=value=>String(value).toLowerCase().replace(/^(?:a|an|the|to)\s+/u,'').replace(/[.!?]+$/u,'').trim();return clean(word)===clean(definition);}
export async function buildBroadPackages(cache){
 const manifest=await read('language-packages/sources/multilingual/broad-source-manifest.json');
 const catalog=(await read('language-packages/catalog.json')).filter(row=>!languages.includes(row.targetLanguage)),report={};
 const notice=await readFile(resolve(root,'language-packages/credits/MULTILINGUAL-2.0.0.txt'),'utf8');
 const license={identifier:'CC-BY-SA-4.0 AND CC-BY-SA-2.0-KR AND CC-BY-4.0 AND KOGL-1',notice,links:[
  {title:'NIKL Dictionary Copyright Policy',url:'https://krdict.korean.go.kr/kor/kboardPolicy/copyRightTermsInfo'},
  {title:'CC BY-SA 2.0 KR',url:'https://creativecommons.org/licenses/by-sa/2.0/kr/'},
  {title:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/'},
  {title:'CC BY 4.0 — Original Starter Content',url:'https://creativecommons.org/licenses/by/4.0/'},
  {title:'English Wiktionary Contributors',url:'https://en.wiktionary.org/'},
  {title:'NIKL Curriculum — KOGL Type 1',url:'https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=932'},
  {title:'Unrestricted Content Downloads and Source Information',url:'https://github.com/somnio-kimm/lingonberry/tree/main/language-packages'},
 ]};
 for(const language of languages){
  const text=await readFile(resolve(cache,language+'-broad-prepared.jsonl'),'utf8'),imported=text.trim().split('\n').map(line=>JSON.parse(line));
  if(hash(text)!==manifest.prepared[language])throw new Error('Prepared source differs from the reviewed manifest: '+language);
  for(const row of imported)if(row.core.grammar?.senseAlignment?.score<2)delete row.core.referenceExamples;
  const oldCore=await read(`language-packages/${language}-core-1.0.0.json`),oldEn=await read(`language-packages/${language}-en-1.0.0.json`),oldKo=await read(`language-packages/${language}-ko-1.0.0.json`);
  const originals=new Map(oldCore.entries.map((core,i)=>[core.id,{core,en:oldEn.entries[i],ko:oldKo.entries[i]}]));
  const rows=[...originals.values(),...imported.filter(row=>!originals.has(row.core.id)&&!(language==='en'&&isCircularDefinition(row.core.word,row.en.meaning)))];
  for(const row of rows)if(!originals.has(row.core.id))row.en.meaning=britishEnglish(row.en.meaning);
  for(const row of rows)if(language==='en')row.core.tags=assignIeltsTopics({word:row.core.word,meaning:row.en.meaning,example:row.core.example?.text,category:row.classification?.category});
  const completeExamples=rows.filter(row=>row.core.example).length;
  const exam={...oldCore.exam,vocabularyMembership:language==='ko'?'curriculum-informed-editorial':'editorial'};
  const core={...oldCore,version,license,exam,contentReview:{status:'broad-dictionary-preview',nativeSpeakerReview:'pending',entries:rows.length,bilingualExamples:completeExamples,examplesPending:rows.length-completeExamples,preparedSourceSha256:hash(text),levelBasis:language==='ko'?'NIKL headword curriculum matches plus editorial extension; not certified TOPIK membership.':'Editorial frequency tiers; not official exam word membership or a score predictor.',examplePolicy:'Preserve starter examples. Display licensed native source examples separately with missing translations labelled; sentence exercises use only complete bilingual examples.'},entries:rows.map(row=>row.core)};
  const packages=[core,...['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:language+'-'+locale,targetLanguage:language,explanationLanguage:locale,version,studyVersion:version,license,entries:rows.map(row=>row[locale])}))];
  for(const pair of packages.slice(1))validateExplanation(core,pair);
  for(const data of packages){
   validatePackage(data);const {entries,...header}=data;
   const bytes=Buffer.from(JSON.stringify(header,null,2).slice(0,-2)+',\n  "entries": [\n'+entries.map(entry=>'    '+JSON.stringify(entry)).join(',\n')+'\n  ]\n}\n');
   const descriptor={id:data.id,kind:data.kind,targetLanguage:language,version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:version}:{}),url:`/language-packages/${data.id}-${version}.json`,bytes:bytes.length,sha256:hash(bytes)};
   validateDescriptor(descriptor);await writeFile(resolve(root,'.'+descriptor.url),bytes);catalog.push(descriptor);
  }
  report[language]={entries:rows.length,distinctHeadwords:new Set(rows.map(row=>row.core.word)).size,levels:countBy(rows.map(row=>row.core.level)),partsOfSpeech:countBy(rows.map(row=>row.core.partOfSpeech)),bilingualExamples:completeExamples,sourceExamples:rows.reduce((sum,row)=>sum+(row.core.referenceExamples?.length||0),0),examplesPending:rows.length-completeExamples,preservedStarterEntries:oldCore.entries.length,review:core.contentReview,...(language==='en'?{tags:countBy(rows.flatMap(row=>row.core.tags))}:{})};
 }
 for(let i=catalog.length-1;i>=0;i--)if(catalog[i].kind==='explanation'&&!allowsExplanation(catalog[i].targetLanguage,catalog[i].explanationLanguage))catalog.splice(i,1);
 catalog.sort((a,b)=>a.id.localeCompare(b.id));for(const file of ['language-packages/catalog.json','web/catalog.json'])await writeFile(resolve(root,file),JSON.stringify(catalog,null,2)+'\n');
 await writeFile(resolve(root,'docs/multilingual-broad-dictionaries.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildBroadPackages(process.argv[2]),null,2));
