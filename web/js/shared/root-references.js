/** Historical source relations are references, never automatic modern word segmentation. */
const languages={ar:['Arabic','아랍어'],egy:['Egyptian','이집트어'],frk:['Frankish','프랑크어'],'gmw-pro':['Proto-West Germanic','서게르만 조어'],'la-lat':['Late Latin','후기 라틴어'],'la-med':['Medieval Latin','중세 라틴어'],'la-vul':['Vulgar Latin','속라틴어'],ota:['Ottoman Turkish','오스만 튀르크어'],xno:['Anglo-Norman','앵글로노르만어'],la:['Latin','라틴어'],grc:['Ancient Greek','고대 그리스어'],fr:['French','프랑스어'],fro:['Old French','고프랑스어'],frm:['Middle French','중세 프랑스어'],en:['English','영어'],ang:['Old English','고대 영어'],enm:['Middle English','중세 영어'],de:['German','독일어'],'gem-pro':['Proto-Germanic','게르만 조어'],'ine-pro':['Proto-Indo-European','인도유럽 조어'],it:['Italian','이탈리아어'],es:['Spanish','스페인어'],nl:['Dutch','네덜란드어'],non:['Old Norse','고대 노르드어']};
export const historicalLanguageLabel=(code,locale)=>languages[code]?.[locale==='ko'?1:0]||code;
export function rootReferenceViews(study,words,locale){
 const byId=new Map(words.map(word=>[word.id,word])),ko=locale==='ko';
 return (study?.practiceData?.rootFamilies||[]).map(family=>({id:family.id,root:family.term,
  meaning:ko?`역사적 공통 출처 · ${historicalLanguageLabel(family.language,locale)}. 현대 단어의 뜻을 단순히 합성하는 규칙은 아닙니다.`:`Shared historical source · ${historicalLanguageLabel(family.language,locale)}. This is not a rule for deriving modern meanings.`,
  members:family.members.filter(member=>byId.has(member.entryId)).map(member=>({entryId:member.entryId,word:byId.get(member.entryId).lemma,note:byId.get(member.entryId).studyMeaning,references:member.references}))}));
}
