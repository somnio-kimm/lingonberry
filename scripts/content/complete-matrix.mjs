import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {STUDY_LANGUAGES,allowsExplanation} from '../../web/js/shared/language-pairs.js';
import {validatePackage,validateExplanation} from '../../web/js/packages/schema.js';
import {findSentenceFocus} from '../../web/js/shared/lexicon-sentences.js';
const checks=['selected-sense','part-of-speech','native-grammar','translation-meaning','tense-negation-quantity','explanation-language'];
const licences=new Set(['MIT','CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0','CC-BY-SA-2.0-KR','CC-BY-2.0-FR']);
const placeholder=/^(?:TODO|TBD|translation pending|translation under review|example pending|번역 예정|번역 검토 중|예문 준비 중|翻訳待ち|翻訳未定|待翻译|翻译待审核)[.!。]?$/iu;
const scripts={ja:/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,ko:/\p{Script=Hangul}/u,zh:/\p{Script=Han}/u};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function contentDigest(record){const {review,...content}=record;return createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');}
function requireValue(value,message){if(!value)throw new Error('Incomplete reviewed content: '+message);}
function text(value,locale,label){requireValue(typeof value==='string'&&value.trim()&&value.length<=4000,label);requireValue(!placeholder.test(value.trim()),label+' placeholder');if(scripts[locale])requireValue(scripts[locale].test(value),label+' script');}
function wiktionaryUrl(value){
 try{const url=new URL(value);return url.hostname==='wiktionary.org'||url.hostname.endsWith('.wiktionary.org')?url:null;}catch{return null;}
}
function wiktionarySources(value){
 if(!value||typeof value!=='object')return [];
 const own=wiktionaryUrl(value.url)?[value]:[];
 return own.concat(Object.values(value).flatMap(wiktionarySources));
}
function wiktionaryTitle(url){
 const title=url.searchParams.get('title')??(url.pathname.startsWith('/wiki/')?decodeURIComponent(url.pathname.slice(6)):null);
 return title?.replaceAll('_',' ').normalize('NFC');
}
function requireWiktionaryAttribution(provenance){
 const sources=wiktionarySources(provenance);if(!sources.length)return;
 requireValue(provenance.license==='CC-BY-SA-4.0','Wiktionary share-alike licence');
 for(const source of sources){
  // Adaptation wrappers may carry the article URL while the complete original
  // credit remains nested under sources or derivedFrom. Keep those credits intact.
  const credits=wiktionarySources(source).filter(item=>item.url===source.url);
  requireValue(credits.some(item=>{
   const article=wiktionaryUrl(item.url),history=wiktionaryUrl(item.history??item.history_url);
   let licenseUrl;try{licenseUrl=new URL(item.licenseUrl??item.license_url);}catch{return false;}
   return typeof item.creator==='string'&&item.creator.trim()&&item.license==='CC-BY-SA-4.0'&&article?.protocol==='https:'&&!article.username&&!article.password&&history?.protocol==='https:'&&!history.username&&!history.password&&history.hostname===article.hostname&&history.searchParams.get('action')==='history'&&wiktionaryTitle(article)&&wiktionaryTitle(history)===wiktionaryTitle(article)&&licenseUrl.protocol==='https:'&&licenseUrl.hostname==='creativecommons.org'&&!licenseUrl.username&&!licenseUrl.password&&/^\/licenses\/by-sa\/4\.0\/?$/.test(licenseUrl.pathname);
  }),'Wiktionary contributor history and licence URL');
 }
}
function attribution(item){
 const p=item?.provenance;requireValue(p&&licences.has(p.license),'commercially reusable licence');requireValue(typeof p.creator==='string'&&p.creator.trim(),'creator attribution');
 requireValue(['app-authored','licensed-source','licensed-adaptation'].includes(p.kind),'provenance kind');
 if(p.kind!=='app-authored'){const url=new URL(p.url);requireValue(url.protocol==='https:'&&!url.username&&!url.password,'source URL');}
 requireWiktionaryAttribution(p);
}
/** This gate records explicit editorial decisions; structural validation is not a language-quality review. */
export function validateReviewedEntry(record,base,language){
 requireValue(record?.id===base.id,'stable entry ID');requireValue(record.authoringAgent,'authoring agent');
 const review=record.review;requireValue(review?.status==='checked'&&review.method==='AI-editorial','explicit AI editorial review');
 requireValue(review.reviewer&&review.reviewer!==record.authoringAgent,'independent reviewer');requireValue(review.sourceDigest===contentDigest(record),'review is stale');
 requireValue(checks.every(check=>review.checks?.includes(check)),'semantic review checks');requireValue(review.nativeSpeakerReview==='pending','honest native review status');
 requireValue(Array.isArray(review.findings)&&review.findings.every(item=>item.status==='resolved'),'unresolved quality findings');
 const lexical={...base,...record.lexical,id:base.id};text(lexical.word,language,'headword');text(lexical.partOfSpeech,null,'part of speech');
 for(const locale of STUDY_LANGUAGES.filter(locale=>allowsExplanation(language,locale))){
  const meaning=record.meanings?.[locale];text(meaning?.text,locale,locale+' meaning');attribution(meaning);
  if(language==='en'&&locale==='en')requireValue(meaning.text.trim().toLowerCase()!==lexical.word.trim().toLowerCase(),'circular English explanation');
 }
 requireValue(Array.isArray(record.examples)&&record.examples.length>0&&record.examples.length<=50,'at least one complete example');
 for(const example of record.examples){
  text(example.text,language,'native example');attribution(example);
  requireValue(findSentenceFocus({lemma:lexical.word},example,language),'selected target surface');
  for(const locale of STUDY_LANGUAGES.filter(locale=>allowsExplanation(language,locale))){
   const translated=example.translations?.[locale];text(translated?.text,locale,locale+' example translation');attribution(translated);
   if(locale===language)requireValue(translated.text===example.text,'English native example identity');
  }
 }
 return lexical;
}
/** Requires all entries and all requested pairs. It never releases a smaller subset as complete. */
export function compileCompleteMatrix({cores,records,version}){
 requireValue(STUDY_LANGUAGES.every(language=>cores[language]&&records[language]),'all seven languages');const packages=[];
 for(const language of STUDY_LANGUAGES){
  const base=cores[language];requireValue(base.version!==version,'new immutable version');const byId=new Map();
  for(const record of records[language]){requireValue(!byId.has(record.id),'duplicate '+record.id);byId.set(record.id,record);}
  requireValue(byId.size===base.entries.length,'exact entry coverage for '+language);
  const entries=base.entries.map(old=>{
   const record=byId.get(old.id);requireValue(record,'missing entry '+old.id);const lexical=validateReviewedEntry(record,old,language);
   const examples=record.examples.map(({translations,...example})=>example);
   // Untranslated reference sentences stay in the archived source edition, not beside a checked replacement sense.
   const {example,additionalExamples,referenceExamples,exampleStatus,...rest}=lexical;
   return {...rest,example:examples[0],...(examples.length>1?{additionalExamples:examples.slice(1)}:{}),exampleStatus:'AI-editorial-checked; native-speaker-review-pending',qualityReview:record.review};
  });
  const identifiers=new Set(base.license.identifier.split(/\s+AND\s+/));for(const record of byId.values()){for(const value of Object.values(record.meanings))identifiers.add(value.provenance.license);for(const example of record.examples){identifiers.add(example.provenance.license);for(const value of Object.values(example.translations))identifiers.add(value.provenance.license);}}
  const usesWiktionary=[...byId.values(),...entries].some(record=>wiktionarySources(record).length>0);
  const sourceNotice=usesWiktionary?'\n\n'+readFileSync(new URL('../../language-packages/credits/WIKTIONARY-SOURCE-REUSE.txt',import.meta.url),'utf8').trim():'';
  const license={...base.license,identifier:[...identifiers].sort().join(' AND '),notice:`Complete explanation edition ${version}. New original text is CC BY 4.0; source-derived text retains its per-item licence and attribution. AI editorial checks are recorded; native-speaker review remains pending.\n\n${base.license.notice}${sourceNotice}`};
  const study={...base,version,license,contentReview:{status:'AI-editorial-checked',nativeSpeakerReview:'pending',entries:entries.length,bilingualExamples:entries.length,examplesPending:0,explanationLanguages:STUDY_LANGUAGES.filter(locale=>allowsExplanation(language,locale))},entries};validatePackage(study);packages.push(study);
  for(const locale of study.contentReview.explanationLanguages){
   const pair={schemaVersion:2,kind:'explanation',id:language+'-'+locale,targetLanguage:language,explanationLanguage:locale,version,studyVersion:version,license,entries:entries.map(entry=>{
    const record=byId.get(entry.id),meaning=record.meanings[locale],translations=record.examples.map(example=>example.translations[locale]);
    return {id:entry.id,meaning:meaning.text,provenance:meaning.provenance,exampleTranslation:translations[0].text,exampleTranslationProvenance:translations[0].provenance,...(translations.length>1?{additionalExampleTranslations:translations.slice(1).map(item=>item.text),additionalTranslationProvenance:translations.slice(1).map(item=>item.provenance)}:{}),qualityReview:record.review};
   })};validateExplanation(study,pair);packages.push(pair);
  }
 }
 requireValue(packages.filter(item=>item.kind==='explanation').length===43,'43 explanation pairs');return packages;
}
