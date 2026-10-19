export const STUDY_TOPICS=Object.freeze({
 general:['General Vocabulary','일반 어휘'],education:['Education','교육'],research:['Research','연구'],environment:['Environment','환경'],health:['Health','건강'],technology:['Technology','기술'],economy:['Economy and Money','경제와 금전'],society:['Society','사회'],work:['Work','직장'],housing:['Housing','주거'],travel:['Travel','여행'],services:['Everyday Services','일상 서비스'],relationships:['Relationships','대인 관계'],culture:['Culture','문화'],communication:['Communication','의사소통'],
});
export function matchesStudyTopic(tags=[],topic='all'){return topic==='all'||tags.includes('topic:'+topic);}
export const studyTopicLabel=(labels,key,locale)=>labels[key]?.[locale==='ko'?1:0]||key;
