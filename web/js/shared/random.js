/** Nonmutating Fisher–Yates shuffle. Inject randomness for reproducible tests. */
export function shuffle(values,random=Math.random) {
 const result=[...values];
 for(let index=result.length-1;index>0;index--){
  const other=Math.floor(random()*(index+1));
  [result[index],result[other]]=[result[other],result[index]];
 }
 return result;
}
export const pick=(values,random=Math.random)=>values[Math.floor(random()*values.length)];
