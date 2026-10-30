import {assembleCollocations} from './collocations.js';
import {assembleExercises} from './exercises.js';
import {allowsExplanation} from '../shared/language-pairs.js';
import {validateDescriptor, validateExplanation, validatePackage} from './schema.js';

export function availableExplanations(catalog, targetLanguage) {
  return catalog.filter(item => item.kind === 'explanation' && item.targetLanguage === targetLanguage && allowsExplanation(targetLanguage,item.explanationLanguage) &&
    catalog.some(core => core.kind === 'study' && core.targetLanguage === targetLanguage && core.version === item.studyVersion));
}

/** Assemble a study view only after its independently stored packages are compatible. */
export async function loadStudy(manager, catalog, targetLanguage, explanationLanguage, options = {}) {
  if(!allowsExplanation(targetLanguage,explanationLanguage))throw new Error('This explanation pair is not offered.');
  const explanationDescriptor = availableExplanations(catalog, targetLanguage).find(item => item.explanationLanguage === explanationLanguage);
  const studyDescriptor = catalog.find(item => item.kind === 'study' && item.targetLanguage === targetLanguage && item.version === explanationDescriptor?.studyVersion);
  if (!studyDescriptor || !explanationDescriptor) throw new Error('This language pair is not available.');
  validateDescriptor(studyDescriptor);validateDescriptor(explanationDescriptor);
  async function resolve(descriptor, resolveOptions) {
    if (!options.installedOnly) return manager.ensure(descriptor, resolveOptions);
    const installed = await manager.get(descriptor.id, descriptor.version);
    if (!installed) throw new Error('This language package is not installed.');
    validatePackage(installed, descriptor);resolveOptions.validate?.(installed);
    return installed;
  }
  const study = await resolve(studyDescriptor, options);
  options.signal?.throwIfAborted();
  const explanation = await resolve(explanationDescriptor, {...options, validate: data => validateExplanation(study, data)});
  return assembleStudy(study,explanation);
}
export function assembleStudy(study,explanation){
  validateExplanation(study,explanation);
  const {targetLanguage}=study,explanationLanguage=explanation.explanationLanguage;
  const meanings = new Map(explanation.entries.map(entry => [entry.id, entry]));
  return {
    targetLanguage, explanationLanguage, studyVersion: study.version, explanationVersion: explanation.version,
    licenses: [study.license, explanation.license],
    ...assembleExercises(study,explanation),
    readingPractice:study.readingPractice,practiceData:study.practiceData,
    retiredEntries:study.retiredEntries||[],reviewInvalidations:study.reviewInvalidations||[],
    entries: study.entries.map(entry => ({...entry, meaning: meanings.get(entry.id).meaning,meanings:meanings.get(entry.id).meanings,collocations:assembleCollocations(entry,meanings.get(entry.id)),
      ...(entry.additionalExamples?.length?{additionalExamples:entry.additionalExamples.map((example,i)=>({...example,translation:meanings.get(entry.id).additionalExampleTranslations[i]}))}:{}),
      ...(entry.example ? {example: {...entry.example, translation: meanings.get(entry.id).exampleTranslation}} : {})})),
  };
}
