import { SCREENS, HOME_MODES, STUDY_LEVELS } from '../app-definition.js';
import { t } from '../core/i18n.js';
import { escapeHtml as e, bindRoutes } from '../../../../js/shared/ui.js';

export function renderHome(el, ctx) {
  const level = ctx.store.state.preferences.studyLevel;
  el.innerHTML = `<section class="panel level-panel study-level-card"><h2>${t('Study level')}</h2><div class="level-chips study-level-options" role="group" aria-label="Study level">${STUDY_LEVELS.map(l=>`<button class="level-chip" data-level="${l.id}" aria-pressed="${l.id===level}">${e(l.label)}</button>`).join('')}</div></section>
    <div class="menu-grid" aria-label="Learning menus">${HOME_MODES.map(route=>`<button class="menu-card" data-route="${route}"><span class="menu-icon ${SCREENS[route].tileColor}" aria-hidden="true">${SCREENS[route].icon}</span><span class="menu-label">${e(t(SCREENS[route].title))}</span></button>`).join('')}</div>`;
  bindRoutes(el,ctx.navigate);
  el.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{
    ctx.haptic();ctx.store.preference('studyLevel',b.dataset.level); renderHome(el,ctx); ctx.updateStatus();
  });
}
