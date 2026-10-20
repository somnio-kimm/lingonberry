import {validateExercises,validateExerciseTranslations} from './exercises.js';
import {compareContentVersions} from '../shared/review-content.js';
export const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
const locale = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const identifier = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const version = /^\d+\.\d+\.\d+$/;
function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid language package: ${message}`);
}
function object(value, name) {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), name);
}
function text(value, name, limit = 4000) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= limit, name);
}
function checkVersion(value) {
  requireValue(typeof value === 'string' && value.length < 40 && version.test(value), 'version');
}
function identity(value) {
  object(value, 'object');
  requireValue(typeof value.targetLanguage === 'string' && locale.test(value.targetLanguage), 'study language');
  requireValue(['study', 'explanation'].includes(value.kind), 'package kind');
  checkVersion(value.version);
  if (value.kind === 'study') {
    requireValue(value.id === `${value.targetLanguage}-core`, 'study package id');
    requireValue(value.explanationLanguage === undefined, 'study core must not select an explanation language');
  } else {
    requireValue(typeof value.explanationLanguage === 'string' && locale.test(value.explanationLanguage), 'explanation language');
    requireValue(value.id === `${value.targetLanguage}-${value.explanationLanguage}`, 'explanation package id');
    checkVersion(value.studyVersion);
  }
}
export function validateDescriptor(value) {
  identity(value);
  text(value.url, 'URL', 2000);
  requireValue(typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256), 'SHA-256');
  requireValue(Number.isInteger(value.bytes) && value.bytes > 0 && value.bytes <= MAX_PACKAGE_BYTES, 'byte length');
  return value;
}
export function validatePackage(value, expected) {
  identity(value);
  requireValue(value.schemaVersion === 2, 'unsupported schema version');
  object(value.license, 'license');
  text(value.license.identifier, 'license identifier');
  text(value.license.notice, 'license notice', 100000);
  if(value.license.links!==undefined){requireValue(Array.isArray(value.license.links)&&value.license.links.length<=10,'licence links');for(const link of value.license.links){text(link.title,'licence link title',200);text(link.url,'licence link URL',2000);const url=new URL(link.url);requireValue(url.protocol==='https:'&&!url.username&&!url.password,'licence link HTTPS');}}
  requireValue(Array.isArray(value.entries) && value.entries.length > 0 && value.entries.length <= 50000, 'entries');
  const ids = new Set();
  for (const entry of value.entries) {
    object(entry, 'entry');
    requireValue(typeof entry.id === 'string' && identifier.test(entry.id) && !ids.has(entry.id), 'entry id');
    ids.add(entry.id);
    if (value.kind === 'explanation') {
      text(entry.meaning, 'meaning');
      if (entry.exampleTranslation !== undefined) text(entry.exampleTranslation, 'example translation');
      if(entry.meanings!==undefined){requireValue(Array.isArray(entry.meanings)&&entry.meanings.length>0,'meaning list');entry.meanings.forEach(item=>text(item,'meaning list item'));}
      if(entry.additionalExampleTranslations!==undefined){requireValue(Array.isArray(entry.additionalExampleTranslations)&&entry.additionalExampleTranslations.length<=49,'additional translations');entry.additionalExampleTranslations.forEach(item=>text(item,'additional example translation'));}
    } else {
      text(entry.word, 'word', 200);
      text(entry.partOfSpeech, 'part of speech', 100);
      requireValue(entry.translations === undefined && entry.meaning === undefined, 'translations belong in explanation packs');
      if(entry.exampleStatus!==undefined)text(entry.exampleStatus,'example status',100);
      if(entry.referenceExamples!==undefined){requireValue(Array.isArray(entry.referenceExamples)&&entry.referenceExamples.length<=5,'reference examples');for(const example of entry.referenceExamples){object(example,'reference example');text(example.text,'reference example text');if(example.sourceEnglishTranslation!==undefined)text(example.sourceEnglishTranslation,'source English translation');object(example.source,'reference example source');text(example.source.url,'source URL',2000);text(example.source.license,'source licence',100);}}
      if(entry.level!==undefined)text(entry.level,'level',40);
      const strings=(values,name)=>{requireValue(Array.isArray(values)&&values.length<=100,name);values.forEach(value=>text(value,name,200));};
      if(entry.aliases!==undefined)strings(entry.aliases,'aliases');
      if(entry.tags!==undefined)strings(entry.tags,'tags');
      if(entry.grammar!==undefined){object(entry.grammar,'grammar');if(entry.grammar.acceptedArticles!==undefined)strings(entry.grammar.acceptedArticles,'accepted articles');if(entry.grammar.studyTier!==undefined)text(entry.grammar.studyTier,'study tier',80);}
      for (const name of ['article', 'pronunciation']) {
        if (entry[name] !== undefined) text(entry[name], name, 200);
      }
      if(entry.additionalExamples!==undefined){requireValue(Array.isArray(entry.additionalExamples)&&entry.additionalExamples.length<=49,'additional examples');for(const example of entry.additionalExamples){object(example,'additional example');text(example.text,'additional example text');requireValue(example.translations===undefined,'example translations belong in explanation packs');}}
      if (entry.example !== undefined) {
        object(entry.example, 'example');
        text(entry.example.text, 'example text');
        requireValue(entry.example.translations === undefined, 'example translations belong in explanation packs');
      }
    }
  }
  if(value.kind==='study'){
    const retired=new Set();
    if(value.retiredEntries!==undefined){
      requireValue(Array.isArray(value.retiredEntries)&&value.retiredEntries.length<=50000,'retired entries');
      for(const row of value.retiredEntries){
        object(row,'retired entry');requireValue(typeof row.id==='string'&&identifier.test(row.id)&&!ids.has(row.id)&&!retired.has(row.id),'retired entry id');retired.add(row.id);text(row.reason,'retirement reason');
        if(row.replacementId!==undefined)requireValue(ids.has(row.replacementId),'retirement replacement');
        if(row.sameConcept!==undefined)requireValue(typeof row.sameConcept==='boolean'&&!!row.replacementId,'equivalent retirement');
      }
    }
    if(value.reviewInvalidations!==undefined){
      requireValue(Array.isArray(value.reviewInvalidations)&&value.reviewInvalidations.length<=100000,'review invalidations');const changed=new Set();
      for(const row of value.reviewInvalidations){
        object(row,'review invalidation');requireValue((ids.has(row.id)||retired.has(row.id))&&!changed.has(row.id),'review invalidation id');changed.add(row.id);checkVersion(row.minimumVersion);requireValue(compareContentVersions(row.minimumVersion,value.version)<=0,'future review invalidation');
      }
    }
  }
  validateExercises(value);
  if (expected) {
    for (const key of ['id', 'kind', 'targetLanguage', 'version', 'explanationLanguage', 'studyVersion']) {
      requireValue(value[key] === expected[key], `${key} differs from catalog`);
    }
  }
  return value;
}
export function validateExplanation(study, explanation) {
  validatePackage(study);validatePackage(explanation);
  requireValue(study.kind === 'study' && explanation.kind === 'explanation', 'study/explanation pair');
  requireValue(explanation.targetLanguage === study.targetLanguage && explanation.studyVersion === study.version, 'incompatible study version');
  const meanings = new Map(explanation.entries.map(entry => [entry.id, entry]));
  requireValue(meanings.size === study.entries.length, 'incomplete translation coverage');
  for (const entry of study.entries) {
    requireValue(meanings.has(entry.id), `missing translation: ${entry.id}`);
    const translated=meanings.get(entry.id);
    if (entry.example) text(translated.exampleTranslation, 'missing example translation');
    requireValue((entry.additionalExamples?.length||0)===(translated.additionalExampleTranslations?.length||0),'incomplete additional example translations');
  }
  validateExerciseTranslations(study,explanation);
  return explanation;
}
