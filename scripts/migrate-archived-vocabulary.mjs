import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validatePackage,validateDescriptor,validateExplanation} from '../web/js/packages/schema.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const version='2.0.0';
const sourceLink='https://github.com/somnio-kimm/lingonberry/tree/main/language-packages';
const without=(row,keys)=>Object.fromEntries(Object.entries(row).filter(([key])=>!keys.includes(key)));
export function convertEntries(rows,language){
 const core=[],translations={en:[],ko:[]};
 for(const row of rows){
  const german=language==='de',examples=german?row.examples:row.sentences;
  const translated=examples.map(example=>({en:german?example.en:example.meaningEn,ko:german?example.ko:example.meaningKo}));
  const plain=examples.map(example=>({...without(example,german?['de','en','ko']:['hanzi','pinyin','meaningEn','meaningKo']),text:german?example.de:example.hanzi,...(!german&&example.pinyin?{pronunciation:example.pinyin}:{})}));
  const entry={id:row.id,word:german?row.lemma:row.hanzi,partOfSpeech:german?row.pos:row.partOfSpeech,level:String(german?row.cefr:row.hskLevel),
   ...(german&&row.article?{article:row.article}:{}),...(!german?{pronunciation:row.officialPinyin,syllables:row.syllables}:{}),
   grammar:without(row,german?['id','lemma','pos','cefr','article','meaning_en','meaning_ko','examples','translation_review']:['id','hanzi','partOfSpeech','hskLevel','meaningEn','meaningKo','sentences','syllables']),
   ...(plain.length?{example:plain[0]}:{}),...(plain.length>1?{additionalExamples:plain.slice(1)}:{})};
  core.push(entry);
  for(const locale of ['en','ko']){
   const meanings=german?row[`meaning_${locale}`]:[row[locale==='en'?'meaningEn':'meaningKo']];
   translations[locale].push({id:row.id,meaning:meanings.join('; '),...(german?{meanings}:{}),
    ...(translated.length?{exampleTranslation:translated[0][locale]}:{}),...(translated.length>1?{additionalExampleTranslations:translated.slice(1).map(example=>example[locale])}:{}),
    provenance:german?{source:row.source,editorial:row.provenance,translationReview:row.translation_review?.[locale]}:{definitionSource:row[locale==='en'?'definitionSource':'koreanDefinitionSource']}});
  }
 }
 return {core,translations};
}
export function restoreEntries(core,english,korean,language){
 const en=new Map(english.map(row=>[row.id,row])),ko=new Map(korean.map(row=>[row.id,row]));
 return core.map(entry=>{
  const a=en.get(entry.id),b=ko.get(entry.id),row={...entry.grammar,id:entry.id};
  const examples=[entry.example,...(entry.additionalExamples||[])].map((example,i)=>({
   ...without(example,['text','pronunciation']),[language==='de'?'de':'hanzi']:example.text,
   [language==='de'?'en':'meaningEn']:i===0?a.exampleTranslation:a.additionalExampleTranslations[i-1],
   [language==='de'?'ko':'meaningKo']:i===0?b.exampleTranslation:b.additionalExampleTranslations[i-1],
   ...(language==='zh'&&example.pronunciation?{pinyin:example.pronunciation}:{}),
  }));
  if(language==='de'){
   Object.assign(row,{lemma:entry.word,pos:entry.partOfSpeech,cefr:entry.level,meaning_en:a.meanings,meaning_ko:b.meanings,examples});
   if(entry.article)row.article=entry.article;
   const review=Object.fromEntries([['en',a],['ko',b]].filter(([,data])=>data.provenance.translationReview!==undefined).map(([locale,data])=>[locale,data.provenance.translationReview]));
   if(Object.keys(review).length)row.translation_review=review;
  }else Object.assign(row,{hanzi:entry.word,partOfSpeech:entry.partOfSpeech,hskLevel:Number(entry.level),syllables:entry.syllables,meaningEn:a.meaning,meaningKo:b.meaning,sentences:examples});
  return row;
 });
}
export function contentDigest(rows){
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 return createHash('sha256').update(JSON.stringify(canonical(rows.slice().sort((a,b)=>a.id.localeCompare(b.id))))).digest('hex');
}
export async function migrate(archive){
 if(!archive)throw new Error('Pass an explicit extracted archive directory. The retired sibling folders are no longer used.');
 const destination=join(root,'language-packages'),credits=join(destination,'credits');await mkdir(credits,{recursive:true});
 const sourceFiles=[],catalog=[],counts={};
 async function readSource(relative){const raw=await readFile(join(archive,relative));sourceFiles.push({path:relative,sha256:createHash('sha256').update(raw).digest('hex')});return JSON.parse(raw);}
 const attribution=await readSource('apps/chinese/web/data/content-attribution.json');
 const germanLicences=await readSource('apps/german/web/data/content-licenses.json');
 await writeFile(join(credits,'chinese-attribution.json'),JSON.stringify(attribution,null,2)+'\n');await writeFile(join(credits,'german-content-licenses.json'),JSON.stringify(germanLicences,null,2)+'\n');
 for(const [from,to] of [['apps/chinese/web/data/licenses/CC-BY-SA-4.0.txt','CC-BY-SA-4.0.txt'],['apps/chinese/web/data/licenses/CC-BY-2.0-FR.txt','CC-BY-2.0-FR.txt'],['apps/german/web/data/LICENSE.txt','GERMAN-MIT.txt']])await copyFile(join(archive,from),join(credits,to));
 const mit=await readFile(join(credits,'GERMAN-MIT.txt'),'utf8');
 const chineseNotice='Chinese study entries, definitions, original examples and translations: learn_chinese contributors, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Credited Tatoeba sentences retain CC BY 2.0 France (https://creativecommons.org/licenses/by/2.0/fr/). Official HSK syllabus factual fields retain their source attribution; the official publication is not relicensed. See the original source notices and editorial-review status in the package attribution metadata. Migration changes only the package structure; prior modification notices are retained.\n\nUnrestricted content downloads and complete licence texts: '+sourceLink+'\n\nSentence credits:\n'+attribution.sentences.map(item=>`${item.language}: ${item.author} · ${item.id} · ${item.license} · ${item.url}`).join('\n');
 for(const language of ['de','zh']){
  let rows=[];
  if(language==='de')for(const level of ['a1','a2','b1','b2','c1','c2'])for(const category of ['nouns','verbs','adjectives','functional'])rows.push(...await readSource(`apps/german/web/data/cefr-${level}/${category}.json`));
  else for(let level=1;level<=7;level++)rows.push(...await readSource(`apps/chinese/web/data/hsk-${level}.json`));
  const converted=convertEntries(rows,language);const originalDigest=contentDigest(rows);if(contentDigest(restoreEntries(converted.core,converted.translations.en,converted.translations.ko,language))!==originalDigest)throw new Error('Lossy vocabulary conversion: '+language);counts[language]={contentSha256:originalDigest,entries:rows.length,examples:rows.reduce((n,row)=>n+(row.examples||row.sentences).length,0),levels:Object.fromEntries([...new Set(rows.map(row=>String(row.cefr||row.hskLevel)))].map(level=>[level,rows.filter(row=>String(row.cefr||row.hskLevel)===level).length]))};
  const license=language==='de'?{identifier:'MIT',notice:'German study content: learn_german contributors. Archived editorial A1-C2 assignments and AI-assisted translations are preserved; fluent-speaker review remains pending. Migration changes only packaging.\n\n'+mit,links:[{title:'Content Downloads and Credits',url:sourceLink}]}:{identifier:'CC-BY-SA-4.0 AND CC-BY-2.0-FR',notice:chineseNotice,links:[{title:'Content Downloads and Credits',url:sourceLink},{title:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/'},{title:'CC BY 2.0 France',url:'https://creativecommons.org/licenses/by/2.0/fr/'}]};
  const core={schemaVersion:2,kind:'study',id:`${language}-core`,targetLanguage:language,version,license,attribution:language==='zh'?attribution:germanLicences,entries:converted.core};
  const packages=[core,...['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:`${language}-${locale}`,targetLanguage:language,explanationLanguage:locale,studyVersion:version,version,license,entries:converted.translations[locale]}))];
  for(const pair of packages.slice(1))validateExplanation(core,pair);
  for(const data of packages){validatePackage(data);const raw=JSON.stringify(data,null,2)+'\n',file=`${data.id}-${version}.json`;await writeFile(join(destination,file),raw);const descriptor={id:data.id,kind:data.kind,targetLanguage:language,version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:version}:{}),url:'/language-packages/'+file,bytes:Buffer.byteLength(raw),sha256:createHash('sha256').update(raw).digest('hex')};validateDescriptor(descriptor);catalog.push(descriptor);}
 }
 const manifest={version,source:'learn_language_legacy_20261014',counts,sourceFiles,scope:'Full archived study entries only. The unready German reference corpus is excluded. No language-quality rewrite or new syllabus audit is claimed.'};
 await writeFile(join(root,'docs/vocabulary-migration.json'),JSON.stringify(manifest,null,2)+'\n');
 for(const path of [join(destination,'catalog.json'),join(root,'web/catalog.json')])await writeFile(path,JSON.stringify(catalog,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify((await migrate(process.argv[2])).counts,null,2));
