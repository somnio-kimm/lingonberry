import {APP_NAME} from './shared/app-config.js';
import {allowsExplanation} from './shared/language-pairs.js';
import {createPackageManager} from './packages/manager.js';
import {createPackageStorage} from './packages/storage.js';
import {loadCatalog} from './packages/catalog.js';
import {installedPairs,languageLibrary,openInstalledStudy} from './packages/library.js';
import {interfaceText} from './shared/interface-text.js';
import {renderSettings} from './shared/settings-view.js';
import {openLicenceSheet} from './shared/licence-view.js';
import {renderPackageLibrary,formatBytes} from './shared/package-library-view.js';
import {presentationDefinitions} from './presentation/index.js';
const $=id=>document.getElementById(id),root=$('shell'),main=$('app'),tabs=$('main-nav');
const settingsKey='learn-language.preferences.v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(settingsKey)||'{}')||{};}catch{}
let target=typeof saved.target==='string'?saved.target:'',explanation=typeof saved.explanation==='string'?saved.explanation:'';
let theme=['light','dark','system'].includes(saved.theme)?saved.theme:'system';
let explicitUi=['en','ko'].includes(saved.uiLanguage)?saved.uiLanguage:'en';
const uiLanguage=()=>explicitUi,label=()=>interfaceText(uiLanguage());
function languageName(id,bilingual=false){const locale=uiLanguage()==='en'?'en-GB':uiLanguage(),name=new Intl.DisplayNames([bilingual?'en-GB':locale],{type:'language'}).of(id);if(!bilingual)return name;const native=id==='fr'?'Français':new Intl.DisplayNames([id],{type:'language'}).of(id);return native===name?name:`${name} · ${native}`;}
function save(){try{localStorage.setItem(settingsKey,JSON.stringify({target,explanation,theme,uiLanguage:explicitUi}));}catch{}}
const manager=createPackageManager({storage:createPackageStorage(),baseUrl:location.href}),presentations=new Map();
let catalog=[],records=[],current=null,phase='idle',route='home',adapter,cleanup=()=>{},operation=0,drawToken=0;
let packageTarget='',packageController=null,packageProgress=null,packageMessage='',selectionMessage='';
const usablePairs=()=>installedPairs(records).filter(item=>presentationDefinitions[item.targetLanguage]&&allowsExplanation(item.targetLanguage,item.explanationLanguage));
function preferences(value){theme=value.theme;explicitUi=value.uiLanguage;save();}
async function presentation(id){if(!presentations.has(id)){const definition=presentationDefinitions[id];if(!definition)throw new Error('Unsupported study language.');const module=await definition.load();presentations.set(id,module.createPresentation({language:id,navigate,refresh:()=>draw(),onPreferences:preferences}));}return presentations.get(id);}
function navigate(next){if(next!=='packages'&&!adapter?.screens[next])return;if(!current&&!['home','wrong','settings','packages'].includes(next))return;route=next;main.scrollTop=0;draw();window.scrollTo(0,0);}
function updateChrome(){
 const t=label();document.documentElement.lang=uiLanguage()==='en'?'en-GB':'ko';document.documentElement.dataset.theme=theme;
 $('status').textContent=t[phase]||'';$('package-status').dataset.state=phase;$('status').classList.toggle('error',['failed','catalogFailed'].includes(phase));
 $('retry').textContent=t.retry;$('retry').hidden=phase!=='failed';$('package-status').hidden=route!=='settings'||!['failed','catalogFailed'].includes(phase);
 $('header-title').textContent=route==='packages'?t.downloadedPackages:adapter?.title(route)||APP_NAME;
 $('back-btn').setAttribute('aria-label',route==='packages'?t.settings:t.backToStudy);$('back-btn').hidden=['home','wrong','settings'].includes(route);
 $('back-btn').onclick=()=>{if(route==='packages'&&packageTarget){packageTarget='';draw();}else navigate(route==='packages'?'settings':'home');};
 const selected=route==='packages'?'settings':['home','wrong','settings'].includes(route)?route:route==='retest'?'wrong':'home';
 tabs.innerHTML=['home','wrong','settings'].map((tab,i)=>`<button type="button" class="tab-btn ${selected===tab?'active':''}" data-tab="${tab}" ${selected===tab?'aria-current="page"':''}><span class="tab-icon" aria-hidden="true">${['🏠','📕','⚙️'][i]}</span><span class="tab-label">${t[tab]}</span></button>`).join('');
 tabs.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>navigate(button.dataset.tab));
}
async function draw(){
 const token=++drawToken;main.dataset.viewState='loading';cleanup();cleanup=()=>{};adapter?.stop();
 const next=await presentation(current?.targetLanguage||target||'de');if(token!==drawToken)return;
 if(adapter&&adapter!==next)adapter.setStudy(null);
 adapter=next;adapter.setStudy(current?.targetLanguage===adapter.id?current:null);adapter.setPreferences({theme,uiLanguage:uiLanguage()});
 for(const style of new Set(Object.values(presentationDefinitions).map(definition=>definition.style)))$(style).disabled=style!==presentationDefinitions[adapter.id].style;
 const layout=presentationDefinitions[adapter.id].layout;root.id=layout.root;main.id=layout.main;tabs.id=layout.tabs;
 if(route!=='packages'&&!adapter.screens[route])route='home';if(route==='home'&&!current)route='settings';updateChrome();
 if(route==='settings'){
  let closeLicence=()=>{};const pairs=usablePairs(),targets=[...new Set(pairs.map(item=>item.targetLanguage))];
  const dispose=renderSettings(main,{values:adapter.settings.values(),labels:label(),haptic:adapter.settings.haptic,reportContext:adapter.settings.reportContext,
   selection:{target,explanation,targets:targets.map(id=>({id,name:languageName(id,true)})),explanations:pairs.filter(item=>item.targetLanguage===target).map(item=>({id:item.explanationLanguage,name:languageName(item.explanationLanguage,true)})),message:selectionMessage?label().chooseExplanation:''},
   onSelect:async(key,value)=>{if(key==='target'){target=value;const pairs=usablePairs().filter(item=>item.targetLanguage===target);if(!pairs.some(item=>item.explanationLanguage===explanation))explanation=pairs.length===1?pairs[0].explanationLanguage:'';}else explanation=value;selectionMessage='';await resolveSelection();},
   onChange:(key,value)=>{adapter.settings.change(key,value);preferences(adapter.preferences());draw();},
   onPackages:()=>{packageTarget='';packageMessage='';navigate('packages');},onLicence:()=>{closeLicence();closeLicence=openLicenceSheet({labels:label(),licenses:current?.licenses});},
   onReset:async()=>{const warning=await adapter.settings.reset();adapter.setStudy(current);return warning;},
  });cleanup=()=>{closeLicence();dispose();};
 }else if(route==='packages')renderPackageLibrary(main,{languages:languageLibrary(catalog,records).filter(item=>presentationDefinitions[item.target]),target:packageTarget,labels:label(),languageName,
  onOpen:id=>{packageTarget=id;packageMessage='';draw();},onDownload:downloadExplanation,onRemove:removeLanguage,onCancel:()=>packageController?.abort(),busy:!!packageController,progress:packageProgress,message:packageMessage});
 else cleanup=adapter.render(route,main)||(()=>{});
}
async function refreshInstalled(){records=await manager.listInstalled();const pairs=usablePairs();if(!pairs.some(item=>item.targetLanguage===target)){target='';explanation='';}else if(!pairs.some(item=>item.targetLanguage===target&&item.explanationLanguage===explanation))explanation='';}
async function resolveSelection({render=true}={}){
 const token=++operation;current=null;phase='loading';updateChrome();save();
 try{const data=target&&explanation?await openInstalledStudy(manager,target,explanation):null;if(token!==operation)return;current=data;phase=current?'ready':'idle';}
 catch{if(token!==operation)return;phase='failed';}
 if(render)await draw();
}
async function downloadExplanation(row){
 if(packageController||manager.isBusy())return;
 packageController=new AbortController();packageProgress={text:label().loading,fraction:0};packageMessage='';await draw();
 const received=new Map();
 try{
  await manager.installPair(row.core,row.descriptor,{signal:packageController.signal,onProgress:info=>{
   received.set(info.descriptor.id,info.received);const done=[...received.values()].reduce((sum,n)=>sum+n,0),total=row.downloadBytes;
   packageProgress={text:`${label().loading} ${formatBytes(done,label().locale)} / ${formatBytes(total,label().locale)}`,fraction:total?done/total:1};
   if($('library-progress')){$('library-progress').value=packageProgress.fraction;$('library-progress-label').textContent=packageProgress.text;}
  }});
  await refreshInstalled();if(!target){target=row.descriptor.targetLanguage;explanation=row.language;}await resolveSelection({render:false});
 }catch(error){packageMessage=error.name==='AbortError'?label().cancelled:label().failed;}
 finally{packageController=null;packageProgress=null;await draw();}
}
async function removeLanguage(language,explanationLanguage){
 if(packageController||manager.isBusy())return;
 const plan=await manager.languageRemovalPlan(language,explanationLanguage);if(!plan.length)return;
 const bytes=plan.reduce((sum,item)=>sum+(item.download?.bytes||catalog.find(entry=>entry.id===item.id&&entry.version===item.version)?.bytes||0),0);
 const question=(explanationLanguage?label().removeExplanationQuestion:label().removeLanguageQuestion).replace('{language}',languageName(language)).replace('{explanation}',explanationLanguage?languageName(explanationLanguage):'');
 if(!confirm(`${question}\n\n${label().spaceRecovered.replace('{size}',formatBytes(bytes,label().locale))}\n${label().progressKept}`))return;
 try{
  const affected=target===language&&(!explanationLanguage||explanation===explanationLanguage);
  await manager.removeLanguage(language,explanationLanguage);for(const runtime of presentations.values())if(runtime.id===language)runtime.setStudy(null);
  await refreshInstalled();if(affected){explanation='';selectionMessage=usablePairs().length?'choose':'';route='settings';}await resolveSelection();
 }catch{packageMessage=label().removeFailed;await draw();}
}
$('retry').onclick=()=>resolveSelection();
await draw();
try{
 let cache;try{cache=localStorage;}catch{}
 catalog=await loadCatalog({url:new URL(document.querySelector('meta[name=package-catalog]').content,location.href),fallbackUrl:new URL('../catalog.json',import.meta.url),cache});
 await refreshInstalled();await resolveSelection({render:false});if(current)route='home';document.documentElement.dataset.catalogState='ready';await draw();
}catch{phase='catalogFailed';updateChrome();}
if('serviceWorker'in navigator&&!globalThis.Capacitor?.isNativePlatform?.())navigator.serviceWorker.register('./sw.js').catch(()=>{});
