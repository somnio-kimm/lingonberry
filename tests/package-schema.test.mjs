import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePackage, validateDescriptor, validateExplanation} from '../web/js/packages/schema.js';
import {fixture, explanationFixture} from './package-fixture.js';
for (const targetLanguage of ['de', 'zh', 'ja', 'ko', 'en']) {
  test(`${targetLanguage} core and explanation language have independent identities`, () => {
    const {data, descriptor} = fixture({id:`${targetLanguage}-core`, targetLanguage});
    assert.equal(validatePackage(data, validateDescriptor(descriptor)).id, `${targetLanguage}-core`);
    const explanation = explanationFixture(data, 'ko');
    assert.equal(validateExplanation(data, explanation.data).id, `${targetLanguage}-ko`);
  });
}
for (const [name, mutate] of [
  ['unknown schema', data => {data.schemaVersion = 3;}],
  ['mismatched identity', data => {data.targetLanguage = 'zh';}],
  ['duplicate entries', data => {data.entries.push(data.entries[0]);}],
  ['bundled translations', data => {data.entries[0].translations = {ko:'집'};}],
  ['missing license', data => {delete data.license;}],
  ['empty content', data => {data.entries = [];}],
  ['invalid language code', data => {data.targetLanguage = '../secret';}],
]) {
  test(`rejects ${name}`, () => {const {data} = fixture();mutate(data);assert.throws(() => validatePackage(data), /Invalid language package/);});
}
test('catalog identity, version and explanation language match downloaded content', () => {
  const study = fixture(), {data, descriptor} = explanationFixture(study.data);
  for (const change of [{id:'zh-ko'}, {version:'2.0.0'}, {explanationLanguage:'en'}, {studyVersion:'2.0.0'}]) {
    assert.throws(() => validatePackage(data, {...descriptor, ...change}), /differs/);
  }
});
test('catalog enforces bounded size and a SHA-256 digest', () => {
  const {descriptor} = fixture();
  for (const change of [{bytes:-1}, {bytes:1000000000}, {sha256:'invalid'}]) assert.throws(() => validateDescriptor({...descriptor,...change}), /Invalid language package/);
});
for (const [name, change] of [
  ['wrong core version', data => {data.studyVersion = '2.0.0';}],
  ['missing word', data => {data.entries[0].id = 'other-word';}],
  ['missing example translation', data => {delete data.entries[0].exampleTranslation;}],
]) {
  test(`rejects explanation with ${name}`, () => {
    const study = fixture(), explanation = explanationFixture(study.data);change(explanation.data);
    assert.throws(() => validateExplanation(study.data, explanation.data), /Invalid language package/);
  });
}

test('licence links retain a finite bound while allowing the new source attribution',()=>{
 const {data}=fixture();data.license.links=Array.from({length:20},(_,index)=>({title:'Source '+index,url:'https://example.com/'+index}));validatePackage(data);data.license.links.push({title:'Extra',url:'https://example.com/extra'});assert.throws(()=>validatePackage(data),/licence links/);
});
