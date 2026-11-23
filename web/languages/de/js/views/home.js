import {renderStudyMenu,renderStudyLevels} from '../../../../js/shared/study-menu-view.js';
import { SCREENS, HOME_MODES, STUDY_LEVELS } from '../app-definition.js';
import { t } from '../core/i18n.js';
import { bindRoutes } from '../../../../js/shared/ui.js';

export function renderHome(el, ctx) {
  const level = ctx.store.state.preferences.studyLevel;
  el.innerHTML=renderStudyLevels({title:t('Study level'),levels:STUDY_LEVELS,selected:level})+renderStudyMenu(HOME_MODES.map(id=>({id,label:t(SCREENS[id].title)})),{label:t('Study')});
  bindRoutes(el,ctx.navigate);
  el.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{
    ctx.haptic();ctx.store.preference('studyLevel',b.dataset.level); renderHome(el,ctx); ctx.updateStatus();
  });
}
