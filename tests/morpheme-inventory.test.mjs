import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMorphemes,validateMorphemeTranslations,assembleMorphemes,readableMorpheme} from '../web/js/packages/morphemes.js';
const core={kind:'study',targetLanguage:'en',morphemes:[{id:'ab-away',form:'ab-',variants:['abs-'],kind:'prefix',origin:'Latin',examples:['absent'],source:'https://en.wiktionary.org/wiki/ab-',senses:[{id:'ab-away-0',tags:[]}]}]};
const pair={kind:'explanation',targetLanguage:'en',morphemes:[{id:'ab-away',senses:[{id:'ab-away-0',meaning:'~에서 떨어져; 밖으로'}]}]};
test('readable inventory accepts ab-, ad- and -ling while excluding reconstructed and phonetic labels',()=>{
 for(const value of ['ab-','ad-','-ling','aud','-o-'])assert.ok(readableMorpheme(value));
 for(const value of ['*h₂eng-','h₂eng','/æd/','ἀντί','<script>',''])assert.ok(!readableMorpheme(value));
});
test('inventory meanings download independently without requiring a vocabulary entry for every root',()=>{
 validateMorphemes(core);validateMorphemes(pair);validateMorphemeTranslations(core,pair);
 const rows=assembleMorphemes(core,pair);assert.equal(rows[0].form,'ab-');assert.equal(rows[0].senses[0].meaning,'~에서 떨어져; 밖으로');assert.deepEqual(rows[0].examples,['absent']);assert.equal(core.morphemes[0].senses[0].meaning,undefined);
});
test('reject missing senses, repeated identities, unsafe links and executable or translated core fields',()=>{
 for(const edit of [p=>p.morphemes[0].form='*h₂eng-',p=>p.morphemes[0].source='javascript:alert(1)',p=>p.morphemes.push(p.morphemes[0]),p=>p.morphemes[0].senses[0].meaning='away',p=>p.morphemes[0].script='alert(1)']){const p=structuredClone(core);edit(p);assert.throws(()=>validateMorphemes(p),/morphemes/);}
 for(const edit of [p=>p.morphemes=[],p=>p.morphemes[0].senses=[],p=>p.morphemes[0].senses[0].id='wrong-sense']){const p=structuredClone(pair);edit(p);assert.throws(()=>validateMorphemeTranslations(core,p),/coverage/);}
});

test('published full inventory preserves study words and covers every source sense in English and Korean',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
 const {validateExplanation,MAX_PACKAGE_BYTES}=await import('../web/js/packages/schema.js');
 const source=await read('language-packages/sources/exercises/english-morpheme-inventory.json'),release=await read('language-packages/sources/exercises/english-morpheme-release.json');
 const bytes=await readFile(new URL('../language-packages/sources/exercises/english-morpheme-inventory.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),release.sourceSha256);
 const core=await read(`language-packages/en-core-${release.to}.json`),before=await read(`language-packages/en-core-${release.from}.json`);
 assert.deepEqual(core.entries,before.entries);assert.deepEqual(core.families,before.families);assert.deepEqual(core.exercises,before.exercises);
 assert.ok(core.morphemes.length>1000);assert.equal(core.morphemes.length,source.coverage.entries);assert.equal(core.morphemes.reduce((n,r)=>n+r.senses.length,0),source.coverage.senses);
 for(const form of ['ab-','ad-','-ling'])assert.ok(core.morphemes.some(row=>row.form===form));
 assert.ok(source.coverage.sourceCorrections.some(row=>row.form==='anilino-'));assert.ok(core.morphemes.every(row=>readableMorpheme(row.form)&&row.variants.every(readableMorpheme)));
 for(const locale of ['en','ko']){
  const pair=await read(`language-packages/en-${locale}-${release.to}.json`);validateExplanation(core,pair);
  assert.equal(pair.morphemes.flatMap(row=>row.senses).length,source.coverage.senses);
  assert.ok(pair.morphemes.every(row=>row.senses.every(s=>s.meaning.trim()&&(locale==='en'||/[가-힣]/u.test(s.meaning)))));
  assert.match(pair.license.notice,/CC BY-SA 4.0/);assert.ok(pair.license.links.some(row=>row.url.includes('en.wikipedia.org')));
 }
 const payload=await readFile(new URL(`../language-packages/en-core-${release.to}.json`,import.meta.url));assert.ok(payload.length<MAX_PACKAGE_BYTES);
});

test('source register labels remain visible and translated without exposing parser metadata',async()=>{
 const {renderMorphemeSense}=await import('../web/js/shared/morpheme-view.js');const sense={meaning:'A non-neutral historical usage.',tags:['morpheme','offensive','obsolete']};
 assert.match(renderMorphemeSense(sense,'en'),/Offensive/);assert.match(renderMorphemeSense(sense,'ko'),/폐어/);assert.ok(!renderMorphemeSense(sense,'en').includes('>morpheme<'));
});
