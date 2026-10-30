/** Simple origin labels used by the explicitly curated family questions. */
export const learnerOriginLabel=(code,locale='en')=>({la:['Latin','라틴어'],grc:['Greek','그리스어'],ang:['Old English','고대 영어']}[code]?.[locale==='ko'?1:0]||code||'');
