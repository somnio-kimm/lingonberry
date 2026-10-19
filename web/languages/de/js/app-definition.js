import {orderStudyModes} from '../../../js/shared/study-modes.js';
/** Language-specific composition root. Core services never select exercises by language name. */
export const LANGUAGE = Object.freeze({"id": "de", "name": "German", "speechLocale": "de-DE", "levelScheme": "editorial CEFR", "repository": "https://github.com/somnio-kimm/lingonberry"});
export const STUDY_LEVELS = Object.freeze([{"id": "A1", "label": "A1"}, {"id": "A2", "label": "A2"}, {"id": "B1", "label": "B1"}, {"id": "B2", "label": "B2"}, {"id": "C1", "label": "C1"}, {"id": "C2", "label": "C2"}].map(Object.freeze));
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
