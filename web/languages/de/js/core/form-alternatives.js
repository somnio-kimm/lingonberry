// Imported dictionary forms can abbreviate a repeated article or auxiliary.
export const formAlternatives=value=>typeof value==='string'?[...new Set(value.split(/\s*\/\s*/u).map(part=>part.trim()).filter(Boolean))]:[];
/** Each complete perfect citation owns its auxiliary; bare participles repeat it. */
export function perfectVerbAlternatives(value){
 if(typeof value!=='string')return [];
 const auxiliaryFor={hat:'haben',ist:'sein'};
 const shared=/^(hat|ist)\s*\/\s*(hat|ist)\s+([^/]+)$/u.exec(value.trim());
 const parts=shared?[shared[1]+' '+shared[3],shared[2]+' '+shared[3]]:formAlternatives(value);
 const rows=[],seen=new Set();let auxiliary;
 for(const part of parts){
  const complete=/^(hat|ist)\s+(.+)$/u.exec(part);
  if(complete)auxiliary=auxiliaryFor[complete[1]];
  const participle=(complete?complete[2]:part).trim();
  if(/^(hat|ist|hatte|war)(?:\s|$)/u.test(participle)){auxiliary=undefined;continue;}
  if(!auxiliary)continue;
  // Space-containing abbreviated phrases need their own explicit citation prefix.
  if(!complete&&/\s/u.test(participle)){auxiliary=undefined;continue;}
  const key=auxiliary+':'+participle;if(seen.has(key))continue;seen.add(key);
  rows.push({auxiliary,participle});
 }
 return rows;
}
const reflexivePronouns={
 accusative:{ich:'mich',du:'dich',er:'sich',wir:'uns',ihr:'euch',sie:'sich'},
 dative:{ich:'mir',du:'dir',er:'sich',wir:'uns',ihr:'euch',sie:'sich'},
};
/** Adapt only a leading subject-reflexive citation, never an embedded/quoted token. */
export function inflectReflexiveComplement(value,person,grammaticalCase){
 if(value==='sich')return null;
 if(!/^sich\s/u.test(value))return value;
 const caseName=({acc:'accusative',dat:'dative'})[grammaticalCase]||grammaticalCase;
 const pronoun=reflexivePronouns[caseName]?.[person];
 return pronoun?value.replace(/^sich/u,pronoun):null;
}
export function deriveInfinitiveAlternatives(word,perfect=perfectVerbAlternatives(word.forms?.perfekt)){
 if(word.infinitive||/^sich\s/u.test(word.lemma))return formAlternatives(word.infinitive||word.lemma);
 if(perfect.some(row=>/^sich\s/u.test(row.participle))){
  // Inferring omitted objects/adverbs would change the construction; require its infinitive.
  if(perfect.some(row=>/^sich\s/u.test(row.participle)&&!/^sich\s+\S+$/u.test(row.participle)))return [];
  return [...new Set(perfect.map(row=>(/^sich\s/u.test(row.participle)?'sich ':'')+word.lemma))];
 }
 return [word.reflexive===true?'sich '+word.lemma:word.lemma];
}
export function nounPhraseAlternatives(value){
 const parts=formAlternatives(value),article=/^(der|die|das|den|dem|des) /u.exec(parts[0]||'')?.[1];
 if(!article)return [];
 return parts.map(part=>/^(der|die|das|den|dem|des) /u.test(part)?part:article+' '+part);
}
export function finiteVerbAlternatives(value,word){
 const parts=formAlternatives(value);
 // The exercise gives the person as a main-clause prompt. Joined subordinate
 // forms ("abbiege") must not be offered alongside "biege ab" in that prompt.
 const prefix=word.separable_prefix;
 return prefix&&parts.some(part=>part.endsWith(' '+prefix))?parts.filter(part=>part.endsWith(' '+prefix)):parts;
}
