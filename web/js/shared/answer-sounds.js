/** Small original feedback tones. No files, network, microphone or speech controls. */
export function createAnswerSounds(env=globalThis){
 let enabled=false,context,sequence=0,listening=false;
 const active=new Set(),events=['pointerdown','keydown','click'];
 function stopNotes(){
  for(const note of active){try{note.gain.gain.cancelScheduledValues(note.context.currentTime);note.gain.gain.setValueAtTime(0,note.context.currentTime);note.oscillator.stop();}catch{}try{note.oscillator.disconnect();note.gain.disconnect();}catch{}}
  active.clear();
 }
 function readContext(){
  if(context?.state==='closed')context=undefined;
  if(!context){const AudioContext=env.AudioContext||env.webkitAudioContext;if(!AudioContext)return;try{context=new AudioContext();}catch{return;}}
  return context;
 }
 async function unlock(){
  if(!enabled||env.document?.visibilityState==='hidden')return false;
  const current=readContext();if(!current)return false;
  try{if(current.state!=='running')await current.resume();return enabled&&context===current&&current.state==='running';}catch{return false;}
 }
 function handleActivation(){void unlock();}
 function handleVisibility(){if(env.document?.visibilityState==='hidden'){sequence++;stopNotes();}}
 function bindActivation(value){
  if(!env.document||listening===value)return;listening=value;
  for(const event of events)env.document[value?'addEventListener':'removeEventListener'](event,handleActivation,true);
  env.document[value?'addEventListener':'removeEventListener']('visibilitychange',handleVisibility);
 }
 function setEnabled(value){
  const next=value===true;if(next===enabled)return;enabled=next;sequence++;bindActivation(enabled);
  if(!enabled){stopNotes();const previous=context;context=undefined;try{void previous?.close()?.catch(()=>{});}catch{}}
  else if(env.navigator?.userActivation?.isActive)void unlock();
 }
 async function play(correct){
  if(!enabled||env.document?.visibilityState==='hidden')return false;
  const ticket=++sequence;stopNotes();
  if(!await unlock()||ticket!==sequence||!enabled)return false;
  const current=context,frequencies=correct?[523.25,659.25]:[220,196];
  try{
   for(const [index,frequency]of frequencies.entries()){
    const start=current.currentTime+index*.075,oscillator=current.createOscillator(),gain=current.createGain(),note={context:current,oscillator,gain};
    oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.035,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+.07);
    oscillator.connect(gain);gain.connect(current.destination);active.add(note);
    oscillator.onended=()=>{active.delete(note);try{oscillator.disconnect();gain.disconnect();}catch{}};
    oscillator.start(start);oscillator.stop(start+.075);
   }
   return true;
  }catch{stopNotes();return false;}
 }
 function dispose(){setEnabled(false);sequence++;stopNotes();}
 return {setEnabled,play,unlock,dispose,get enabled(){return enabled;}};
}
export const AnswerSounds=createAnswerSounds();
