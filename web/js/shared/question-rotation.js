/** A content-keyed round: each eligible question appears once before any repeat. */
export function createQuestionRotation(rows,{key=row=>row.id}={}){
 const groups=new Map();
 for(const row of rows){const id=key(row);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
 const all=[...groups.keys()];let remaining=[],lastKey;
 return {get size(){return all.length;},choose(previousId,random=Math.random,build=row=>row){
  if(!remaining.length)remaining=all.slice();
  // At a round boundary prefer another question, including a different snapshot ID.
  const candidates=remaining.filter(id=>id!==lastKey&&!groups.get(id).some(row=>row.id===previousId));
  const order=candidates.length?candidates:remaining.slice();
  while(order.length){
   const index=Math.min(order.length-1,Math.max(0,Math.floor(random()*order.length))),id=order.splice(index,1)[0];remaining.splice(remaining.indexOf(id),1);
   for(const row of groups.get(id)){const question=build(row,random);if(question){lastKey=id;return question;}}
  }
  // A tiny or partially invalid pool may contain only the previous valid item.
  while(remaining.length){const id=remaining.shift();for(const row of groups.get(id)){const question=build(row,random);if(question){lastKey=id;return question;}}}
 }};
}
export const sentenceQuestionKey=(sentence,answer='')=>JSON.stringify([sentence.normalize('NFC').trim().replace(/\s+/gu,' '),answer.normalize('NFC').trim()]);
