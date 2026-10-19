import {orderStudyModes} from '../../../js/shared/study-modes.js';
/** Language-specific composition root. Core services never select exercises by language name. */
export const LANGUAGE = Object.freeze({"id": "de", "name": "German", "speechLocale": "de-DE", "levelScheme": "editorial CEFR", "repository": "https://github.com/somnio-kimm/lingonberry"});
export const STUDY_LEVELS = Object.freeze([{"id": "A1", "label": "GZ A1"}, {"id": "A2", "label": "GZ A2"}, {"id": "B1", "label": "GZ B1"}, {"id": "B2-C2", "label": "GZ B2-C2"}].map(Object.freeze));
export const studyLevelGroup=id=>['B2','C1','C2'].includes(id)?'B2-C2':id;
export const studyLevelLabel=id=>STUDY_LEVELS.find(level=>level.id===studyLevelGroup(id))?.label||id;
export const SCREENS = Object.freeze({
  home: {
    title: "Learn German",
    tab: "Study",
    icon: "🏠",
    load: () => import('./views/home.js'),
    view: 'renderHome',
  },
  wrong: {
    title: "Review",
    tab: "Review",
    icon: "📕",
    load: () => import('./views/wrong.js'),
    view: 'renderWrong',
  },
  settings: {
    title: "Settings",
    tab: "Settings",
    icon: "⚙️",
  },
  retest: {
    title: "Re-test",
    load: () => import('./views/retest.js'),
    view: 'renderRetest',
  },
  wordlist: {
    title: "Word list",
    icon: "📖",
    tileColor: "blue",
    menu: true,
    quiz: false,
    load: () => import('./views/wordlist.js'),
    view: 'renderWordList',
  },
  flashcards: {
    title: "Flashcards",
    icon: "🗂️",
    tileColor: "purple",
    menu: true,
    quiz: false,
    load: () => import('./views/flashcards.js'),
    view: 'renderFlashcards',
  },
  vocabinput: {
    title: "Word input",
    icon: "✍️",
    tileColor: "blue",
    menu: true,
    quiz: true,
    load: () => import('./views/vocabulary-tests.js'),
    view: 'renderWordInput',
  },
  vocabmeaning: {
    title: "Meaning quiz",
    icon: "🎯",
    tileColor: "purple",
    menu: true,
    quiz: true,
    load: () => import('./views/vocabulary-tests.js'),
    view: 'renderMeaningQuiz',
  },
  articles: {
    title: "Article selection",
    icon: "🔠",
    tileColor: "orange",
    menu: true,
    quiz: true,
    load: () => import('./views/grammar-quizzes.js'),
    view: 'renderArticles',
  },
  verbforms: {
    title: "Form input",
    icon: "⌨️",
    tileColor: "teal",
    menu: true,
    quiz: true,
    load: () => import('./views/grammar-quizzes.js'),
    view: 'renderVerbForms',
  },
  cloze: {
    title: "Cloze",
    icon: "📝",
    tileColor: "green",
    menu: true,
    quiz: true,
    load: () => import('./views/sentence-quizzes.js'),
    view: 'renderCloze',
  },
  scramble: {
    title: "Sentence scramble",
    icon: "🧩",
    tileColor: "orange",
    menu: true,
    quiz: true,
    load: () => import('./views/sentence-quizzes.js'),
    view: 'renderScramble',
  },
  listening: {
    title: "Dictation",
    icon: "🎧",
    tileColor: "teal",
    menu: true,
    quiz: true,
    load: () => import('./views/listening.js'),
    view: 'renderListeningTest',
  }
});
export const HOME_MODES = Object.freeze(orderStudyModes(Object.keys(SCREENS).filter(id => SCREENS[id].menu)));
export const isQuizScreen = id => SCREENS[id]?.quiz === true;
