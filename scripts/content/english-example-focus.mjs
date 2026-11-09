/**
 * Pure compiler helper. Caller must authenticate the source-forms.jsonl bytes
 * against the extraction/review manifest before building this index. This does
 * not authenticate a dictionary dump, infer a sense, or grant an alias approval.
 *
 * buildEnglishFormIndex(iterable): consumes the English extractor's actual rows
 * {language,word,partOfSpeech,forms:[{form,tags}],source:{sourcePath,sourceLine,
 * rawLineSha256,...}}. Non-English rows are ignored; malformed English rows fail.
 *
 * resolveEnglishExampleFocus({entry:{word|lemma,partOfSpeech},sentence,formIndex,
 * reviewedFocus?,approvedAliases?:string[],sourceBinding?,gapFill?}) returns
 * {status:'resolved',focus:{start,text},evidence,candidates,gaps?} or
 * {status:'invalid'|'missing'|'ambiguous',reason,candidates,evidence,gaps?}.
 * Offsets always address the ORIGINAL sentence in UTF-16 code units. Neither
 * sentence nor caller data is modified. Never promotes aliases to audio answers.
 * sourceBinding must bind sourcePath + sourceLine + rawLineSha256, optionally
 * partOfSpeech. For an 'expression' entry the reviewed binding must also declare
 * the actual dictionary partOfSpeech; no verb/phrase POS is guessed.
 *
 * Explicit reviewed focus wins, even over an ambiguous dictionary paradigm.
 * Invalid explicit focus fails without automatic fallback. Otherwise all safe
 * occurrences compete; repeated matches are ambiguous. A unique lemma/approved
 * alias can resolve despite conflicting paradigms, since it needs no morphology.
 * Without a binding, automatic morphology requires identical complete form sets
 * across same-head/POS rows. Never union incompatible lexemes or stem a word.
 *
 * gapFill is separately approved structured exercise data. `gaps` has its own
 * status and never fabricates one contiguous focus over intervening objects.
 */
const wordCharacter=/[\p{L}\p{M}\p{N}]/u;
const segmenter=new Intl.Segmenter('en',{granularity:'grapheme'});
const text=value=>typeof value==='string'&&Boolean(value.trim());
const key=value=>value.normalize('NFC').toLocaleLowerCase('en');
const posNames=new Map(Object.entries({adjective:'adj',adverb:'adv',interjection:'intj',preposition:'prep',
 pronoun:'pron',determiner:'det',numeral:'num',conjunction:'conj','proper noun':'name','plural noun':'noun'}));
const posKey=value=>posNames.get(value)||value;
const inflections=new Set(['plural','past','present','participle','comparative','superlative','infinitive','gerund']);
// Conservative automatic policy; a curator may explicitly approve a marked form.
const excludedTags=new Set(['table-tags','inflection-template','obsolete','archaic','nonstandard','misspelling',
 'proscribed','hypercorrect','misconstruction','historical','dated','dialectal','rare','uncommon',
 'error-unknown-tag','pronunciation-spelling']);
const sourceKey=source=>JSON.stringify([source.sourcePath,source.sourceLine,source.rawLineSha256]);
function validSource(source){
 return source&&text(source.sourcePath)&&Number.isSafeInteger(source.sourceLine)&&source.sourceLine>0&&
  typeof source.rawLineSha256==='string'&&/^[a-f0-9]{64}$/u.test(source.rawLineSha256)&&
  source.digestAlgorithm==='sha256-original-json-without-line-terminator'&&text(source.url)&&
  text(source.creator)&&text(source.license);
}
function validForm(form){
 return form&&text(form.form)&&form.form===form.form.trim()&&wordCharacter.test(form.form)&&
  Array.isArray(form.tags)&&form.tags.every(tag=>typeof tag==='string')&&
  form.tags.some(tag=>inflections.has(tag))&&!form.tags.some(tag=>excludedTags.has(tag));
}
function copy(value){return structuredClone(value);}

export function buildEnglishFormIndex(rows){
 const lexemes=new Map(),identities=new Map();let englishRows=0,ignoredRows=0;
 for(const row of rows){
  if(row?.language!=='en'){ignoredRows++;continue;}
  if(!text(row.word)||!text(row.partOfSpeech)||!Array.isArray(row.forms)||!validSource(row.source)){
   throw new TypeError('Malformed English source form row');
  }
  const identity=sourceKey(row.source),serialized=JSON.stringify(row);
  if(identities.has(identity)){
   if(identities.get(identity)!==serialized)throw new TypeError('Conflicting English source row identity');
   continue;
  }
  identities.set(identity,serialized);englishRows++;
  const forms=row.forms.filter(validForm).map(copy),record={word:row.word,partOfSpeech:row.partOfSpeech,
   source:copy(row.source),forms,rejectedForms:row.forms.filter(form=>!validForm(form)).map(copy)};
  const head=key(row.word);if(!lexemes.has(head))lexemes.set(head,[]);lexemes.get(head).push(record);
 }
 return {lexemes,englishRows,ignoredRows};
}

function graphemeBoundaries(sentence){
 return new Set([0,sentence.length,...Array.from(segmenter.segment(sentence),part=>part.index)]);
}
function wholeWord(sentence,start,end){
 const before=start?Array.from(sentence.slice(0,start)).at(-1):'',after=Array.from(sentence.slice(end))[0]||'';
 return !wordCharacter.test(before)&&!wordCharacter.test(after);
}
function validateSpan(sentence,focus){
 if(!focus||!Number.isSafeInteger(focus.start)||focus.start<0||!text(focus.text)||
    focus.text!==focus.text.trim())return 'Reviewed focus requires an integer start and nonempty text';
 const end=focus.start+focus.text.length;
 if(sentence.slice(focus.start,end)!==focus.text)return 'Reviewed focus does not match the exact sentence substring';
 const boundaries=graphemeBoundaries(sentence);
 if(!boundaries.has(focus.start)||!boundaries.has(end))return 'Reviewed focus splits a Unicode grapheme/NFC boundary';
 if(!wordCharacter.test(focus.text)||!wholeWord(sentence,focus.start,end))return 'Reviewed focus is not a whole-word span';
 return null;
}

/** Case/NFC comparison with a map back to original UTF-16 grapheme boundaries. */
function prepareSentence(sentence){
 let folded='';const offsets=new Map([[0,0]]);
 for(const part of segmenter.segment(sentence)){
  folded+=key(part.segment);offsets.set(folded.length,part.index+part.segment.length);
 }
 return {sentence,folded,offsets};
}
function findOccurrences(prepared,form){
 const wanted=key(form),{sentence,folded,offsets}=prepared,matches=[];
 for(let i=folded.indexOf(wanted);i>=0;i=folded.indexOf(wanted,i+1)){
  const start=offsets.get(i),end=offsets.get(i+wanted.length);
  if(start===undefined||end===undefined||!wholeWord(sentence,start,end))continue;
  matches.push({start,text:sentence.slice(start,end)});
 }
 return matches;
}
function addCandidates(candidates,prepared,form,evidence){
 for(const focus of findOccurrences(prepared,form)){
  const identity=focus.start+':'+focus.text.length;
  if(!candidates.has(identity))candidates.set(identity,{focus,evidence:[]});
  candidates.get(identity).evidence.push(copy(evidence));
 }
}

export function validateEnglishGapFill({sentence,gapFill}){
 if(typeof sentence!=='string'||!gapFill||!Array.isArray(gapFill.parts)||!Array.isArray(gapFill.answers)||
    !gapFill.answers.length||gapFill.parts.length!==gapFill.answers.length+1||
    !gapFill.parts.every(part=>typeof part==='string')||!gapFill.answers.every(text)){
  return {status:'invalid',reason:'Gap parts/answers must be strings with one more part than nonempty answers'};
 }
 let reconstructed='';const spans=[];
 for(let i=0;i<gapFill.parts.length;i++){
  reconstructed+=gapFill.parts[i];
  if(i<gapFill.answers.length){spans.push({start:reconstructed.length,text:gapFill.answers[i]});reconstructed+=gapFill.answers[i];}
 }
 if(reconstructed!==sentence)return {status:'invalid',reason:'Gap parts/answers do not reconstruct the exact sentence'};
 for(const span of spans){const issue=validateSpan(sentence,span);if(issue)return {status:'invalid',reason:issue};}
 if(gapFill.alternatives!==undefined&&(!Array.isArray(gapFill.alternatives)||gapFill.alternatives.some(answers=>
  !Array.isArray(answers)||answers.length!==gapFill.answers.length||!answers.every(text)))){
  return {status:'invalid',reason:'Gap alternatives must have the same number of nonempty string answers'};
 }
 return {status:'resolved',descriptor:{parts:copy(gapFill.parts),answers:copy(gapFill.answers),spans,
  ...(gapFill.alternatives?{alternatives:copy(gapFill.alternatives)}:{})},evidence:{kind:'reviewed-gap-fill'}};
}

export function resolveEnglishExampleFocus(options){
 const {entry,sentence,formIndex,reviewedFocus,approvedAliases=[],sourceBinding,gapFill}=options;
 const candidates=new Map(),evidence=[];
 const gaps=gapFill!==undefined?validateEnglishGapFill({sentence,gapFill}):undefined;
 const result=(status,reason,extra={})=>({status,...(reason?{reason}:{}),candidates:[...candidates.values()],evidence,
  ...(gaps?{gaps}:{}),...extra});
 const lemma=entry?.word??entry?.lemma;
 if(!text(lemma)||!text(entry?.partOfSpeech)||!text(sentence))return result('invalid','Entry word/POS and sentence are required');
 if(reviewedFocus!==undefined){
  const issue=validateSpan(sentence,reviewedFocus);
  if(issue)return result('invalid',issue);
  evidence.push({kind:'reviewed-focus'});return result('resolved',null,{focus:copy(reviewedFocus)});
 }
 if(!Array.isArray(approvedAliases)||!approvedAliases.every(text))return result('invalid','Approved aliases must be nonempty strings');
 let rows=formIndex?.lexemes?.get(key(lemma))||[],bound=false;
 const entryPos=posKey(entry.partOfSpeech);
 if(sourceBinding!==undefined){
  if(!sourceBinding||!text(sourceBinding.sourcePath)||!Number.isSafeInteger(sourceBinding.sourceLine)||
    !/^[a-f0-9]{64}$/u.test(sourceBinding.rawLineSha256||''))return result('invalid','Incomplete reviewed source-row binding');
  if(sourceBinding.senseIndex!==undefined&&(!Number.isSafeInteger(sourceBinding.senseIndex)||sourceBinding.senseIndex<0)){
   return result('invalid','Reviewed source sense index must be a nonnegative integer');
  }
  if(entryPos==='expression'&&!text(sourceBinding.partOfSpeech))return result('invalid','Expression binding requires a reviewed dictionary partOfSpeech');
  const wantedPos=entryPos==='expression'?posKey(sourceBinding.partOfSpeech):entryPos;
  rows=rows.filter(row=>sourceKey(row.source)===sourceKey(sourceBinding)&&posKey(row.partOfSpeech)===wantedPos&&
   (!sourceBinding.partOfSpeech||posKey(sourceBinding.partOfSpeech)===posKey(row.partOfSpeech)));
  if(rows.length!==1)return result('invalid','Reviewed source-row binding does not identify this headword/POS');
  bound=true;
 }else rows=rows.filter(row=>posKey(row.partOfSpeech)===entryPos);
 const prepared=prepareSentence(sentence);
 addCandidates(candidates,prepared,lemma,{kind:'lemma',form:lemma});
 for(const alias of approvedAliases)addCandidates(candidates,prepared,alias,{kind:'approved-search-alias',form:alias});
 const sets=rows.map(row=>JSON.stringify([...new Set(row.forms.map(form=>key(form.form)))].sort()));
 const conflicting=new Set(sets).size>1;
 const proof=rows.map(row=>({source:copy(row.source),partOfSpeech:row.partOfSpeech,
  forms:copy(row.forms),rejectedForms:copy(row.rejectedForms)}));
 if(conflicting){
  evidence.push({kind:'conflicting-source-paradigms',rows:proof});
  if(!candidates.size){
   for(const row of rows)for(const form of row.forms)addCandidates(candidates,prepared,form.form,
    {kind:'unbound-source-form',form:copy(form),source:copy(row.source)});
   return result(candidates.size?'ambiguous':'missing',candidates.size?'Source lexeme requires a reviewed row binding':'No verified occurrence');
  }
 }else{
  for(const row of rows)for(const form of row.forms)addCandidates(candidates,prepared,form.form,
   {kind:'verified-source-form',form:copy(form),source:copy(row.source),bound,
    ...(bound?{reviewedSourceBinding:copy(sourceBinding)}:{})});
 }
 if(candidates.size===1){
  const candidate=[...candidates.values()][0];evidence.push(...candidate.evidence);
  return result('resolved',null,{focus:copy(candidate.focus)});
 }
 if(candidates.size>1)return result('ambiguous','Multiple verified occurrences require a reviewed focus');
 if(rows.length)evidence.push({kind:'source-paradigms',rows:proof});
 return result('missing','No verified occurrence');
}
