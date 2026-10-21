import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTypingAnswer} from '../web/js/shared/typing-answer.js';
function fixture(){
 const field=new EventTarget(),button=new EventTarget(),changes=[],answers=[];
 Object.assign(field,{value:'',isConnected:true});button.disabled=true;
 let enabled=true,active=true;
 const binding=bindTypingAnswer(field,{button,onChange:value=>changes.push(value),onSubmit:value=>answers.push(value),enabled:()=>enabled,isActive:()=>active});
 const send=(target,type,properties={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,properties);target.dispatchEvent(event);return event;};
 return {field,button,binding,changes,answers,send,enable:value=>{enabled=value;binding.refresh();},activate:value=>{active=value;binding.refresh();}};
}
test('typing enables a nonblank answer and Enter submits the latest field text',()=>{
 const f=fixture();assert.equal(f.button.disabled,true);f.field.value='  ';f.send(f.field,'input');assert.equal(f.button.disabled,true);
 f.field.value='das Haus';f.send(f.field,'input');assert.equal(f.button.disabled,false);f.send(f.field,'keydown',{key:'Enter'});assert.deepEqual(f.answers,['das Haus']);
});
test('IME composition and Enter/229 commit cannot submit an unfinished answer',()=>{
 const f=fixture();f.field.value='汉';f.send(f.field,'compositionstart');f.send(f.field,'input');assert.equal(f.button.disabled,true);
 f.send(f.field,'keydown',{key:'Enter'});f.send(f.button,'click');assert.deepEqual(f.answers,[]);
 f.send(f.field,'compositionend');assert.equal(f.button.disabled,false);
 for(const properties of [{key:'Enter',isComposing:true},{key:'Enter',keyCode:229}])f.send(f.field,'keydown',properties);
 assert.deepEqual(f.answers,[]);f.send(f.field,'keydown',{key:'Enter'});assert.deepEqual(f.answers,['汉']);
});
test('external audio readiness and stale fields gate both click and Enter',()=>{
 const f=fixture();f.field.value='answer';f.send(f.field,'input');f.enable(false);f.send(f.button,'click');assert.deepEqual(f.answers,[]);
 f.enable(true);f.field.isConnected=false;f.send(f.field,'keydown',{key:'Enter'});assert.deepEqual(f.answers,[]);
 f.field.isConnected=true;f.activate(false);f.send(f.button,'click');assert.deepEqual(f.answers,[]);
 f.activate(true);f.send(f.button,'click');assert.deepEqual(f.answers,['answer']);
});
test('cleanup removes all handlers, including button submission',()=>{
 const f=fixture();f.field.value='answer';f.binding.destroy();f.send(f.field,'input');f.send(f.button,'click');f.send(f.field,'keydown',{key:'Enter'});assert.deepEqual(f.answers,[]);assert.deepEqual(f.changes,[]);
});
