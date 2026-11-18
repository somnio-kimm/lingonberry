// Small, closed morphology tables for matching a translated gloss, not translating text.
const englishIrregular={be:['am','is','are','was','were','been','being'],have:['has','had','having'],do:['does','did','done','doing'],go:['goes','went','gone','going'],come:['came','coming'],get:['got','gotten','getting'],make:['made','making'],take:['took','taken','taking'],give:['gave','given','giving'],eat:['ate','eaten','eating'],drink:['drank','drunk'],write:['wrote','written','writing'],read:['reads','reading'],see:['saw','seen','seeing'],know:['knew','known'],find:['found'],think:['thought'],buy:['bought'],bring:['brought'],run:['ran','running'],speak:['spoke','spoken'],say:['said'],leave:['left','leaving'],feel:['felt'],hear:['heard'],stand:['stood'],sit:['sat','sitting'],begin:['began','begun','beginning'],put:['putting']};
const englishNouns={person:['people'],man:['men'],woman:['women'],child:['children'],foot:['feet'],tooth:['teeth'],mouse:['mice'],goose:['geese']};
const koreanAdjectives={'예쁜':'예쁘다','아름다운':'아름답다','큰':'크다','작은':'작다','좋은':'좋다','나쁜':'나쁘다','새로운':'새롭다','오래된':'오래되다','어려운':'어렵다','쉬운':'쉽다','무거운':'무겁다','가벼운':'가볍다','추운':'춥다','더운':'덥다','빠른':'빠르다','느린':'느리다','많은':'많다','적은':'적다','긴':'길다','짧은':'짧다'};
const koreanBStems=new Set(['아름답','새롭','어렵','쉽','무겁','가볍','춥','덥','귀엽','고맙','맵','즐겁','부드럽','차갑','뜨겁','두렵','더럽','부럽','괴롭']);
const koreanShortForms={하:['해','했','합','한','할','함'],되:['돼','됐','됩','된','될','됨'],가:['갔','간','갈','갑'],오:['와','왔','온','올','옵'],보:['봐','봤','본','볼','봅'],주:['줘','줬','준','줄','줍'],두:['둬','뒀','둔','둘','둡'],쓰:['써','썼','쓴','쓸','씁'],크:['커','컸','큰','클','큽']};
export const koreanParticles=/^(?:(?:은|는|이|가|을|를|의|에|에서|에게|에게서|한테|께|로|으로|와|과|도|만|부터|까지|보다|처럼|이라고|라고|이라는|라는|이라며|라며|이나|나|이며|이고|이다|입니다|이었다|였다)){0,3}$/u;
const ambiguousShortTokens=new Set(['가게','돼지','자기','사고','보고','보고서','해고','간','본','줄','감','갑','가는','나는','오는','보는','보기','하기','사는','주는','되는']);
const koreanEndings=new Set(('다 요 고 고요 고서 는 은 을 던 지 지요 지만 지도 지는 기 기를 기가 기는 기도 기로 기에 기만 게 도록 면 면서 며 니 니까 려고 러 세요 십시오 습니다 습니까 니다 는다 는지 은지 을지 는데 는군요 는구나 네요 나요 죠 자 자고 라 라고 다고 다는 다며 듯 더니 더라 더라고요 더군요 더라도 더라면 으면 으면서 으니 으니까 으려고 으러 으세요 으십시오 으셨다 으셨어요 시는 신 실 셨다 셨어요').split(' '));
for(const prefix of ['었','았','였','겠'])for(const ending of ['다','어요','나요','고','지만','던','는지','습니다','습니까','다고','다는','다며','대요','는데','으니'])koreanEndings.add(prefix+ending);
for(const prefix of ['어','아','여'])for(const ending of ['','요','서','야','도','라','야지','야만','야겠다','야겠어요','주세요','줘','준다'])koreanEndings.add(prefix+ending);
export function acceptsKoreanPredicateSuffix(prefix,suffix,token,form={}){
 if([...ambiguousShortTokens].some(base=>token.startsWith(base)&&koreanParticles.test(token.slice(base.length))))return false;
 // A bare single syllable can be an unrelated noun/interjection (해, 한, 함, 와...).
 if(!suffix)return !!form.allowBare&&prefix.replace(/\s/gu,'').length>1;
 if(form.kind==='root'&&suffix==='요'){const code=prefix.at(-1).charCodeAt(0)-0xac00,vowel=Math.floor(code/28)%21;if(code<0||code>=11172||code%28!==0||![0,1,4,5].includes(vowel))return false;}
 if(form.kind==='declarative')return ['니다','니까'].includes(suffix);
 if(form.kind==='attributive')return ['다','다고','다는','다며','다면서','대요','단다'].includes(suffix);
 if(form.kind==='future')return ['지','까','게','걸','듯'].includes(suffix);
 if(form.kind==='nominal')return prefix.replace(/\s/gu,'').length>1&&koreanParticles.test(suffix);
 if(form.kind==='present'){
  if(suffix==='도'&&prefix.replace(/\s/gu,'').length===1)return false;
  return ['요','서','야','도','라','야지','야만','야겠다','야겠어요','주세요','줘','준다','주다','주었다','주고','주면'].includes(suffix);
 }
 return koreanEndings.has(suffix);
}
function readEnglishPlural(word){return /[^aeiou]y$/u.test(word)?word.slice(0,-1)+'ies':/(?:s|x|z|ch|sh)$/u.test(word)?word+'es':word+'s';}
export function collectEnglishTranslationForms(term,pos){
 const words=term.split(/\s+/u),head=words[0].toLowerCase(),tail=words.slice(1).join(' '),forms=new Set([head]);
 if(/verb|^v$/u.test(pos)){
  for(const value of englishIrregular[head]||[])forms.add(value);
  forms.add(readEnglishPlural(head));forms.add(/[^aeiou]y$/u.test(head)?head.slice(0,-1)+'ied':head+(head.endsWith('e')?'d':'ed'));
  const doubled=/^[^aeiou]*[aeiou][^aeiouwxy]$/u.test(head)?head+head.at(-1):head;
  forms.add(head.endsWith('e')&&!head.endsWith('ee')?head.slice(0,-1)+'ing':doubled+'ing');
  if(doubled!==head)forms.add(doubled+'ed');
 }else if(/noun|^n$/u.test(pos)&&words.length===1){forms.add(readEnglishPlural(head));for(const value of englishNouns[head]||[])forms.add(value);}
 else if(/adjective|^a$/u.test(pos)&&words.length===1){
  const special={good:['better','best'],bad:['worse','worst'],far:['farther','further','farthest','furthest']};for(const value of special[head]||[])forms.add(value);
  if(head.length<=7){forms.add(head.endsWith('y')?head.slice(0,-1)+'ier':head+(head.endsWith('e')?'r':'er'));forms.add(head.endsWith('y')?head.slice(0,-1)+'iest':head+(head.endsWith('e')?'st':'est'));}
 }
 return [...forms].map(form=>tail?form+' '+tail:form);
}
export function collectKoreanTranslationForms(term,pos){
 const forms=[{text:term,predicate:false}];if(!/verb|adjective|^v$|^a$/u.test(pos))return forms;
 let dictionary=koreanAdjectives[term]||term;
 if(dictionary.endsWith('한'))dictionary=dictionary.slice(0,-1)+'하다';
 else if(dictionary.endsWith('하는'))dictionary=dictionary.slice(0,-2)+'하다';
 if(dictionary.endsWith('의'))forms.push({text:dictionary.slice(0,-1),predicate:false});
 if(!dictionary.endsWith('다'))return forms;
 const stem=dictionary.slice(0,-1);if(!stem||stem.length>60)return forms;
 const stems=new Map([[stem,'root']]),bareForms=new Set(),last=stem.at(-1),prefix=stem.slice(0,-1);
 const kinds=['하','되'].includes(last)?['present','past','declarative','attributive','future','nominal']:last==='가'?['past','attributive','future','declarative']:['present','past','attributive','future','declarative'];
 for(const [index,ending]of (koreanShortForms[last]||[]).entries()){stems.set(prefix+ending,kinds[index]);if(['present','attributive','future','nominal'].includes(kinds[index]))bareForms.add(prefix+ending);}
 const code=last.charCodeAt(0)-0xac00,jong=code%28,vowel=Math.floor(code/28)%21;
 if(code>=0&&code<11172&&jong===0&&[0,4,6].includes(vowel))stems.set(prefix+String.fromCharCode(last.charCodeAt(0)+20),'past');
 // Regular vowel contractions are restricted to multi-syllable stems.
 if(stem.replace(/\s/gu,'').length>=2&&code>=0&&code<11172&&jong===0&&[20,13].includes(vowel)){
  const contracted=String.fromCharCode(last.charCodeAt(0)+(vowel===20?-14:1)*28);stems.set(prefix+contracted,'present');bareForms.add(prefix+contracted);stems.set(prefix+String.fromCharCode(contracted.charCodeAt(0)+20),'past');
 }
 if(koreanBStems.has(stem)&&jong===17){const base=prefix+String.fromCharCode(last.charCodeAt(0)-17);for(const ending of ['워','웠','운']){stems.set(base+ending,ending==='웠'?'past':ending==='운'?'attributive':'present');if(ending!=='웠')bareForms.add(base+ending);}}
 for(const [text,kind]of stems)forms.push({text,predicate:true,allowBare:bareForms.has(text),kind});return forms;
}
