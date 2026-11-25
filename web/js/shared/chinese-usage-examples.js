// Map known usages to exact sentences already in the installed dictionary.
// Missing or changed source sentences are never paired with a different usage.
const usageRows=new Map([
 ['hsk1_56',[
  ['classifier','minute','분','现在是八点十分。'],
  ['classifier','mark, point','점','这道题值十分。'],
  ['classifier','fen','펀','这张旧邮票的面值是八分。'],
  ['verb','to divide','나누다','我们把蛋糕分成了四块。'],
  ['verb','to distribute','분배하다','老师把书分给了同学们。'],
  ['noun','score','점수','她的分比我高。'],
 ]],
 ['hsk1_34',[
  ['classifier',"o'clock",'시','现在是三点。'],
  ['noun','point, dot','점, 지점','她在地图上画了一个红点，标出车站的位置。'],
 ]],
 ['hsk2_2026_336',[
  ['verb','to order','주문하다','我们点了两碗面。'],
  ['noun','point, spot','점, 지점','这个点离入口很近，我们就在这里见面吧。'],
  ['verb','to click','클릭하다','请点屏幕上的蓝色按钮。'],
  ['verb','to light','불을 붙이다','她点了一根蜡烛，房间亮了起来。'],
  ['classifier','unit for items or points','사항을 세는 단위','我想补充两点意见。'],
  ['classifier','small amount','조금','汤里再放点盐就好了。'],
 ]],
]);

export function selectChineseUsageExamples(word,examples){
 const usages=usageRows.get(word.id);
 if(!usages||!word.studyExplanationLanguage)return [];
 const examplesByText=new Map(examples.map(example=>[example.text,example]));
 return usages.flatMap(([partOfSpeech,en,ko,text])=>{
  const example=examplesByText.get(text);
  return example?[{word:{...word,partOfSpeech,studyMeaning:word.studyExplanationLanguage==='ko'?ko:en},example}]:[];
 });
}

export function chineseUsageParts(word){return [...new Set((usageRows.get(word.id)||[]).map(([pos])=>pos))];}
