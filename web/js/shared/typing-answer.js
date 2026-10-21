/** One device-keyboard/IME lifecycle for all typed quiz answers. */
export function bindTypingAnswer(field,{button,onChange,onSubmit,enabled=()=>true,isActive=()=>true}) {
 let composing=false,disposed=false;
 const active=()=>!disposed&&field.isConnected!==false&&isActive();
 const allowed=()=>active()&&!composing&&!!field.value.trim()&&enabled();
 function refresh() { if(button)button.disabled=!allowed(); }
 function change() {
  if(!active())return;
  onChange(field.value);
  refresh();
 }
 function submit(event) {
  if(!allowed())return;
  event?.preventDefault();
  onChange(field.value);
  onSubmit(field.value);
 }
 function startComposition() { composing=true;refresh(); }
 function endComposition() { composing=false;change(); }
 function keydown(event) {
  if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();submit(event);}
 }
 const events=[['input',change],['compositionstart',startComposition],['compositionend',endComposition],['keydown',keydown]];
 for(const [name,handler]of events)field.addEventListener(name,handler);
 button?.addEventListener('click',submit);
 refresh();
 return {
  get isComposing(){return composing;},
  refresh,
  destroy(){
   disposed=true;
   for(const [name,handler]of events)field.removeEventListener(name,handler);
   button?.removeEventListener('click',submit);
  },
 };
}
