import {renderStudyMenu,renderStudyLevels} from '../../../../js/shared/study-menu-view.js';
import { HOME_MODES, STUDY_LEVELS } from '../app-definition.js';
import { Store } from '../services/store.js';
import { Haptic } from '../services/haptic.js';
import { modeTitle } from '../components.js';
import { navigate } from '../router.js';
import { t } from '../services/i18n.js';
import { loadHskLevels } from '../services/vocabulary.js';

export function renderHome(el) {
  const selectedLv = Store.hskLevels[0] ?? 1;
  let switching = false;

  el.innerHTML=renderStudyLevels({title:t('studyLevel'),levels:STUDY_LEVELS,selected:selectedLv,variant:'hsk'})+renderStudyMenu(HOME_MODES.map(id=>({id,label:modeTitle(id)})),{variant:'quiz',label:t('tabHome')});

  const levelCard = el.querySelector('.card');
  el.querySelectorAll('.hsk-chip').forEach(b => {
    b.onclick = async () => {
      if (switching) return;
      const lv = Number(b.dataset.lv);
      const prev = Store.hskLevels;
      if (prev.length === 1 && prev[0] === lv) return;
      switching = true;
      const busy = document.createElement('div');
      busy.className = 'hsk-load-mask';
      busy.innerHTML = `<span class="hsk-load-txt">${t('loadingLevels')}</span>`;
      levelCard.style.position = 'relative';
      levelCard.appendChild(busy);
      el.querySelectorAll('.hsk-chip').forEach(chip => { chip.disabled = true; });
      try {
        await loadHskLevels([lv]);
        Store.hskLevels = [lv];
        Haptic.light();
        renderHome(el);
      } catch {
        Store.hskLevels = prev;
        busy.remove();
        el.querySelectorAll('.hsk-chip').forEach(chip => { chip.disabled = false; });
        switching = false;
        alert(t('vocabLoadError'));
      }
    };
  });
  el.querySelectorAll('.quiz-card').forEach(c => c.onclick = () => {
    Haptic.light(); navigate(c.dataset.quiz, { title: modeTitle(c.dataset.quiz) });
  });
}
