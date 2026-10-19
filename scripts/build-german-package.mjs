import {britishEnglish} from './content/british-english.mjs';
export {britishEnglish} from './content/british-english.mjs';
/** Build a versioned German study core and independent explanation packages. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePackage,validateDescriptor,validateExplanation} from '../web/js/packages/schema.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const version='3.0.0';
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const grammarKeys=['accepted_articles','sense_id','subtype','article_forms','attested_forms','auxiliary','case','class','comparative','constructions','declension','declension_notes','forms','gender','genders','governs','infinitive','inflection_class','ipa','number_restriction','plural','predicative_only','prefix_type','pronoun_forms','proper_noun','register_tags','related_forms','separable_prefix','source_pos','stems','superlative'];
const select=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
function entryProvenance(row){
 const source=row.provenance||{};
 if(!row.id.startsWith('de-ref-'))return source;
 return {...select(source,['kind','license','url','history_url']),additionalSources:(source.source_entries||[]).filter(item=>item.url!==source.url)};
}
export function displayHeadword(row){
 if(row.display_lemma)return row.display_lemma;
 if(row.pos!=='noun'||!row.article||!row.id.startsWith('de-ref-'))return row.lemma;
 const nominative=row.declension?.nom?.[row.number_restriction==='plural'?1:0]?.split(' / ')[0];
 if(nominative?.startsWith(row.article+' '))return nominative.slice(row.article.length+1);
 // A strong adjective in a dictionary phrase becomes weak after der/die/das.
 return row.lemma.replace(/^([a-zäöüß][^ ]*)(?:) (?=[A-ZÄÖÜ])/u,(_,adjective)=>adjective.replace(/(?:es|er|en|em|e)$/u,'')+'e ');
}
export function convertGermanRows(rows,translations){
 const core=[],pairs={en:[],ko:[]};
 for(const row of rows){
  const examples=row.examples.map((example,index)=>{
   if(example.en&&example.ko)return row.id.startsWith('de-ref-')?{...example,en:britishEnglish(example.en)}:example;
   const translated=translations[row.id+':'+index];
   if(!translated||translated.text!==example.de||!translated.en||!translated.ko)throw new Error(`Missing reviewed translation draft: ${row.id}:${index}`);
   return {...example,en:britishEnglish(example.en||translated.en),ko:example.ko||translated.ko,translationProvenance:translated.provenance};
  });
  const plain=examples.map(example=>({text:example.de,...(example.source?{source:example.source}:{})}));
  const entry={id:row.id,word:displayHeadword(row),partOfSpeech:row.pos,level:row.cefr,...(row.article?{article:row.article}:{}),
   grammar:{...select(row,grammarKeys),dictionaryLemma:row.lemma,previous_cefr:row.previous_cefr,cefr_basis:row.cefr_basis,level_evidence:{matchedLists:row.level_evidence.matchedLists,frequency:row.level_evidence.frequency,sourcePages:Object.fromEntries(Object.entries(row.level_evidence.sourcePages||{}).map(([level,items])=>[level,[...new Set(items.map(item=>item.page))]]))}},
   provenance:entryProvenance(row),example:plain[0],...(plain.length>1?{additionalExamples:plain.slice(1)}:{})};
  core.push(entry);
  for(const locale of ['en','ko']){
   const meanings=locale==='en'&&row.id.startsWith('de-ref-')?row.meaning_en.map(britishEnglish):row['meaning_'+locale];
   if(!meanings?.length||meanings.some(text=>!text.trim()))throw new Error('Missing meaning: '+row.id);
   pairs[locale].push({id:row.id,meaning:meanings.join('; '),meanings,...(locale==='en'&&row.notes?{usageNote:row.notes}:{}),exampleTranslation:examples[0][locale],
    ...(examples.length>1?{additionalExampleTranslations:examples.slice(1).map(e=>e[locale])}:{}),
    provenance:{source:row.source,attribution:entryProvenance(row),meaningReview:locale==='ko'?(row._ko_status||row.translation_review?.ko):row.translation_review?.en||'licensed source or AI-edited learner sense; native review pending',
     examples:examples.map(example=>example.translationProvenance||{kind:example.source?.kind==='app-generated'?'app-authored':'source-or-legacy',review:'native-review-pending'})}});
  }
 }
 return {core,pairs};
}
export async function buildGermanPackage(cache){
 const rows=JSON.parse(await readFile(resolve(cache,'prepared-rows.json'),'utf8')).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const translations=await read('language-packages/sources/german-example-translations.json');
 const converted=convertGermanRows(rows,translations);
 const notice=await readFile(resolve(root,'language-packages/credits/GERMAN-3.0.0.txt'),'utf8');
 const license={identifier:'CC-BY-SA-4.0 AND MIT',notice,links:[{title:'Content Downloads and Credits',url:'https://github.com/somnio-kimm/lingonberry/tree/main/language-packages'},{title:'CC BY-SA 4.0',url:'https://creativecommons.org/licenses/by-sa/4.0/'},{title:'Goethe A1 Word List',url:'https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf'},{title:'Goethe A2 Word List',url:'https://www.goethe.de/pro/relaunch/prf/en/Goethe-Zertifikat_A2_Wortliste.pdf'},{title:'Goethe B1 Word List',url:'https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf'}]};
 const study={schemaVersion:2,kind:'study',id:'de-core',targetLanguage:'de',version,license,
  contentReview:{status:'editorial-preview',nativeSpeakerReview:'pending',levelBasis:'A1–B1: earliest matched official Goethe adult headword list; B2–C2: editorial frequency tiers, not official CEFR assessments.',examplePolicy:'Retain archived examples; use suitable licensed examples; author original examples where no reliably translated example is available.'},entries:converted.core};
 const packages=[study,...['en','ko'].map(locale=>({schemaVersion:2,kind:'explanation',id:'de-'+locale,targetLanguage:'de',explanationLanguage:locale,version,studyVersion:version,license,entries:converted.pairs[locale]}))];
 for(const pair of packages.slice(1))validateExplanation(study,pair);
 const catalog=(await read('language-packages/catalog.json')).filter(item=>item.targetLanguage!=='de');
 for(const data of packages){
  validatePackage(data);const {entries,...header}=data;
  const bytes=Buffer.from(JSON.stringify(header,null,2).slice(0,-2)+',\n  "entries": [\n'+entries.map(entry=>'    '+JSON.stringify(entry)).join(',\n')+'\n  ]\n}\n');
  const file=`${data.id}-${version}.json`,descriptor={id:data.id,kind:data.kind,targetLanguage:'de',version,...(data.kind==='explanation'?{explanationLanguage:data.explanationLanguage,studyVersion:version}:{}),url:'/language-packages/'+file,bytes:bytes.length,sha256:hash(bytes)};
  validateDescriptor(descriptor);await writeFile(resolve(root,'language-packages',file),bytes);catalog.push(descriptor);
 }
 catalog.sort((a,b)=>a.id.localeCompare(b.id));
 for(const file of ['language-packages/catalog.json','web/catalog.json'])await writeFile(resolve(root,file),JSON.stringify(catalog,null,2)+'\n');
 const countBy=values=>Object.fromEntries([...new Set(values)].sort().map(key=>[key,values.filter(v=>v===key).length]));
 const official=await read('language-packages/sources/goethe-headword-evidence.json');
 const lemmas=new Set(rows.map(row=>row.lemma));
 const report={version,entries:rows.length,distinctSourceHeadwords:lemmas.size,distinctDisplayHeadwords:new Set(converted.core.map(row=>row.word)).size,levels:countBy(rows.map(row=>row.cefr)),examples:rows.reduce((n,row)=>n+row.examples.length,0),exampleSources:countBy(rows.flatMap(row=>row.examples.map(example=>example.source?.generation||example.source?.kind||'archived-editorial'))),officialCoverage:Object.fromEntries(Object.entries(official.headwords).map(([level,words])=>[level,{matchedHeadwords:Object.keys(words).length,missing:Object.keys(words).filter(word=>!lemmas.has(word))}])),review:study.contentReview,packages:catalog.filter(item=>item.targetLanguage==='de'),preservedLegacyIds:rows.filter(row=>!row.id.startsWith('de-ref-')&&row.lemma!=='km/h').length};
 await writeFile(resolve(root,'docs/german-vocabulary-expansion.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildGermanPackage(process.argv[2]),null,2));
