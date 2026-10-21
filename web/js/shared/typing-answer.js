/** One device-keyboard/IME lifecycle for a typed answer or aligned inline gaps. */
export function bindTypingAnswers(fields,{button,onChange,onSubmit,enabled=()=>true,isActive=()=>true}) {
 const composing=new Set(),listeners=[];
 let disposed=false;
 const values=()=>fields.map(field=>field.value);
 const active=()=>!disposed&&fields.length>0&&fields.every(field=>field.isConnected!==false)&&isActive();
 const allowed=()=>active()&&!composing.size&&values().every(value=>value.trim())&&enabled();
 function refresh(){if(button)button.disabled=!allowed();}
 function change(){if(!active())return;onChange(values());refresh();}
 function submit(event){
  if(!allowed())return;
  event?.preventDefault();onChange(values());onSubmit(values());
 }
 for(const field of fields){
  const events=[
   ['input',change],
   ['compositionstart',()=>{composing.add(field);refresh();}],
   ['compositionend',()=>{composing.delete(field);change();}],
   ['keydown',event=>{
    if(!active()||event.key!=='Enter'||event.isComposing||event.keyCode===229||composing.size)return;
    event.preventDefault();
    const next=fields.slice(fields.indexOf(field)+1).find(input=>!input.value.trim())||fields.find(input=>!input.value.trim());
    if(next)next.focus();else submit(event);
   }],
  ];
  for(const [name,handler]of events){field.addEventListener(name,handler);listeners.push([field,name,handler]);}
 }
 button?.addEventListener('click',submit);refresh();
 return {
  get isComposing(){return composing.size>0;},refresh,
  destroy(){disposed=true;for(const [field,name,handler]of listeners)field.removeEventListener(name,handler);button?.removeEventListener('click',submit);},
 };
}
export function bindTypingAnswer(field,{onChange,onSubmit,...options}) {
 return bindTypingAnswers([field],{...options,onChange:values=>onChange(values[0]),onSubmit:values=>onSubmit(values[0])});
}
