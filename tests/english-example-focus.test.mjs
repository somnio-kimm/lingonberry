import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEnglishFormIndex,resolveEnglishExampleFocus,validateEnglishGapFill} from '../scripts/content/english-example-focus.mjs';

const source=line=>({url:'https://en.wiktionary.org/wiki/fixture#English',creator:'English Wiktionary contributors',
 license:'CC-BY-SA-4.0',sourcePath:'fixture/en-extract.jsonl.gz',sourceLine:line,rawLineSha256:line.toString(16).padStart(64,'0'),
 digestAlgorithm:'sha256-original-json-without-line-terminator'});
const row=(word,partOfSpeech,forms,line=1)=>({language:'en',word,partOfSpeech,forms,source:source(line)});
const form=(value,...tags)=>({form:value,tags});
const resolve=(word,partOfSpeech,sentence,options={})=>resolveEnglishExampleFocus({entry:{word,partOfSpeech},sentence,...options});

test('English extractor row shape resolves regular plural, with exact source/form proof',()=>{
 const index=buildEnglishFormIndex([row('dictionary','noun',[form('dictionaries','plural'),form('dixnary','alternative','obsolete')])]);
 const result=resolve('dictionary','noun','Two dictionaries are here.',{formIndex:index});
 assert.equal(result.status,'resolved');assert.deepEqual(result.focus,{start:4,text:'dictionaries'});
 assert.equal(result.evidence[0].kind,'verified-source-form');
 assert.deepEqual(result.evidence[0].form,{form:'dictionaries',tags:['plural']});
 assert.deepEqual(result.evidence[0].source,source(1));
});

test('irregular verb and adjective forms come from matching POS metadata',()=>{
 const index=buildEnglishFormIndex([row('go','verb',[form('went','past')]),row('good','adj',[form('better','comparative')],2)]);
 for(const [word,pos,sentence,expected] of [['go','verb','She went home.',{start:4,text:'went'}],
  ['good','adjective','This is better.',{start:8,text:'better'}]]){
  assert.deepEqual(resolve(word,pos,sentence,{formIndex:index}).focus,expected);
 }
 assert.equal(resolve('go','noun','She went home.',{formIndex:index}).status,'missing');
 assert.equal(resolve('go','verb','She goed home.',{formIndex:index}).status,'missing');
});

test('noun and verb homographs never borrow one another’s inflections',()=>{
 const index=buildEnglishFormIndex([row('run','verb',[form('ran','past')]),row('run','noun',[form('runs','plural')],2)]);
 assert.equal(resolve('run','noun','She ran yesterday.',{formIndex:index}).status,'missing');
 assert.deepEqual(resolve('run','noun','Two runs were enough.',{formIndex:index}).focus,{start:4,text:'runs'});
});

const lieRows=[row('lie','verb',[form('lay','past'),form('lain','past','participle'),form('lying','present','participle')],10),
 row('lie','verb',[form('lied','past'),form('lying','present','participle')],11)];
test('conflicting same-POS paradigms require a bound source row, even for shared inflections',()=>{
 const index=buildEnglishFormIndex(lieRows);
 for(const sentence of ['She lay there.','She lied yesterday.','She is lying.']){
  const result=resolve('lie','verb',sentence,{formIndex:index});
  assert.equal(result.status,'ambiguous');assert.equal(result.evidence[0].kind,'conflicting-source-paradigms');
  assert.equal(result.evidence[0].rows.length,2);assert.equal(result.candidates.length,1);
 }
 const bound=resolve('lie','verb','She lied yesterday.',{formIndex:index,sourceBinding:{...source(11),senseIndex:0}});
 assert.equal(bound.status,'resolved');assert.deepEqual(bound.focus,{start:4,text:'lied'});assert.equal(bound.evidence[0].bound,true);
 assert.equal(bound.evidence[0].reviewedSourceBinding.senseIndex,0);
 assert.equal(resolve('lie','verb','She lay there.',{formIndex:index,sourceBinding:source(11)}).status,'missing');
});

test('a unique lemma needs no morphological disambiguation; repeated lemma still does',()=>{
 const formIndex=buildEnglishFormIndex(lieRows);
 assert.deepEqual(resolve('lie','verb','Do not lie.',{formIndex}).focus,{start:7,text:'lie'});
 assert.equal(resolve('lie','verb','Lie or lie?',{formIndex}).status,'ambiguous');
});

test('same-head/POS rows with identical verified form sets can resolve safely',()=>{
 const formIndex=buildEnglishFormIndex([row('cat','noun',[form('cats','plural')],1),row('cat','noun',[form('cats','plural')],2)]);
 const result=resolve('cat','noun','Two cats sleep.',{formIndex});
 assert.equal(result.status,'resolved');assert.deepEqual(result.focus,{start:4,text:'cats'});assert.equal(result.evidence.length,2);
});

test('invalid source bindings fail closed rather than silently finding a lemma',()=>{
 const formIndex=buildEnglishFormIndex(lieRows);
 for(const sourceBinding of [{sourceLine:10},source(99),{...source(10),partOfSpeech:'noun'},{...source(10),senseIndex:-1}]){
  assert.equal(resolve('lie','verb','Do not lie.',{formIndex,sourceBinding}).status,'invalid');
 }
});

test('only valid modern inflection metadata is eligible, never glossary or stem text',()=>{
 const forms=[form('glossary','inflection-template'),form('no-table-tags','table-tags'),form('-','past'),
  form('stale','past','archaic'),form('typo','past','misspelling'),form('odd','past','nonstandard'),
  form('proscribed','past','proscribed'),form('unmarked'),{form:'stem',tags:['canonical'],roman:'stems'},form('modern','past')];
 const formIndex=buildEnglishFormIndex([row('fixture','verb',forms)]);
 for(const word of ['glossary','no-table-tags','stale','typo','odd','proscribed','unmarked','stem','stems']){
  assert.equal(resolve('fixture','verb',word+'.',{formIndex}).status,'missing',word);
 }
 assert.deepEqual(resolve('fixture','verb','A modern example.',{formIndex}).focus,{start:2,text:'modern'});
});

test('unrelated-language form rows are ignored and malformed English provenance is rejected',()=>{
 assert.equal(buildEnglishFormIndex([{...row('go','verb',[form('went','past')]),language:'de'}]).englishRows,0);
 assert.throws(()=>buildEnglishFormIndex([{...row('go','verb',[]),source:{sourceLine:1}}]),/Malformed/);
 assert.throws(()=>buildEnglishFormIndex([row('go','verb',[]),row('go','verb',[form('went','past')])]),/Conflicting/);
});

test('whole-word matching rejects art inside party and Unicode letters, marks and numbers',()=>{
 for(const sentence of ['A party.','art2','2art','arté','éart','art\u0301'])assert.equal(resolve('art','noun',sentence).status,'missing',sentence);
 assert.deepEqual(resolve('art','noun','“Art,” she said!').focus,{start:1,text:'Art'});
});

test('all valid occurrences compete, including exact versus case variants and inflected forms',()=>{
 assert.equal(resolve('art','noun','Art and art.').status,'ambiguous');
 const formIndex=buildEnglishFormIndex([row('walk','verb',[form('walked','past')])]);
 const result=resolve('walk','verb','We walk and walked.',{formIndex});
 assert.equal(result.status,'ambiguous');assert.deepEqual(result.candidates.map(candidate=>candidate.focus),[{start:3,text:'walk'},{start:12,text:'walked'}]);
});

test('a reviewed explicit span selects a repeat and outranks incompatible source paradigms',()=>{
 const result=resolve('lie','verb','Lie or lie?',{formIndex:buildEnglishFormIndex(lieRows),reviewedFocus:{start:7,text:'lie'}});
 assert.equal(result.status,'resolved');assert.deepEqual(result.focus,{start:7,text:'lie'});
 assert.deepEqual(result.evidence,[{kind:'reviewed-focus'}]);
});

test('invalid explicit spans never fall back to an automatic lemma',()=>{
 for(const reviewedFocus of [{text:'art'},{start:0.5,text:'art'},{start:-1,text:'art'},
  {start:0,text:'Art'},{start:0,text:''},{start:0,text:'ar'},null]){
  assert.equal(resolve('art','noun','art.',{reviewedFocus}).status,'invalid');
 }
});

test('approved search aliases provide focus without inventing listening aliases or mutating inputs',()=>{
 const options={entry:{word:'hippopotamus',partOfSpeech:'noun',listeningAliases:[]},sentence:'A hippo swims.',approvedAliases:['hippo']};
 const original=structuredClone(options),result=resolveEnglishExampleFocus(options);
 assert.deepEqual(result.focus,{start:2,text:'hippo'});assert.equal(result.evidence[0].kind,'approved-search-alias');
 assert.deepEqual(options,original);assert.equal('listeningAliases' in result,false);
 assert.equal(resolve('hippopotamus','noun',options.sentence).status,'missing');
 assert.equal(resolve('colour','noun','colour or color?',{approvedAliases:['color']}).status,'ambiguous');
});

test('Unicode matches preserve the original UTF-16 offsets, punctuation and decomposed sentence',()=>{
 const sentence='😀 A cafe\u0301 opens!';
 const result=resolve('café','noun',sentence);
 assert.deepEqual(result.focus,{start:5,text:'cafe\u0301'});
 assert.equal(sentence.slice(result.focus.start,result.focus.start+result.focus.text.length),result.focus.text);
 assert.equal(resolve('café','noun',sentence,{reviewedFocus:{start:5,text:'cafe'}}).status,'invalid');
 assert.equal(resolve('😀','noun',sentence,{reviewedFocus:{start:1,text:'\ude00'}}).status,'invalid');
 assert.deepEqual(resolve('𐐨','noun','𐐀!',{}).focus,{start:0,text:'𐐀'});
});

test('case folding cannot match half of a Unicode grapheme',()=>{
 assert.equal(resolve('i','noun','İ!').status,'missing');
 assert.deepEqual(resolve('İ','noun','İ!').focus,{start:0,text:'İ'});
});

test('verified multiword inflections match only contiguous phrases',()=>{
 const formIndex=buildEnglishFormIndex([row('take off','verb',[form('took off','past')])]);
 assert.deepEqual(resolve('take off','verb','She took off her coat.',{formIndex}).focus,{start:4,text:'took off'});
 assert.equal(resolve('take off','verb','She took her coat off.',{formIndex}).status,'missing');
});

test('expression morphology requires a reviewed dictionary POS binding',()=>{
 const formIndex=buildEnglishFormIndex([row('take off','verb',[form('took off','past')])]);
 assert.equal(resolve('take off','expression','She took off.',{formIndex}).status,'missing');
 assert.equal(resolve('take off','expression','She took off.',{formIndex,sourceBinding:source(1)}).status,'invalid');
 assert.deepEqual(resolve('take off','expression','She took off.',{formIndex,sourceBinding:{...source(1),partOfSpeech:'verb'}}).focus,{start:4,text:'took off'});
});

test('approved discontinuous gaps remain separate from focus, preserving the intervening noun',()=>{
 const sentence='She took her coat off.',gapFill={parts:['She ',' her coat ','.'],answers:['took','off']};
 const result=resolve('take off','expression',sentence,{gapFill});
 assert.equal(result.status,'missing');assert.equal('focus' in result,false);assert.equal(result.gaps.status,'resolved');
 assert.deepEqual(result.gaps.descriptor,{...gapFill,spans:[{start:4,text:'took'},{start:18,text:'off'}]});
 assert.equal(result.gaps.descriptor.parts[1],' her coat ');
});

test('malformed or stale approved gaps have an explicit invalid status',()=>{
 const sentence='She took her coat off.';
 for(const gapFill of [{parts:['She ','.'],answers:['took','off']},
  {parts:['She ',' her hat ','.'],answers:['took','off']},
  {parts:['She ',' her coat ','.'],answers:['took',42]},
  {parts:['She ',' her coat ','.'],answers:['took','off'],alternatives:[['takes']]},
  {parts:['She t',' her coat ','.'],answers:['ook','off']}]){
  assert.equal(validateEnglishGapFill({sentence,gapFill}).status,'invalid');
 }
 const result=resolve('took','verb',sentence,{gapFill:{parts:[],answers:[]}});
 assert.equal(result.status,'resolved');assert.equal(result.gaps.status,'invalid');
});
