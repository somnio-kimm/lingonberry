import {escapeHtml as escape} from './ui.js';
import {APP_VERSION,REPOSITORY_URL,SUPPORT_URL} from './app-config.js';
import {collectBugDiagnostics} from './bug-diagnostics.js';
import {prepareBugReport} from './bug-report.js';
/** One Settings view. Language adapters own persisted progress and reset semantics. */
export function renderSettings(host,{values,labels:t,onChange,onPackages,onLicence,onReset,haptic,reportContext,selection,onSelect,canReset=true}) {
 let active=true,timer,toast;
 function showToast(text){if(!active)return;toast?.remove();clearTimeout(timer);toast=document.createElement('div');toast.className='settings-toast visible';toast.setAttribute('role','status');toast.textContent=text;host.append(toast);timer=setTimeout(()=>toast?.remove(),2500);}
 const toggle=(id,key,label)=>`<div class="set-line"><span class="set-k" id="${id}-label">${escape(label)}</span><button type="button" class="toggle-switch toggle-compact ${values[key]?'on':''}" id="${id}" role="switch" aria-labelledby="${id}-label" aria-checked="${!!values[key]}"></button></div>`;
 host.innerHTML=`<div class="set-page"><div class="set-card">
  <div class="set-line set-line--stack"><span class="set-k">${t.appearance}</span><div class="set-seg" data-role="theme" role="group" aria-label="${t.appearance}">${['light','dark','system'].map(value=>`<button type="button" class="set-seg-btn ${values.theme===value?'active':''}" data-theme-choice="${value}" aria-pressed="${values.theme===value}">${t[value]}</button>`).join('')}</div></div>
  <div class="set-hr"></div>${toggle('set-haptic','hapticEnabled',t.haptic)}<div class="set-hr"></div>${toggle('set-hide-resolved','autoRemoveResolvedWrongs',t.autoRemove)}
 </div><div class="set-card set-download-card"><div class="language-selectors">
  <label for="target"><span>${t.target}</span><select id="target" ${!selection.targets.length?'disabled':''}><option value="">${t.target}</option>${selection.targets.map(item=>`<option value="${escape(item.id)}" ${selection.target===item.id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></label>
  <label for="explanation"><span>${t.explanation}</span><select id="explanation" ${!selection.explanations.length?'disabled':''}><option value="">${t.explanation}</option>${selection.explanations.map(item=>`<option value="${escape(item.id)}" ${selection.explanation===item.id?'selected':''}>${escape(item.name)}</option>`).join('')}</select></label></div>${selection.message?`<p class="set-hint" role="status">${escape(selection.message)}</p>`:''}<div class="set-package-action"><button type="button" class="set-action-button" id="manage-packages">${t.downloadedPackages}</button></div></div>
 <div class="set-card set-action-card"><button type="button" class="set-action-button set-bug-send" id="set-bug-send">${t.sendReport}</button><button type="button" class="set-danger set-action-button" id="set-reset" ${canReset?'':'disabled'}>${t.eraseStudy}</button></div>
 <div class="set-card set-footer-card"><div class="set-footer-actions"><a class="set-support set-action-button" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">${t.support}</a><a class="set-action-button set-github" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer">GitHub</a></div><div class="set-meta"><span class="set-meta-ver">v${APP_VERSION}</span><button type="button" class="set-textbtn" id="set-license">${t.licence}</button></div></div></div>`;
 host.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{haptic();onChange('theme',button.dataset.themeChoice);});
 for(const [id,key] of [['set-haptic','hapticEnabled'],['set-hide-resolved','autoRemoveResolvedWrongs']])host.querySelector('#'+id).onclick=()=>{const enabled=!values[key];onChange(key,enabled);if(key!=='hapticEnabled'||enabled)haptic();};
 host.querySelector('#target').onchange=event=>onSelect('target',event.target.value);host.querySelector('#explanation').onchange=event=>onSelect('explanation',event.target.value);
 host.querySelector('#manage-packages').onclick=onPackages;host.querySelector('#set-license').onclick=()=>{haptic();onLicence();};
 host.querySelector('#set-reset').onclick=async()=>{
  if(!confirm(t.resetConfirm))return;haptic();
  try{const warning=await onReset();showToast(warning?t.resetPartial:t.resetDone);}catch{showToast(t.resetFailed);}
 };
 host.querySelector('#set-bug-send').onclick=async event=>{
  haptic();if(!navigator.onLine){showToast(t.reportOffline);return;}
  const button=event.currentTarget;button.disabled=true;
  try{const context={...reportContext(),webVersion:APP_VERSION,uiLanguage:values.uiLanguage,theme:values.theme};const diagnostics=await collectBugDiagnostics(context);if(active)location.href=prepareBugReport({app:context.app,diagnostics}).url;}
  catch{showToast(t.reportFailed);}finally{if(active)button.disabled=false;}
 };
 host.dataset.viewState='ready';return()=>{active=false;clearTimeout(timer);toast?.remove();};
}
