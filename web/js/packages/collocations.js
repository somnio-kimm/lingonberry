const fail=message=>{throw new Error(`Invalid language package: ${message}`);};
const check=(value,message)=>{if(!value)fail(message);};
const text=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function validateCollocations(pack){
 const ids=new Set();
 for(const entry of pack.entries){if(entry.collocations===undefined)continue;check(Array.isArray(entry.collocations)&&entry.collocations.length<=50,'collocations');
  for(const row of entry.collocations){const allowed=pack.kind==='study'?['id','phrase','type','example','acceptedAnswers']:['id','meaning','exampleTranslation','meaningChoices'];check(row&&Object.keys(row).every(key=>allowed.includes(key)),'collocation fields');check(row&&typeof row.id==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/.test(row.id)&&!ids.has(row.id),'collocation id');ids.add(row.id);
   if(pack.kind==='study'){check(text(row.phrase,300)&&text(row.example)&&row.type==='verb-phrase','collocation phrase');check(row.meaning===undefined&&row.exampleTranslation===undefined,'collocation translations belong in explanation packs');check(Array.isArray(row.acceptedAnswers)&&row.acceptedAnswers.length<=20&&row.acceptedAnswers.every(value=>text(value,300)),'collocation answers');}
   else{check(row.phrase===undefined&&row.example===undefined,'collocation study text belongs in core');check(text(row.meaning)&&text(row.exampleTranslation),'collocation translation');check(Array.isArray(row.meaningChoices)&&row.meaningChoices.length>=3&&row.meaningChoices.length<=6&&new Set(row.meaningChoices).size===row.meaningChoices.length&&row.meaningChoices.includes(row.meaning)&&row.meaningChoices.every(value=>text(value)),'collocation meaning choices');}
  }
 }
}
export function validateCollocationTranslations(entry,translation){
 const originals=entry.collocations||[],rows=translation.collocations||[];
 check(originals.length===rows.length,'incomplete collocation translations');const byId=new Map(rows.map(row=>[row.id,row]));
 for(const row of originals)check(byId.has(row.id),'collocation translation identity');
}
export function assembleCollocations(entry,translation){const rows=new Map((translation.collocations||[]).map(row=>[row.id,row]));return (entry.collocations||[]).map(row=>({...row,...rows.get(row.id)}));}
