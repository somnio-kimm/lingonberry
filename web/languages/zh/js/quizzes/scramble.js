import {projectScrambleTiles} from '../../../../js/shared/lexicon-sentences.js';
import {renderLexiconSentence} from '../../../../js/shared/lexicon-sentence-view.js';
import {escapeHtml as e} from '../../../../js/shared/ui.js';
import {practiceSentences} from '../services/sentence-focus.js';
import {createSentenceFilters} from '../services/sentence-filters.js';
import { showQuizBurst } from '../components.js';
import { snapshotQuestion } from '../services/wrong-review.js';
import { Store } from '../services/store.js';
import { Pinyin } from '../services/pinyin.js';
import { TTS } from '../services/tts.js';
import { Haptic } from '../services/haptic.js';
import { recordAnswer } from '../services/srs.js';
import { shuffle, pick, scorePill, posGroupIdsForWord } from '../components.js';
import { t, sentenceMeaning } from '../services/i18n.js';

export function renderScrambleQuiz(el,session={}) {
  const words = session.question?Store.words.filter(w=>w.hskLevel===session.question.word.hskLevel):Store.activeWords;
  const withSentences = session.question?[session.question.word]:words.filter(w => practiceSentences(w).length);
  let score = 0, total = 0, word, sentence, pool = [], chosen = [], feedback = '',alive=true,childCleanup=()=>{};

  const filters=createSentenceFilters(withSentences,session,()=>{TTS.stop();newQ();});

  function newQ() {
    if(!alive)return;
    if(session.onNext&&word){session.onNext();return;}
    word = session.question?.word||pick(filters.pool());
    if(!word){feedback='';draw();return;}
    sentence = session.question?.sentence||pick(practiceSentences(word));
    const chars = Pinyin.sentenceColumns(sentence) || [...sentence.hanzi].map(hanzi => ({ hanzi, pinyin: '' }));
    pool = shuffle(chars);
    chosen = [];
    feedback = '';
    draw();
  }

  function tapPool(i) {
    if (!alive||feedback) return;
    chosen.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }
  function tapChosen(i) {
    if (!alive||feedback) return;
    pool.push(chosen[i]);
    chosen = chosen.filter((_, j) => j !== i);
    Haptic.light();
    draw();
  }

  function checkAnswer() {
    if (!alive||feedback) return;
    total++;
    const user = chosen.map(c => c.hanzi).join('');
    if (user === sentence.hanzi) {
      score++; feedback = 'correct'; Haptic.success();
      recordAnswer(true);
    } else {
      feedback = 'wrong'; Haptic.error();
      recordAnswer(false);
      if(!session.question)Store.addWrong({
        mode: 'scramble', wordHanzi: word.hanzi, wordId: word.id,
        hskLevel: word.hskLevel,
        posGroups: posGroupIdsForWord(word),
        userAnswer: user, correctAnswer: sentence.hanzi,question:snapshotQuestion('scramble',word,sentence),
      });
    }
    showQuizBurst(feedback==='correct');
    session.onAnswer?.(feedback==='correct',user);
    draw();
  }

  function draw() {
    if(!alive)return;childCleanup();const displayed=session.score?.()||{correct:score,total};
    el.innerHTML=`<div class="sentence-quiz-header"><div class="section-title">${t('mode_scramble')}</div>${scorePill(displayed.correct,displayed.total)}</div>${filters.markup()}<div data-sentence-body></div>`;filters.bind(el);const host=el.querySelector('[data-sentence-body]');
    if(!word){host.innerHTML=`<section class="card empty-wrong quiz-after-filter"><p>${t('noWordsFilter')}</p></section>`;return;}
    const projected=projectScrambleTiles(chosen,pool,tile=>tile.hanzi),tiles=projected.tiles,view={mode:'scramble',word,locale:word.studyExplanationLanguage||Store.uiLang,sentence:sentence.hanzi,example:sentence,answer:sentence.hanzi,tokens:projected.tokens,pool:projected.pool};
    const text=key=>t({'Show Reading':'showPinyin','Speak Example':'listenSentence','Your Answer':'yourAnswer','Reset':'reset','Submit':'submit','Skip':'skip','Next':'nextQ'}[key]||key);
    childCleanup=renderLexiconSentence(host,{question:view,feedback,chosenTokens:projected.chosenTokens,showReading:Store.scrambleShowPinyin,showTranslation:true,translationVisible:true,translation:sentenceMeaning(sentence),t:text},{
      language:'zh',uiLanguage:Store.uiLang,reading:true,renderSentence:value=>value===sentence.hanzi?Pinyin.htmlSentence(sentence):e(value),
      renderTile:(_text,index)=>`${Store.scrambleShowPinyin?`<span class="scramble-chip-pinyin"${tiles[index].pinyin?'':' aria-hidden="true"'}>${e(tiles[index].pinyin)}</span>`:''}<span class="scramble-chip-hanzi">${e(tiles[index].hanzi)}</span>`,
      speak:()=>TTS.speak(sentence.hanzi),choose:id=>tapPool(id-chosen.length),remove:tapChosen,toggleReading:value=>{Store.scrambleShowPinyin=value;Haptic.light();draw();},reset:()=>{pool=shuffle([...pool,...chosen]);chosen=[];draw();},submit:checkAnswer,skip:()=>{Haptic.light();session.onSkip?session.onSkip():newQ();},next:newQ,
    });
  }
  newQ();return()=>{alive=false;childCleanup();TTS.stop();};
}
