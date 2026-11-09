import {renderStudyTabs} from '../../../../js/shared/study-components.js';
import {t} from '../services/i18n.js';
import {TTS} from '../services/tts.js';
import {renderPinyinQuiz} from './pinyin.js';
import {renderToneQuiz} from './tone.js';

const modes = {pinyin:renderPinyinQuiz, tone:renderToneQuiz};

export function renderPronunciationQuiz(host) {
  let mode = 'pinyin';
  const filters = {status:'all', pos:'all', open:false};
  const score = {correct:0, total:0};

  function draw() {
    const title = t('mode_pronunciation');
    modes[mode](host, {
      title, filters,
      score:() => score,
      onAnswer(correct) {
        score.total++;
        if (correct) score.correct++;
      },
      modeTabs:renderStudyTabs({
        label:title,
        options:Object.keys(modes).map(value=>({value,label:t('mode_'+value)})),
        selected:mode,
        attribute:'data-pronunciation-mode',
      }),
    });
  }

  function switchMode(event) {
    const button = event.target.closest('button[data-pronunciation-mode]');
    const selected = button?.dataset.pronunciationMode;
    if (!Object.hasOwn(modes, selected) || selected === mode) return;
    TTS.stop();
    mode = selected;
    draw();
    host.querySelector('[data-pronunciation-mode][aria-pressed="true"]').focus({preventScroll:true});
  }

  draw();
  host.addEventListener('click', switchMode);
  return () => {
    host.removeEventListener('click', switchMode);
    TTS.stop();
  };
}
