export function scoreRetestResults(results){
 const score={correct:0,incorrect:0,skipped:0,total:0};
 for(const result of results){
  if(!result)continue;
  if(result.skipped)score.skipped++;
  else{
   score[result.correct?'correct':'incorrect']++;
   score.total++;
  }
 }
 return score;
}
