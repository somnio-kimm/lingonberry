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
