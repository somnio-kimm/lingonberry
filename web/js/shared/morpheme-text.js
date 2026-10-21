/** Feature copy and display labels; source meanings arrive in explanation packages. */
const originKo = {
  "Latin": "라틴어",
  "Greek": "그리스어",
  "English": "영어",
  "Middle English": "중세 영어",
  "Old English": "고대 영어",
  "French": "프랑스어",
  "Old French": "고프랑스어",
  "German": "독일어",
  "Sanskrit": "산스크리트어",
  "Italian": "이탈리아어",
  "Japanese": "일본어",
  "Spanish": "스페인어",
  "Hebrew": "히브리어",
  "Chinese": "중국어",
  "Russian": "러시아어",
  "Portuguese": "포르투갈어",
  "Arabic": "아랍어",
  "Korean": "한국어",
  "Old Norse": "고대 노르드어",
  "Dutch": "네덜란드어",
  "New Latin": "신라틴어",
  "Medieval Latin": "중세 라틴어",
  "Late Latin": "후기 라틴어",
  "Latin from Greek": "그리스어에서 유래한 라틴어",
  "Latin from Frankish": "프랑크어에서 유래한 라틴어",
  "Greek from Hebrew": "히브리어에서 유래한 그리스어",
  "Not specified": "출처에 명시되지 않음"
};
export const morphemeOriginLabel=(origin,locale)=>locale==='ko'?(originKo[origin]||(/Latin|Greek/u.test(origin)?'라틴어 / 그리스어':origin)):origin;
const registers = {
 offensive:["Offensive", "모욕적"],
 derogatory:["Derogatory", "비하적"],
 vulgar:["Vulgar", "비속어"],
 obsolete:["Obsolete", "폐어"],
 archaic:["Archaic", "고어"],
 dated:["Dated", "구식"],
 rare:["Rare", "드문 표현"],
 uncommon:["Uncommon", "드문 표현"],
 slang:["Slang", "속어"],
 informal:["Informal", "비격식"],
 nonstandard:["Nonstandard", "비표준"],
 misspelling:["Misspelling", "잘못된 표기"],
 proscribed:["Proscribed", "사용을 피하는 표현"],
 humorous:["Humorous", "익살스러운 표현"],
};

export function morphemeRegisters(tags=[],locale='en') {
 return tags.filter(tag=>registers[tag]).map(tag=>registers[tag][locale==='ko'?1:0]);
}
export function morphemeCountLabel(locale,visible,total) {
 const number=new Intl.NumberFormat(locale==='ko'?'ko-KR':'en-GB');
 const count=number.format(visible),all=number.format(total);
 return locale==='ko'?`${count}개 항목 · 전체 ${all}개`:`${count} Entries · ${all} Total`;
}
export const morphemeRelatedLabel=(locale,count)=>`${locale==='ko'?'관련 단어':'Related Words'} (${count})`;
