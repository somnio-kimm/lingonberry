/** Simple origin labels used by the explicitly curated family questions. */
const origins={la:['Latin','라틴어'],grc:['Greek','그리스어'],ang:['Old English','고대 영어']};
export const learnerOriginLabel=(code,locale='en')=>(origins[code]?.[locale==='ko'?1:0]||code||'');
/** The generated root cue has a labelled origin prefix; its meanings remain explanation content. */
export function localizeRootPromptOrigin(prompt,locale){
 for(const [code,labels]of Object.entries(origins))for(const label of labels){
  if(prompt.startsWith(label+' · '))return learnerOriginLabel(code,locale)+prompt.slice(label.length);
 }
 return prompt;
}
