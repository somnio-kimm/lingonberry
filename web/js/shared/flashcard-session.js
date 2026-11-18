export const FLASHCARD_SET_SIZES=Object.freeze([10,20,50,100]);
const sizeKey='learn-language.flashcards.setSize.v1';
export function normaliseFlashcardSetSize(value){const size=Number(value);return FLASHCARD_SET_SIZES.includes(size)?size:20;}
export function readFlashcardSetSize(storage=globalThis.localStorage){try{return normaliseFlashcardSetSize(JSON.parse(storage?.getItem(sizeKey)||'20'));}catch{return 20;}}
export function saveFlashcardSetSize(value,storage=globalThis.localStorage){const size=normaliseFlashcardSetSize(value);try{storage?.setItem(sizeKey,JSON.stringify(size));}catch{}return size;}

function collectUniqueFlashcards(words,readIdentity){return [...new Map(words.map(word=>[readIdentity(word),word])).values()];}
function sampleFlashcards(words,count,random){
 const candidates=[...words],selected=[];
 for(let i=0;i<Math.min(count,candidates.length);i++){const at=i+Math.floor(random()*(candidates.length-i));[candidates[i],candidates[at]]=[candidates[at],candidates[i]];selected.push(candidates[i]);}
 return selected;
}
/** One fixed round; progress writes remain in each language's existing store. */
export function createFlashcardSession({readStatus=()=> 'new',readIdentity=word=>word.id,random=Math.random}={}){
 let cards=[],index=0,phase='empty',grades=new Map(),limit=20,isPreviewing=false,isRepeatRound=false;const seen=new Set();
 function begin(pool,{size=20,resetSeen=false}={}){
  if(resetSeen)seen.clear();const unique=collectUniqueFlashcards(pool,readIdentity);
  let fresh=unique.filter(word=>!seen.has(readIdentity(word)));if(!fresh.length){seen.clear();fresh=unique;}
  cards=[];limit=normaliseFlashcardSetSize(size);
  for(const status of ['learning','new','mastered']){
   const group=fresh.filter(word=>(readStatus(word)||'new')===status);cards.push(...sampleFlashcards(group,limit-cards.length,random));if(cards.length===limit)break;
  }
  cards.forEach(word=>seen.add(readIdentity(word)));index=0;grades=new Map();isPreviewing=false;isRepeatRound=false;phase=cards.length?'studying':'empty';
 }
 function mark(status){
  if(!['learning','mastered'].includes(status))throw new Error('Invalid flashcard classification');if(phase!=='studying')return;
  isPreviewing=false;grades.set(readIdentity(cards[index]),status);if(grades.size===cards.length){phase='complete';return;}
  for(let step=1;step<=cards.length;step++){const next=(index+step)%cards.length;if(!grades.has(readIdentity(cards[next]))){index=next;return;}}
 }
 function move(direction){if(!cards.length)return;if(phase==='complete'){phase='studying';isPreviewing=true;return;}phase='studying';index=(index+(direction<0?-1:1)+cards.length)%cards.length;}
 function reconcile(pool){
  pool=collectUniqueFlashcards(pool,readIdentity);
  if(phase==='empty'&&pool.length){begin(pool,{size:limit});return;}if(phase!=='studying')return;const currentId=cards[index]?readIdentity(cards[index]):null,available=new Map(pool.map(word=>[readIdentity(word),word]));
  let gradedCurrent=false;
  if(isRepeatRound)for(const word of cards)if(readStatus(word)==='mastered'&&!grades.has(readIdentity(word))){grades.set(readIdentity(word),'mastered');if(readIdentity(word)===currentId)gradedCurrent=true;}
  cards=cards.filter(word=>grades.has(readIdentity(word))||available.has(readIdentity(word))).map(word=>available.get(readIdentity(word))||word);
  const fresh=isPreviewing||isRepeatRound?[]:pool.filter(word=>!seen.has(readIdentity(word)));
  for(const status of ['learning','new','mastered']){const added=sampleFlashcards(fresh.filter(word=>(readStatus(word)||'new')===status),limit-cards.length,random);cards.push(...added);added.forEach(word=>seen.add(readIdentity(word)));if(cards.length===limit)break;}
  const currentIndex=cards.findIndex(word=>readIdentity(word)===currentId);index=currentIndex>=0&&!gradedCurrent?currentIndex:Math.max(0,cards.findIndex(word=>!grades.has(readIdentity(word))));if(!cards.length)phase='empty';else if(grades.size===cards.length&&!isPreviewing)phase='complete';
 }
 function reviewLearning(){const unfinished=cards.filter(word=>readStatus(word)!=='mastered');if(!unfinished.length)return false;isRepeatRound=true;limit=unfinished.length;cards=sampleFlashcards(unfinished,unfinished.length,random);grades=new Map();index=0;isPreviewing=false;phase='studying';return true;}
 return {begin,mark,move,reconcile,reviewLearning,get current(){return phase==='studying'?cards[index]:undefined;},get cards(){return cards.slice();},get index(){return index;},get total(){return cards.length;},get phase(){return phase;},get completed(){return grades.size;},get summary(){return {total:cards.length,learning:[...grades.values()].filter(value=>value==='learning').length,mastered:[...grades.values()].filter(value=>value==='mastered').length};},get learningCount(){return cards.filter(word=>readStatus(word)!=='mastered').length;}};
}
