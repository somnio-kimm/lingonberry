/** Small language-neutral progress store for the additional vocabulary presentations. */
export function createLexiconStore(storage,profile){
 const key=`learn-language.${profile.id}.lexicon.v1`;
 let saved;try{saved=JSON.parse(storage.getItem(key));}catch{}
 const fresh=()=>({version:1,wordStatus:{},wrongs:{},preferences:{theme:'system',uiLanguage:'en',studyLevel:profile.levels[0],hapticEnabled:true,autoRemoveResolvedWrongs:false,clozeShowTranslation:false,scrambleShowTranslation:true}});
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
 let state=saved?.version===1&&object(saved.wordStatus)&&object(saved.wrongs)&&object(saved.preferences)?{...fresh(),...saved,preferences:{...fresh().preferences,...saved.preferences}}:fresh();
 if(profile.normaliseLevel)state.preferences.studyLevel=profile.normaliseLevel(state.preferences.studyLevel);
 if(!profile.levels.includes(state.preferences.studyLevel)&&state.preferences.studyLevel!=='all')state.preferences.studyLevel=profile.levels[0];
 let warning=false;
 const save=()=>{try{storage.setItem(key,JSON.stringify(state));warning=false;return true;}catch{warning=true;return false;}};
 return {
  get state(){return state;},get warning(){return warning;},
  preference(name,value){
   const allowed={theme:['system','light','dark'],uiLanguage:['en','ko'],studyLevel:['all',...profile.levels],hapticEnabled:[true,false],autoRemoveResolvedWrongs:[true,false],clozeShowTranslation:[true,false],scrambleShowTranslation:[true,false]};
   if(!allowed[name]?.includes(value))throw new Error('Invalid preference');
   state.preferences[name]=value;
   if(name==='autoRemoveResolvedWrongs'&&value)for(const [id,row]of Object.entries(state.wrongs))if(row.count===0)delete state.wrongs[id];
   save();
  },
  wordStatus(id){return state.wordStatus[id]||'new';},
  setWordStatus(id,status){if(!id||!['new','learning','mastered'].includes(status))throw new Error('Invalid word status');state.wordStatus[id]=status;save();},
  record(question,input,correct,retest=false){
   const id=[question.mode,question.id,question.locale].join(':');
   if(!correct){const old=state.wrongs[id];state.wrongs[id]={id,question:JSON.parse(JSON.stringify(question)),input,count:(old?.count||0)+1};}
   else if(retest&&state.wrongs[id]){state.wrongs[id].count=Math.max(0,state.wrongs[id].count-1);if(!state.wrongs[id].count&&state.preferences.autoRemoveResolvedWrongs)delete state.wrongs[id];}
   save();
  },
  removeWrong(id){delete state.wrongs[id];save();},
  clearWrongs(){state.wrongs={};save();},
  reset(){const previous=state,preferences={...state.preferences};state=fresh();state.preferences=preferences;if(!save()){state=previous;throw new Error('Could not erase study progress');}},
 };
}
