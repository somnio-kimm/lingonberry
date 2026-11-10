import {adjectiveEndings,nominalGenders as genders,generateAdjectiveForms as adjectiveForms} from './adjective-forms.js';
export {generateAdjectiveForms as adjectiveForms} from './adjective-forms.js';
import {nounPhraseAlternatives} from './form-alternatives.js';
import { snapshotQuestion } from '../../../../js/shared/question-snapshot.js';
import { NOMINAL_MODES } from './quiz-modes.js';
export { NOMINAL_MODES } from './quiz-modes.js';
export const CASES = ['nom','acc','dat','gen'];
export const caseLabel = value => ({nom:'Nominative',acc:'Accusative',dat:'Dative',gen:'Genitive'}[value]);
export const patternLabel = value => ({strong:'Strong · no article',weak:'Weak · definite article',mixed:'Mixed · ein / kein'}[value]);
export const genderLabel = value => ({masculine:'Masculine',feminine:'Feminine',neuter:'Neuter',plural:'Plural'}[value]);
const capitalize = value => value[0].toLocaleUpperCase('de')+value.slice(1);
const normalize = value => String(value).normalize('NFC').trim().replace(/\s+/gu,' ');
const indefinite = {nom:['ein','eine','ein','keine'],acc:['einen','eine','ein','keine'],dat:['einem','einer','einem','keinen'],gen:['eines','einer','eines','keiner']};
function nounPhrases(noun,grammaticalCase,number,allowBare=false) {
 if(number==='singular'&&noun.number_restriction==='plural'||number==='plural'&&noun.number_restriction==='singular')return [];
 const gender=number==='plural'?'plural':noun.gender;
 const definite={nom:['der','die','das','die'],acc:['den','die','das','die'],dat:['dem','der','dem','den'],gen:['des','der','des','der']};
 const expected=definite[grammaticalCase]?.[genders.indexOf(gender)];
 return nounPhraseAlternatives(noun.declension?.[grammaticalCase]?.[number==='plural'?1:0],{allowBare}).filter(phrase=>!expected||phrase.startsWith(expected+' ')||allowBare&&!/^(der|die|das|den|dem|des) /u.test(phrase));
}
function nounForms(noun,grammaticalCase,number) {
 const phrases=nounPhrases(noun,grammaticalCase,number),phrase=phrases[0];
 if(typeof phrase!=='string'||!phrase.trim()||!['der','die','das','den','dem','des'].includes(phrase.split(' ')[0]))return null;
 const [article,...rest]=phrase.split(' ');return {phrase,phrases,article,noun:rest.join(' ')};
}
const people=new Set(['Mann','Frau','Kind','Lehrer','Lehrerin','Student','Junge','Nachbar','Freund','Freundin','Mensch']);
const frames={nom:plural=>`___ ${plural?'sind':'ist'} wichtig.`,acc:()=> 'Wir denken an ___.',dat:()=> 'Wir sprechen von ___.',gen:()=> 'Wir besprechen die Rolle ___.'};
export function caseQuestions(words) {
 return words.filter(w=>w.pos==='noun').flatMap(word=>['singular','plural'].flatMap(number=>CASES.flatMap(grammaticalCase=>{
  const phrases=nounPhrases(word,grammaticalCase,number,word.article_optional===true),base=nounPhrases(word,'nom',number,word.article_optional===true)[0];
  if(!phrases.length||!base)return [];
  const sentence=grammaticalCase==='dat'&&people.has(word.lemma)?'Ich helfe ___.':frames[grammaticalCase](number==='plural'),answer=grammaticalCase==='nom'?capitalize(phrases[0]):phrases[0];
  return [{mode:'cases',id:word.id+':case:'+grammaticalCase+':'+number,word,case:grammaticalCase,number,base,
   sentence,answer,acceptedAnswers:[...new Set(phrases.flatMap(phrase=>grammaticalCase==='nom'?[capitalize(phrase),phrase]:[phrase]))],example:{de:sentence.replace('___',answer)},
   prompt:'Complete the noun phrase.',explanation:{
    en:({nom:'The subject uses the nominative.',acc:'denken an takes an accusative noun phrase.',dat:sentence.startsWith('Ich helfe')?'helfen takes a dative noun phrase.':'von takes a dative noun phrase.',gen:'The phrase after Rolle expresses whose role and uses the genitive.'}[grammaticalCase])+(word.article_optional===true?'':' Match both the article and noun form.'),
    ko:({nom:'주어는 주격으로 써요.',acc:'denken an 뒤에는 목적격 명사구가 와요.',dat:sentence.startsWith('Ich helfe')?'helfen 뒤에는 여격 명사구가 와요.':'von 뒤에는 여격 명사구가 와요.',gen:'Rolle 뒤에서 누구의 역할인지 나타내는 명사구는 소유격으로 써요.'}[grammaticalCase])+(word.article_optional===true?'':' 관사와 명사의 형태를 함께 맞추세요.')},
  }];
 })));
}

// Original collocation choices for examples without a usable noun in the study dictionary.
const contextGroups = {
 Mensch:['krank','müde','glücklich','nervös','traurig','froh','wütend','ängstlich','mutig','ernst','aktiv','sportlich','souverän','unvoreingenommen','voreingenommen','unabhängig','verantwortlich','zuverlässig','ehrlich','zufrieden','enttäuscht','unsicher','offen','geduldig','höflich','flexibel','freiwillig','stolz','neugierig','aufmerksam','vorsichtig','unvorsichtig','großzügig','sparsam','hilfsbereit','rücksichtsvoll','rücksichtslos','unpünktlich','unfreundlich','hungrig','durstig','satt','ledig','verheiratet','idiosynkratisch','eloquent','wortgewandt','wortkarg','versiert','gewieft','gewissenhaft','skrupellos','unbestechlich'],
 Antwort:['ausführlich','positiv','negativ','emotional','überzeugend','verbindlich','schriftlich','mündlich','üblich','deutlich','seltsam','merkwürdig','peinlich','kohärent','plausibel','implizit','explizit','präzise','unpräzise','schlüssig','unhaltbar','aufschlussreich','irreführend','exemplarisch','lapidar','lakonisch','süffisant','sarkastisch','zynisch','ironisch','pointiert','prägnant','pathetisch','überschwänglich','schwülstig','blumig','salopp','derb','vulgär','gewählt','geschliffen','doppelbödig','hintersinnig'],
 Entscheidung:['angemessen','realistisch','unrealistisch','unvermeidlich','kritisch','vertretbar','nachteilig','vorteilhaft','konsequent','eindeutig','maßgeblich','adäquat','willkürlich','unverhältnismäßig','verhältnismäßig','legitim','illegitim','rechtlich'],
 Ergebnis:['verfügbar','ausreichend','aussagekräftig','haltbar','fundiert','repräsentativ','selektiv','fundamental','marginal','kontingent','inkommensurabel','disparat','heterogen','homogen','zwiespältig'],
 Verfahren:['umweltfreundlich','wirksam','theoretisch','methodisch','heuristisch','teleologisch','empirisch','systematisch','wirtschaftlich','effizient','effektiv'],
 Meinung:['gesellschaftlich','kritikwürdig','widersprüchlich','mehrdeutig','kontrovers','apodiktisch','unerschütterlich','polemisch','diametral'],
 Frage:['interessant','langweilig','epistemisch','dringend','persönlich','beruflich','öffentlich','privat','komplex'],
 Lösung:['einfach','kompliziert','geeignet','praktisch','nachvollziehbar','tragfähig','schlüssig'],
 Regel:['normativ','konstitutiv','unentbehrlich','überflüssig','reichlich'],
 Zusammenhang:['reziprok','diskursiv','paradigmatisch','korrelativ','kausal','immanent'],
 Jacke:['schwer','schädlich'],Zimmer:['ruhig','dunkel'],Buch:['modern','traditionell'],
};
const overrides=new Map(Object.entries(contextGroups).flatMap(([noun,adjectives])=>adjectives.map(a=>[a,noun])));
for(const [adjective,noun] of Object.entries({gut:'Buch',kalt:'Wasser',laut:'Mensch',leise:'Mensch',rot:'Jacke',blau:'Jacke',grün:'Jacke',orange:'Jacke',kurz:'Antwort',eng:'Zimmer',lustig:'Mensch',kostenlos:'Angebot',gewöhnlich:'Mensch',sicher:'Verfahren',gründlich:'Arbeit',wahrscheinlich:'Ergebnis',international:'Studie',wesentlich:'Ergebnis',subjektiv:'Meinung',differenziert:'Antwort',relevant:'Frage',unschlüssig:'Mensch',subtil:'Frage',nuanciert:'Antwort',stringent:'Verfahren',schädlich:'Verfahren',gesellschaftlich:'Zusammenhang',reichlich:'Angebot'}))overrides.set(adjective,noun);
const pairCache=new WeakMap();
function adjectiveContexts(allWords) {
 if(pairCache.has(allWords))return pairCache.get(allWords);
 const nouns=allWords.filter(w=>w.pos==='noun'&&nounForms(w,'nom','singular'));
 const byLemma=new Map(nouns.map(w=>[w.lemma,w])),surfaces=new Map();
 for(const noun of nouns)for(const c of CASES)for(const number of ['singular','plural']){
  const form=nounForms(noun,c,number);if(form&&!surfaces.has(form.noun))surfaces.set(form.noun,noun);
 }
 const pairs=new Map();
 for(const word of allWords.filter(w=>w.pos==='adjective')){
  let noun;
  for(const example of word.examples||[]){
   const forms=new Set([word.lemma,...CASES.flatMap(c=>genders.flatMap(g=>['strong','weak','mixed'].flatMap(p=>adjectiveForms(word.lemma,c,g,p))))]);
   const tokens=example.de.match(/[\p{L}\p{M}-]+/gu)||[];
   const adjectiveIndex=tokens.findIndex(token=>forms.has(token.toLowerCase()));
   // An immediately following noun is an existing attributive collocation.
   if(adjectiveIndex>=0&&surfaces.has(tokens[adjectiveIndex+1]))noun=surfaces.get(tokens[adjectiveIndex+1]);
   if(!noun){const verbIndex=tokens.findIndex(t=>['ist','sind','war','waren','wirkt','bleibt','kommt','hat'].includes(t));if(verbIndex>0)noun=tokens.slice(0,verbIndex).map(t=>surfaces.get(t)).find(Boolean);}
   if(noun)break;
  }
  noun||=byLemma.get(overrides.get(word.lemma));
  if(noun)pairs.set(word.id,noun);
 }
 pairCache.set(allWords,pairs);return pairs;
}
export function adjectiveQuestions(words,allWords=words) {
 const pairs=adjectiveContexts(allWords);
 return words.filter(w=>w.pos==='adjective'&&!w.predicative_only&&w.lemma!=='allein').flatMap(word=>{
  const noun=pairs.get(word.id);if(!noun)return [];
  return ['singular','plural'].flatMap(number=>CASES.flatMap(grammaticalCase=>['strong','weak','mixed'].flatMap(pattern=>{
   const form=nounForms(noun,grammaticalCase,number);if(!form)return [];
   const gender=number==='plural'?'plural':noun.gender,acceptedAnswers=adjectiveForms(word.lemma,grammaticalCase,gender,pattern);if(!acceptedAnswers.length)return [];
   let article=pattern==='weak'?form.article:pattern==='mixed'?indefinite[grammaticalCase][genders.indexOf(gender)]:'';
   if(pattern==='mixed'&&noun.number_restriction==='singular')article='k'+article; // kein/keine/einem -> keinem for singular mass contexts
   const sentence=[article,'___',form.noun].filter(Boolean).join(' '),answer=acceptedAnswers[0];
   const ending=['rosa','lila'].includes(word.lemma)?'':adjectiveEndings[pattern][grammaticalCase][genders.indexOf(gender)];
   return [{mode:'adjendings',id:word.id+':ending:'+noun.id+':'+grammaticalCase+':'+number+':'+pattern,word,
    noun:{id:noun.id,lemma:noun.lemma,article:noun.article,gender:noun.gender,meaning_en:noun.meaning_en,meaning_ko:noun.meaning_ko},case:grammaticalCase,number,gender,pattern,
    base:word.lemma,sentence,answer,acceptedAnswers,example:{de:sentence.replace('___',answer)},prompt:'Complete the adjective form.',
    explanation:{en:ending?`${patternLabel(pattern)}; ${caseLabel(grammaticalCase).toLowerCase()}, ${gender}. Use -${ending}.`:'This color adjective stays unchanged in this exercise.',
     ko:ending?`${{strong:'관사 없음',weak:'정관사 뒤',mixed:'ein/kein 뒤'}[pattern]} · ${{nom:'주격',acc:'목적격',dat:'여격',gen:'소유격'}[grammaticalCase]} · ${{masculine:'남성',feminine:'여성',neuter:'중성',plural:'복수'}[gender]}: 어미 -${ending}로 바꿔요.`:'이 색 형용사는 이 문제에서 형태가 바뀌지 않아요.'},
   }];
  })));
 });
}
export const nominalAnswerCorrect=(q,input)=>q.acceptedAnswers.some(a=>normalize(a)===normalize(input));
export const snapshotGrammarQuestion=snapshotQuestion;
export const validNominalQuestion=q=>!!(q&&NOMINAL_MODES.includes(q.mode)&&q.word?.id&&typeof q.sentence==='string'&&q.sentence.includes('___')&&q.answer&&CASES.includes(q.case)&&['singular','plural'].includes(q.number)&&Array.isArray(q.acceptedAnswers)&&q.acceptedAnswers.includes(q.answer)&&q.acceptedAnswers.every(a=>typeof a==='string'&&a.trim())&&q.explanation?.en&&q.explanation?.ko&&(q.mode!=='adjendings'||['strong','weak','mixed'].includes(q.pattern)&&q.noun?.lemma&&genders.includes(q.gender))&&q.example?.de===q.sentence.replace('___',q.answer));
