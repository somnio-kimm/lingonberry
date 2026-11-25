import {escapeHtml} from './ui.js';

const parenthetical=/\([^()（）]*\)|（[^()（）]*）/gu;
const sourceNote=/\bHSK\s*\d|추가 사전 용법|additional dictionary use/iu;
const squash=text=>text.trim().replace(/^[,，]+\s*|\s*[,，]+$/gu,'').replace(/[^\S\r\n]+/gu,' ').replace(/\s+([,.!?。！？])/gu,'$1');

// Confirmed senses in packaged entries that otherwise use the same separator
// for alternatives and distinct meanings. Exact wording guards future edits.
const reviewedGroups=new Map([
 ['hsk1_98', {
  'to open; to turn on':'to open\nto turn on',
  '열다; 켜다':'열다\n켜다',
 }],
 ['hsk2_26', {
  'hit; make (a phone call); play (a ball sport)':'hit\nmake (a phone call)\nplay (a ball sport)',
  '치다; (전화를) 걸다; (구기 운동을) 하다':'치다\n(전화를) 걸다\n(구기 운동을) 하다',
 }],
 ['hsk2_2026_336', {
  'to order; to click; to light (verb, HSK 2); point; spot (additional dictionary use); small amount; unit for items or points (classifier, HSK 4)':'to order\nto click\nto light\npoint; spot\nsmall amount\nunit for items or points',
  '주문하다; 클릭하다; 불을 붙이다 (동사, HSK 2); 점; 지점 (추가 사전 용법); 조금; 사항을 세는 단위 (양사, HSK 4)':'주문하다\n클릭하다\n불을 붙이다\n점; 지점\n조금\n사항을 세는 단위',
 }],
 ['hsk1_83', {
  'can; know how to; will':'can; know how to\nwill',
  '할 줄 알다; ~할 것이다':'할 줄 알다\n~할 것이다',
 }],
 ['hsk2_2026_358', {
  'flower (noun, HSK 2); patterned; multicoloured; blurred (vision) (adjective, HSK 6)':'flower\npatterned; multicoloured\nblurred (vision)',
  '꽃 (명사, HSK 2); 무늬가 있는; 알록달록한; 침침한(시야) (형용사, HSK 6)':'꽃\n무늬가 있는; 알록달록한\n침침한(시야)',
 }],
 ['hsk3_263', {
  'clear; to understand':'clear\nto understand',
  '명확하다; 이해하다':'명확하다\n이해하다',
 }],
 ['hsk3_398', {
  'to go; acceptable; capable':'to go\nacceptable; capable',
  '괜찮다; 가능하다; 가다':'괜찮다; 가능하다\n가다',
 }],
 ['hsk3_2026_968', {
  'to grow; suffix meaning head or chief':'to grow\nsuffix meaning head or chief',
  '자라다; 성장하다; 장, 우두머리를 나타내는 접미사':'자라다; 성장하다\n장, 우두머리를 나타내는 접미사',
 }],
 ['hsk4_131', {
  'to work as or serve as; when or during':'to work as or serve as\nwhen or during',
  '~이 되다, ~을 맡다; ~할 때':'~이 되다, ~을 맡다\n~할 때',
 }],
 ['hsk5_2026_2250', {
  'to regard as; to treat as; to pawn':'to regard as; to treat as\nto pawn',
  '~로 여기다; ~로 대하다; 저당 잡히다':'~로 여기다; ~로 대하다\n저당 잡히다',
 }],
 ['hsk5_2026_2467', {
  'line; row; trade; profession; classifier for lines':'line; row\ntrade; profession\nclassifier for lines',
  '줄; 행; 업종; 글의 줄을 세는 단위':'줄; 행\n업종\n글의 줄을 세는 단위',
 }],
 ['de-ref-4d8abfbdfa37ecd7e1ee', {
  'sweet chestnut; bay bolete (colloquial mushroom name)':'sweet chestnut\nbay bolete (colloquial mushroom name)',
  '식용 밤; 갈색그물버섯(구어)':'식용 밤\n갈색그물버섯(구어)',
 }],
 ['de-ref-5895840824bcbc40f89b', {
  'counter; switch':'counter\nswitch',
  '창구; 스위치':'창구\n스위치',
 }],
 ['de-adjective-leicht-editorial-main', {
  'light in weight; easy':'light in weight\neasy',
  '가벼운; 쉬운':'가벼운\n쉬운',
 }],
]);

function projectGloss(gloss,includeContext){
 let previous;
 do{
  previous=gloss;
  gloss=gloss.replace(parenthetical,note=>{
   if(sourceNote.test(note))return '\n';
   if(!includeContext)return '';
   const content=note.slice(1,-1);
   return ' '+content+' ';
  });
 }while(gloss!==previous);
 return gloss.split(/[\r\n]+/u).map(line=>[...new Set(line.split(/[;；]+/u).map(squash).filter(Boolean))].join(', ')).filter(Boolean);
}

/** Arrays and newlines are explicit sense boundaries; semicolons alone are not. */
export function meaningDisplayLines(value,word,{includeContext=false}={}){
 if(word?.senses?.length>1&&value===word.studyMeaning){
  return [...new Set(word.senses.flatMap(sense=>meaningDisplayLines(sense.studyMeaning,sense,{includeContext})))];
 }
 const glosses=Array.isArray(value)?value:[value];
 return [...new Set(glosses.flatMap(gloss=>{
  if(typeof gloss!=='string')return [];
  const reviewed=reviewedGroups.get(word?.id);
  return projectGloss(reviewed&&Object.hasOwn(reviewed,gloss)?reviewed[gloss]:gloss,includeContext);
 }))];
}

export function renderStudyMeaning(value,word){
 return meaningDisplayLines(value,word).map(escapeHtml).join('<br>');
}

export function renderQuizMeaning(value,word){
 const lines=meaningDisplayLines(value,word,{includeContext:true});
 return lines.length?lines.map(escapeHtml).join('<br>'):escapeHtml(value);
}

/** Fall back to original labels if a historical choice set would become ambiguous. */
export function renderQuizMeaningChoices(options){
 const labels=options.map(option=>renderQuizMeaning(option.text,option));
 const distinct=new Set(labels.map(label=>squash(label.replaceAll('<br>',' ')).normalize('NFKC').toLowerCase()));
 return distinct.size===labels.length?labels:options.map(option=>escapeHtml(option.text));
}
