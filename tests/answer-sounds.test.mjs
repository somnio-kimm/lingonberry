import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnswerSounds} from '../web/js/shared/answer-sounds.js';

function createAudioHarness({deferred=false,rejectResume=false,failSynthesis=false}={}){
 const contexts=[],notes=[],resumes=[],document=new EventTarget();document.visibilityState='visible';
 class AudioContext{
  constructor(){this.state='suspended';this.currentTime=2;this.destination={};contexts.push(this);}
  resume(){
   if(rejectResume)return Promise.reject(new Error('Audio unavailable'));
   if(deferred)return new Promise(resolve=>resumes.push(()=>{if(this.state!=='closed')this.state='running';resolve();}));
   this.state='running';return Promise.resolve();
  }
  close(){this.state='closed';return Promise.resolve();}
  createOscillator(){const note={starts:[],stops:[],frequencies:[],envelope:[],disconnects:0};notes.push(note);return {frequency:{setValueAtTime:(value,at)=>note.frequencies.push({value,at})},connect(){},disconnect(){note.disconnects++;},start:at=>note.starts.push(at),stop:at=>note.stops.push(at),set onended(value){note.end=value;}};}
  createGain(){if(failSynthesis)throw new Error('Cannot create gain');const note=notes.at(-1);return {gain:{setValueAtTime:(value,at)=>note.envelope.push({kind:'set',value,at}),linearRampToValueAtTime:(value,at)=>note.envelope.push({kind:'attack',value,at}),exponentialRampToValueAtTime:(value,at)=>note.envelope.push({kind:'release',value,at}),cancelScheduledValues:()=>{}},connect(){},disconnect(){}};}
 }
 const env={AudioContext,document,navigator:{userActivation:{isActive:false}},speechSynthesis:{cancel(){throw new Error('Feedback must not cancel speech');}},fetch(){throw new Error('Feedback must not use the network');}};
 return {env,contexts,notes,document,finishResume(){for(const finish of resumes.splice(0))finish();}};
}
test('feedback is off by default and does not create an audio context',async()=>{
 const harness=createAudioHarness(),sound=createAnswerSounds(harness.env);assert.equal(sound.enabled,false);assert.equal(await sound.play(true),false);assert.equal(harness.contexts.length,0);assert.equal(harness.notes.length,0);
});
for(const correct of [true,false])test(`${correct?'correct':'wrong'} feedback uses quiet original tones with a short gain envelope`,async()=>{
 const harness=createAudioHarness(),sound=createAnswerSounds(harness.env);sound.setEnabled(true);assert.equal(await sound.play(correct),true);assert.equal(harness.notes.length,2);
 const frequencies=harness.notes.map(note=>note.frequencies[0].value);assert.equal(frequencies[1]>frequencies[0],correct);
 for(const note of harness.notes){assert.equal(note.starts.length,1);assert.ok(note.envelope.some(point=>point.kind==='attack'&&point.value>0&&point.value<=.05));assert.ok(note.envelope.some(point=>point.kind==='release'&&point.value<.001));assert.ok(note.stops[0]-note.starts[0]<.1);}
 sound.dispose();
});
test('pointer and keyboard activation unlock audio without playing a feedback tone',async()=>{
 const harness=createAudioHarness(),sound=createAnswerSounds(harness.env);sound.setEnabled(true);harness.document.dispatchEvent(new Event('pointerdown'));await Promise.resolve();assert.equal(harness.contexts[0].state,'running');assert.equal(harness.notes.length,0);harness.document.dispatchEvent(new Event('keydown'));assert.equal(harness.contexts.length,1);sound.dispose();
});
test('muting during a pending resume prevents a late sound even after re-enabling',async()=>{
 const harness=createAudioHarness({deferred:true}),sound=createAnswerSounds(harness.env);sound.setEnabled(true);const pending=sound.play(true);sound.setEnabled(false);sound.setEnabled(true);harness.finishResume();assert.equal(await pending,false);assert.equal(harness.notes.length,0);sound.dispose();
});
test('rapid answers play only the latest result after asynchronous audio resume',async()=>{
 const harness=createAudioHarness({deferred:true}),sound=createAnswerSounds(harness.env);sound.setEnabled(true);const first=sound.play(true),last=sound.play(false);harness.finishResume();assert.deepEqual(await Promise.all([first,last]),[false,true]);assert.equal(harness.notes.length,2);assert.ok(harness.notes[1].frequencies[0].value<harness.notes[0].frequencies[0].value);sound.dispose();
});
test('a repeated enabled preference does not cancel a pending answer',async()=>{
 const harness=createAudioHarness({deferred:true}),sound=createAnswerSounds(harness.env);sound.setEnabled(true);const pending=sound.play(true);sound.setEnabled(true);harness.finishResume();assert.equal(await pending,true);sound.dispose();
});
test('muting stops active notes, closes its context and detaches activation listeners',async()=>{
 const harness=createAudioHarness(),sound=createAnswerSounds(harness.env);sound.setEnabled(true);await sound.play(true);sound.setEnabled(false);assert.equal(harness.contexts[0].state,'closed');assert.ok(harness.notes.every(note=>note.stops.includes(undefined)&&note.disconnects>0));harness.document.dispatchEvent(new Event('click'));await Promise.resolve();assert.equal(harness.contexts.length,1);assert.equal(await sound.play(false),false);
});
test('background pages never play or retain feedback notes',async()=>{
 const harness=createAudioHarness(),sound=createAnswerSounds(harness.env);sound.setEnabled(true);await sound.play(true);harness.document.visibilityState='hidden';harness.document.dispatchEvent(new Event('visibilitychange'));assert.ok(harness.notes.every(note=>note.stops.includes(undefined)));assert.equal(await sound.play(true),false);sound.dispose();
});
for(const kind of ['unsupported','constructor','resume','synthesis'])test(`audio ${kind} failures remain silent and do not reject quiz feedback`,async()=>{
 const harness=createAudioHarness({rejectResume:kind==='resume',failSynthesis:kind==='synthesis'});if(kind==='unsupported')delete harness.env.AudioContext;if(kind==='constructor')harness.env.AudioContext=class{constructor(){throw new Error('Audio unavailable');}};
 const sound=createAnswerSounds(harness.env);sound.setEnabled(true);assert.equal(await sound.play(true),false);sound.dispose();
});
