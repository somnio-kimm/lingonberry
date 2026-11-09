import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {auditEnglishSenseExamples} from './content/english-sense-examples.mjs';
import {auditReviewedExamples} from './content/reviewed-examples.mjs';
import {validateCatalog} from '../web/js/packages/catalog.js';
import {assembleStudy} from '../web/js/packages/study.js';
import {studyWords} from '../web/js/presentation/study-profiles.js';
import {findSentenceFocus} from '../web/js/shared/lexicon-sentences.js';
import {selectWordExample} from '../web/js/shared/word-example.js';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const byId = rows => new Map(rows.map(row => [row.id, row]));
const readVerified = async ({path, bytes, sha256}) => {
 const data = await readFile(new URL(path.replace(/^\//u, ''), root));
 if (data.length !== bytes || sha(data) !== sha256) throw new Error('Audit input changed: ' + path);
 return data;
};
const readPackage = async descriptor => JSON.parse(await readVerified({...descriptor,path:descriptor.url}));
const readRows = buffer => buffer.toString('utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const legacyPath = 'language-packages/sources/examples/editions/5.0.0/';

async function verifyLegacyReview() {
 const report = await json(legacyPath+'en-completion-report.json');
 const files = new Map(await Promise.all(report.files.map(async descriptor => [descriptor.path,await readVerified(descriptor)])));
 const records = suffix => readRows(files.get(legacyPath+'en-completion-'+suffix+'.jsonl'));
 const [core,...pairs] = await Promise.all(report.sourcePackages.map(readPackage));
 const inputs = records('bindings'), authored = records('authored');
 const proof = auditReviewedExamples({core,pairs,inputs,authored,reviews:records('reviews'),
  ownership:JSON.parse(files.get(legacyPath+'en-completion-ownership.json'))});
 if (!proof.fullCoverage || proof.independentlyReviewed !== report.independentlyReviewed) throw new Error('Incomplete archived example review');
 const bindings = byId(inputs);
 return new Map(authored.map(row => [row.id,{...row,binding:bindings.get(row.id)}]));
}

const output = resolve(process.argv[2] || 'local-data/audits/english-inventory');
const catalogue = validateCatalog(await json('language-packages/catalog.json'));
const descriptors = ['en','ko'].map(locale => {
 const pair = catalogue.find(row => row.id === 'en-'+locale);
 const core = catalogue.find(row => row.id === 'en-core' && row.version === pair.studyVersion);
 return {core,pair};
});
const [legacy,...studies] = await Promise.all([
 verifyLegacyReview(),
 ...descriptors.map(async ({core,pair}) => assembleStudy(...await Promise.all([readPackage(core),readPackage(pair)]))),
]);
const [english,korean] = studies;
const englishWords = studyWords(english), koreanWords = byId(studyWords(korean));
const count = Object.create(null), rows = [];
const tally = label => {count[label] = (count[label] || 0) + 1;};
for (const word of englishWords) {
 const translation = koreanWords.get(word.id), prior = legacy.get(word.id);
 const example = selectWordExample(word,'en');
 const translated = translation && selectWordExample(translation,'en');
 const sourceType = !example ? 'none' : word.examples.length ? 'primary' : 'reference';
 const flags = [];
 if (!example) flags.push('missingEnglishExample');
 else if (!findSentenceFocus(word,example,'en')) flags.push('exampleHasNoUniqueQuizFocus');
 if (sourceType === 'reference') flags.push('referenceOnly');
 if (!translation) flags.push('missingKoreanEntry');
 else {
  if (translation.lemma !== word.lemma || translation.pos !== word.pos) flags.push('sharedEntryIdentityDiffers');
  if (translation.level !== word.level) flags.push('sharedEntryLevelDiffers');
  if (translated?.text !== example?.text) flags.push('sharedExampleDiffers');
  if (!translated?.studyTranslation || !/\p{Script=Hangul}/u.test(translated.studyTranslation)) flags.push('missingKoreanExampleTranslation');
  if (!/\p{Script=Hangul}/u.test(translation.studyMeaning)) flags.push('koreanGlossHasNoHangul');
 }
 const reviewedEnglishExample = !!prior && example?.text === prior.text &&
  word.lemma === (prior.headwordCorrection?.word || prior.binding.word) &&
  word.pos === prior.binding.partOfSpeech && word.studyMeaning === prior.binding.meaningEn &&
  example.focus?.start === prior.focus.start && example.focus?.text === prior.focus.text;
 const reviewedKoreanSentence = reviewedEnglishExample && translated?.studyTranslation === prior.ko;
 const priorKoreanGlossUnchanged = reviewedKoreanSentence && translation.studyMeaning === prior.binding.meaningKo;
 if (reviewedEnglishExample) tally('archivedReviewMatchesEnglishSenseAndExample');
 if (reviewedKoreanSentence) tally('archivedReviewAlsoMatchesKoreanSentence');
 if (priorKoreanGlossUnchanged) tally('sameKoreanGlossAsArchivedBinding');
 for (const flag of flags) tally(flag);
 rows.push({
  id:word.id, word:word.lemma, pos:word.pos, level:word.level, meaningEn:word.studyMeaning,
  meaningKo:translation?.studyMeaning ?? null, example:example?.text ?? null,
  exampleKo:translated?.studyTranslation ?? null, sourceType, flags,
  reviewedEnglishExample, reviewedKoreanSentence, priorKoreanGlossUnchanged,
 });
}
const summary = {
 checkedEntries:rows.length, koreanEntries:koreanWords.size,
 packages:descriptors, legacyIndependentlyReviewed:legacy.size,
 counts:count, repeatedHeadwords:auditEnglishSenseExamples(english),
 scope:'Current catalogue integrity, example display and archived review binding. Prior review covers sentence-to-sense alignment and example translation. Matching a legacy Korean gloss does not establish that the gloss is correct. No-focus flags can be legitimate inflections or separated phrases.',
};
await mkdir(output,{recursive:true});
await Promise.all([
 writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n'),
 writeFile(join(output,'entries.jsonl'),rows.map(row => JSON.stringify(row)).join('\n')+'\n'),
]);
console.log(JSON.stringify(summary,null,2));
