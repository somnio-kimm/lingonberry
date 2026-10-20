import {STUDY_TOPICS} from '../../web/js/shared/study-topics.js';
const topicPatterns={
 education:/\b(school|student|teacher|tuition|curriculum|education|university|lesson|learn|classroom)\b|교육|교수 학습/i,
 research:/\b(research|hypothesis|experiment|evidence|methodology|survey|analysis|data|statistics)\b|연구|과학/i,
 environment:/\b(climate|pollution|environment|recycle|ecosystem|wildlife|biodiversity|conservation)\b|환경|기상|기후/i,
 health:/\b(hospital|medical|doctor|patient|health|medicine|disease|symptom|treatment)\b|병과 증상|치료|건강/i,
 technology:/\b(computer|software|digital|internet|technology|device|electronic|engineering)\b|컴퓨터|정보 통신/i,
 economy:/\b(economy|economic|finance|money|investment|income|inflation|price|cost|currency|bank)\b|경제 생활/i,
 society:/\b(society|social|community|government|policy|law|justice|population|public)\b|정치와 행정|사회 제도/i,
 work:/\b(workplace|employee|employer|colleague|job|salary|career|office|business|manager|employment)\b|직장|직업/i,
 housing:/\b(housing|rent|landlord|tenant|flat|apartment|accommodation|furniture|household)\b|주생활/i,
 travel:/\b(travel|tourist|ticket|journey|flight|hotel|passport|luggage|reservation|transport|train|bus)\b|여행|교통/i,
 services:/\b(shop|customer|purchase|refund|delivery|appointment|restaurant|meal|food|cooking|payment)\b|식생활|구매/i,
 relationships:/\b(family|friend|parent|relative|marriage|relationship|neighbour|childhood)\b|친족|인간관계/i,
 culture:/\b(culture|art|music|museum|literature|tradition|festival|sport|film)\b|문화|예술|체육/i,
 communication:/\b(language|communication|conversation|letter|message|explanation|statement|discussion)\b|언어 행위|통신 행위/i,
};
export function assignIeltsTopics({word='',meaning='',example='',category=''}){
 const text=[word,meaning,example,category].join(' '),topics=Object.entries(topicPatterns).filter(([,pattern])=>pattern.test(text)).map(([id])=>id);
 const academic=/\b(hypothesis|methodology|empirical|statistical|correlation|research|experiment|substantiate|inference|theorem)\b/i.test(text);
 const general=/\b(landlord|tenant|refund|reservation|passport|luggage|colleague|appointment|salary|customer|workplace|complaint)\b/i.test(text);
 const focus=academic?'academic':general?'general-training':'shared';
 return ['ielts:'+focus,...(topics.length?topics:['general']).filter(id=>STUDY_TOPICS[id]).map(id=>'topic:'+id)];
}
