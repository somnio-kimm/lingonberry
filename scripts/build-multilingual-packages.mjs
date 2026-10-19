import {allowsExplanation} from '../web/js/shared/language-pairs.js';
/** Original, editable starter vocabulary. Bulk dictionary candidates are not released. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validatePackage,validateExplanation,validateDescriptor} from '../web/js/packages/schema.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const version='1.0.0';
const examFiles={ja:'jlpt',ko:'topik',en:'ielts',es:'dele',fr:'delf-dalf'};
export const packageProfiles=Object.fromEntries(await Promise.all(Object.entries(examFiles).map(async([language,file])=>[language,JSON.parse(await readFile(resolve(root,'language-packages/exam-profiles',file+'.json'),'utf8'))])));
const hash=text=>createHash('sha256').update(text).digest('hex');
const tiers={'1.0':'foundation','3.0':'everyday','5.0':'independent','6.5':'advanced','8.0':'precision'};
export function parseEditorialRows(text,language){
 const profile=packageProfiles[language],seen=new Set();
 if(!profile)throw new Error('Unsupported language');
 return text.trim().split(/\r?\n/u).map((line,index)=>{
  const fields=line.split('\t');
  if(fields.length!==9||fields.some(value=>!value.trim()))throw new Error(`Invalid TSV row ${language}:${index+1}`);
  const [level,word,reading,type,meaningEn,meaningKo,example,exampleEn,exampleKo]=fields;
  const [partOfSpeech,article]=type.split('/');
  if(!profile.levels.includes(level)||seen.has(word)||!['noun','verb','adjective','adverb','pronoun','expression','conjunction'].includes(partOfSpeech))throw new Error(`Invalid or duplicate headword: ${word}`);
  if(['es','fr'].includes(language)&&partOfSpeech==='noun'&&!article)throw new Error(`Missing article: ${word}`);
  if(language==='ja'&&reading==='-')throw new Error(`Missing Japanese reading: ${word}`);
  if((language==='en'&&meaningEn===word)||(language==='ko'&&meaningKo===word))throw new Error(`Missing monolingual definition: ${word}`);
  seen.add(word);
  const id=language+'-lex-'+hash(language+'\0'+partOfSpeech+'\0'+word).slice(0,20);
  const provenance={kind:'app-authored',creator:'Learn Language contributors',license:'CC-BY-4.0',review:'AI-assisted-editorial-draft; native-speaker-review-pending'};
  return {core:{id,word,partOfSpeech,level,...(article?{article}:{}),...(reading!=='-'?{pronunciation:reading,aliases:language==='ja'?[reading]:[]}:{}),
   grammar:{levelEvidence:{basis:'editorial-starter-selection',officialExamVocabulary:false},...(language==='en'?{studyTier:tiers[level]}:{})},
   ...(language==='en'?{tags:['academic','general-training']} : {}),provenance,
   example:{text:example,source:provenance}},en:{id,meaning:meaningEn,exampleTranslation:exampleEn},ko:{id,meaning:meaningKo,exampleTranslation:exampleKo}};
 });
}
export async function buildMultilingualPackages(){
 const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
 const catalog=(await read('language-packages/catalog.json')).filter(row=>!packageProfiles[row.targetLanguage]);
 const reports={};
 const license={identifier:'CC-BY-4.0',notice:'Original AI-assisted vocabulary definitions, examples and translations by Learn Language contributors (2026). Licensed under Creative Commons Attribution 4.0 International. Credit Learn Language contributors, link to the licence and indicate changes when reusing this content. No exam questions, commercial textbook passages, NIKL text, Wiktionary text or third-party recordings are included in this starter edition. Native-speaker review is pending. Exam names identify study targets; no endorsement is implied.',links:[{title:'Creative Commons Attribution 4.0',url:'https://creativecommons.org/licenses/by/4.0/'},{title:'Editable Vocabulary and Credits',url:'https://github.com/somnio-kimm/lingonberry/tree/main/language-packages/sources/multilingual'}]};
 for(const language of Object.keys(packageProfiles)){
  const source=await readFile(resolve(root,`language-packages/sources/multilingual/${language}-editorial.tsv`),'utf8');
  const rows=parseEditorialRows(source,language);
  const exam=await read('language-packages/exam-profiles/'+({ja:'jlpt',ko:'topik',en:'ielts',es:'dele',fr:'delf-dalf'}[language])+'.json');
  const core={schemaVersion:2,kind:'study',id:language+'-core',targetLanguage:language,version,license,exam,
   contentReview:{status:'editorial-starter',nativeSpeakerReview:'pending',scope:'Small starter selection across the exam framework; not exhaustive exam coverage.',sourceSha256:hash(source)},entries:rows.map(row=>row.core)};
  const packages=[core,...['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:language+'-'+locale,targetLanguage:language,explanationLanguage:locale,version,studyVersion:version,license,entries:rows.map(row=>row[locale])}))];
  for(const pair of packages.slice(1))validateExplanation(core,pair);
  for(const data of packages){
   validatePackage(data);
   const {entries,...header}=data;
   const raw=Buffer.from(JSON.stringify(header,null,2).slice(0,-2)+',\n  \"entries\": [\n'+entries.map(entry=>'    '+JSON.stringify(entry)).join(',\n')+'\n  ]\n}\n');const filename=data.id+'-'+version+'.json';
   const descriptor={id:data.id,kind:data.kind,targetLanguage:language,version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:version}:{}),url:'/language-packages/'+filename,bytes:raw.length,sha256:hash(raw)};
   validateDescriptor(descriptor);await writeFile(resolve(root,'language-packages',filename),raw);catalog.push(descriptor);
  }
  reports[language]={entries:rows.length,levels:Object.fromEntries([...new Set(rows.map(row=>row.core.level))].map(level=>[level,rows.filter(row=>row.core.level===level).length])),examples:rows.length,explanations:['en','ko'],review:core.contentReview};
 }
 for(let i=catalog.length-1;i>=0;i--)if(catalog[i].kind==='explanation'&&!allowsExplanation(catalog[i].targetLanguage,catalog[i].explanationLanguage))catalog.splice(i,1);
 catalog.sort((a,b)=>a.id.localeCompare(b.id));
 for(const file of ['language-packages/catalog.json','web/catalog.json'])await writeFile(resolve(root,file),JSON.stringify(catalog,null,2)+'\n');
 await writeFile(resolve(root,'docs/multilingual-vocabulary.json'),JSON.stringify(reports,null,2)+'\n');
 return reports;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildMultilingualPackages(),null,2));
