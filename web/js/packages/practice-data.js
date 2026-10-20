import {JAPANESE_FORM_KINDS} from '../shared/language-exercises.js';
/** Language metadata is data only: no package-supplied rules or HTML are executed. */
export function validatePracticeData(pack){
 const data=pack.practiceData;if(data===undefined)return;
 const check=(condition,message)=>{if(!condition)throw new Error(`Invalid language package: ${message}`);};
 const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=300;
 const rows=(value,max)=>Array.isArray(value)&&value.length<=max;
 const unique=value=>new Set(value).size===value.length;
 const entries=new Map(pack.entries.map(row=>[row.id,row]));
 const refs=value=>rows(value,30)&&value.length>0&&unique(value)&&value.every(url=>{try{return typeof url==='string'&&url.length<=2000&&new URL(url).protocol==='https:';}catch{return false;}});
 check(pack.kind==='study'&&data?.version===1&&['ja','en'].includes(pack.targetLanguage),'practice metadata');
 check(Object.keys(data).every(key=>['version','kanji','forms','countability','rootFamilies'].includes(key)),'practice metadata fields');
 if(data.kanji!==undefined){
  check(pack.targetLanguage==='ja'&&rows(data.kanji,15000),'kanji metadata');const seen=new Set();
  for(const row of data.kanji){check(row&&typeof row.literal==='string'&&/^\p{Script=Han}$/u.test(row.literal)&&!seen.has(row.literal),'kanji literal');seen.add(row.literal);
   for(const kind of ['on','kun'])check(rows(row[kind],100)&&unique(row[kind])&&row[kind].every(value=>text(value)&&/^-?[ぁ-ゖァ-ヶー]+(?:\.[ぁ-ゖァ-ヶー]+)?-?$/u.test(value)),'kanji reading');
  }
 }
 if(data.forms!==undefined){
  check(pack.targetLanguage==='ja'&&rows(data.forms,entries.size),'form metadata');const seen=new Set();
  for(const row of data.forms){check(entries.has(row.entryId)&&!seen.has(row.entryId)&&['verb','adjective'].includes(entries.get(row.entryId).partOfSpeech),'form entry');seen.add(row.entryId);check(rows(row.groups,20)&&row.groups.length>0,'form groups');const kinds=new Set();
   for(const group of row.groups){const key=`${group.formKind}:${group.subKind||''}`;check(Object.hasOwn(JAPANESE_FORM_KINDS,group.formKind)&&!kinds.has(key),'form kind');kinds.add(key);
    check(group.formKind==='adjective'?['negative','past','past-negative','te','conditional','adverbial'].includes(group.subKind):group.subKind===undefined,'form subtype');
    check(rows(group.answers,30)&&group.answers.length>0&&unique(group.answers)&&group.answers.every(text),'form answers');check(refs(group.references),'form references');
   }
  }
 }
 if(data.rootFamilies!==undefined){
  check(pack.targetLanguage==='en'&&rows(data.rootFamilies,5000),'root reference metadata');const seen=new Set();
  for(const row of data.rootFamilies){check(typeof row.id==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/.test(row.id)&&!seen.has(row.id),'root reference id');seen.add(row.id);check(text(row.term)&&text(row.language),'root reference source');check(rows(row.members,100)&&row.members.length>=2,'root reference members');const members=new Set();
   for(const member of row.members){check(entries.has(member.entryId)&&!members.has(member.entryId),'root reference entry');members.add(member.entryId);check(refs(member.references),'root reference links');}
  }
 }
 if(data.countability!==undefined){
  check(pack.targetLanguage==='en'&&rows(data.countability,entries.size),'countability metadata');const seen=new Set();
  for(const row of data.countability){check(entries.has(row.entryId)&&entries.get(row.entryId).partOfSpeech==='noun'&&!seen.has(row.entryId),'countability entry');seen.add(row.entryId);
   check(rows(row.labels,2)&&row.labels.length>0&&unique(row.labels)&&row.labels.every(label=>['countable','uncountable','plural-only'].includes(label))&&(!row.labels.includes('plural-only')||row.labels.length===1),'countability labels');check(refs(row.references),'countability references');check(row.scope===undefined||row.scope==='selected-sense','countability scope');
  }
 }
}
