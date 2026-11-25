// Map known usages to exact sentences already in the installed dictionary.
// Missing or changed source sentences are never paired with a different usage.
const reviewedUsages=new Map([
 ['hsk1_56',{glosses:[
  'minute; point; fen (one hundredth of a yuan) (classifier, HSK 1); to divide; to distribute (verb, HSK 3); part; point (noun, HSK 3)',
  '분; 점; 펀(위안의 100분의 1) (양사, HSK 1); 나누다; 분배하다 (동사, HSK 3); 부분; 점 (명사, HSK 3)',
 ],usages:[
  ['classifier','minute','분','现在是八点十分。'],
  ['classifier','mark, point','점','这道题值十分。'],
  ['classifier','fen','펀','这张旧邮票的面值是八分。'],
  ['verb','to divide','나누다','我们把蛋糕分成了四块。'],
  ['verb','to distribute','분배하다','老师把书分给了同学们。'],
  ['noun','score','점수','她的分比我高。'],
  ['noun','part','부분'],
 ]}],
 ['hsk1_34',{glosses:[
  "o'clock (classifier, HSK 1); point; dot (additional dictionary use)",
  '시(시각 단위) (양사, HSK 1); 점; 지점 (추가 사전 용법)',
 ],usages:[
  ['classifier',"o'clock",'시','现在是三点。'],
  ['noun','point, dot','점, 지점','她在地图上画了一个红点，标出车站的位置。'],
 ]}],
 ['hsk2_2026_336',{glosses:[
  'to order; to click; to light (verb, HSK 2); point; spot (additional dictionary use); small amount; unit for items or points (classifier, HSK 4)',
  '주문하다; 클릭하다; 불을 붙이다 (동사, HSK 2); 점; 지점 (추가 사전 용법); 조금; 사항을 세는 단위 (양사, HSK 4)',
 ],usages:[
  ['verb','to order','주문하다','我们点了两碗面。'],
  ['verb','to click','클릭하다','请点屏幕上的蓝色按钮。'],
  ['verb','to light','불을 붙이다','她点了一根蜡烛，房间亮了起来。'],
  ['noun','point, spot','점, 지점','这个点离入口很近，我们就在这里见面吧。'],
  ['classifier','small amount','조금','汤里再放点盐就好了。'],
  ['classifier','unit for items or points','사항을 세는 단위','我想补充两点意见。'],
 ]}],
]);

export function readChineseUsages(word){
 const reviewed=reviewedUsages.get(word.id);
 const language=word.studyExplanationLanguage;
 if(!reviewed||(language!=='en'&&language!=='ko'))return [];
 const korean=language==='ko';
 if(reviewed.glosses[korean?1:0]!==word.studyMeaning)return [];
 return reviewed.usages.map(([partOfSpeech,en,ko,text])=>({
  word:{...word,partOfSpeech,studyMeaning:korean?ko:en},text,
 }));
}

export function selectChineseUsageExamples(word,examples){
 const usages=readChineseUsages(word);
 if(!usages.length)return [];
 const examplesByText=new Map(examples.map(example=>[example.text,example]));
 return usages.flatMap(({word,text})=>{
  const example=examplesByText.get(text);
  return example?[{word,example}]:[];
 });
}

export function chineseUsageParts(word){return [...new Set(readChineseUsages(word).map(({word:usage})=>usage.partOfSpeech))];}
