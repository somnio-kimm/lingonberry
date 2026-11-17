const CANDIDATE_LIMIT=64,MAX_DISTRACTORS=3,LENGTH_RATIO=1.8;

/** Visible wording is compared without rewriting any dictionary definition. */
export const readChoiceOpening=text=>text.normalize('NFKC').match(/[\p{L}\p{N}]+/u)?.[0].toLowerCase()||'';
export const readChoiceInitial=text=>text.normalize('NFKC').match(/[\p{L}\p{N}]/u)?.[0].toLowerCase()||'';

function sampleCandidates(rows,correct,blocked,random){
 const swaps=new Map(),candidates=[],spellings=new Set(correct.spellingKeys);let remaining=rows.length;
 // Lazy Fisher–Yates: independent positions without copying or shuffling the whole pool.
 while(remaining&&candidates.length<CANDIDATE_LIMIT){
  const pick=Math.floor(random()*remaining),index=swaps.get(pick)??pick,last=remaining-1;
  swaps.set(pick,swaps.get(last)??last);swaps.delete(last);remaining--;
  const other=rows[index];
  if(other.spellingKeys.some(key=>spellings.has(key))||other.choiceKeys.some(key=>blocked.has(key)))continue;
  candidates.push(other);
 }
 return candidates;
}
function hasBalancedStarts(rows){
 return ['choiceInitial','choiceOpening'].every(key=>{
  const counts=new Map();for(const row of rows)counts.set(row[key],(counts.get(row[key])||0)+1);
  return counts.size===1||Math.max(...counts.values())<=Math.floor(rows.length/2);
 });
}
function pickCandidates(candidates,correct,blocked,style){
 const picked=[],keys=new Set(blocked),spellings=new Set(correct.spellingKeys),initials=new Map([[correct.choiceInitial,1]]);
 const ordered=style==='same'?[...candidates.filter(row=>row.choiceOpening===correct.choiceOpening),...candidates.filter(row=>row.choiceOpening!==correct.choiceOpening)]:candidates;
 for(const other of ordered){
  const count=initials.get(other.choiceInitial)||0;
  if(style==='same'&&other.choiceInitial!==correct.choiceInitial||style==='distinct'&&count||style==='mixed'&&count>=2)continue;
  if(other.choiceKeys.some(key=>keys.has(key))||other.spellingKeys.some(key=>spellings.has(key)))continue;
  picked.push(other);for(const key of other.choiceKeys)keys.add(key);for(const key of other.spellingKeys)spellings.add(key);initials.set(other.choiceInitial,count+1);
  if(picked.length===MAX_DISTRACTORS)break;
 }
 while(picked.length&&!hasBalancedStarts([correct,...picked]))picked.pop();
 return picked;
}
/** Prefer similar-length definitions and avoid a single starting-letter outlier. */
export function chooseMeaningDistractors(rows,{correct,blocked,random}){
 const readLengthDistance=row=>Math.abs(Math.log((row.text.length+8)/(correct.text.length+8)));
 const candidates=sampleCandidates(rows,correct,blocked,random).sort((a,b)=>readLengthDistance(a)-readLengthDistance(b));
 const comparable=candidates.filter(row=>readLengthDistance(row)<=Math.log(LENGTH_RATIO));let best=[];
 for(const pool of [comparable,candidates])for(const style of ['same','distinct','mixed']){
  const picked=pickCandidates(pool,correct,blocked,style);
  if(picked.length===MAX_DISTRACTORS)return picked;
  if(picked.length>best.length)best=picked;
 }
 return best;
}
