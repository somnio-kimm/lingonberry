import { STUDY_LEVELS, normaliseStudyLevel } from '../app-definition.js';
import { QUIZ_MODES, SNAPSHOT_MODES, LISTENING_MODES, emptyQuizAnswers } from './quiz-modes.js';
import { snapshotQuestion } from '../../../../js/shared/question-snapshot.js';
import { wrongAnswerCount } from './wrong-count.js';
import { reviewSchedule } from './assessment.js';
const KEY = 'learn-language.de.progress.v1';
const STUDY_LEVEL_IDS = STUDY_LEVELS.map(level => level.id);
const empty = () => ({ version: 1, units: {}, concepts: {}, skills: {}, lastUnit: null });
export function createStore(storage) {
  let state;
  try { state = JSON.parse(storage.getItem(KEY)); } catch {}
  if (!state || state.version !== 1 || !state.units || !state.concepts) state = empty();
  state.skills ||= {};
  state.wrongDismissed ||= {};
  state.wordStatus ||= {};
  state.quizAnswers ||= emptyQuizAnswers();
  for (const mode of QUIZ_MODES) state.quizAnswers[mode] ||= {};
  state.preferences = {
    theme: ['light','dark','system'].includes(state.preferences?.theme) ? state.preferences.theme : 'system',
    studyLevel: STUDY_LEVEL_IDS.includes(normaliseStudyLevel(state.preferences?.studyLevel)) ? normaliseStudyLevel(state.preferences.studyLevel) : STUDY_LEVEL_IDS[0],
    uiLang: ['en','ko'].includes(state.preferences?.uiLang) ? state.preferences.uiLang : 'en',
    hapticEnabled: state.preferences?.hapticEnabled !== false,
    autoRemoveResolvedWrongs: state.preferences?.autoRemoveResolvedWrongs === true,
    clozeShowTranslation: state.preferences?.clozeShowTranslation !== false,
    scrambleShowTranslation: state.preferences?.scrambleShowTranslation !== false,
  };
  let warning = '';
  function save() { try { storage.setItem(KEY, JSON.stringify(state)); warning = ''; } catch { warning = 'Device storage is unavailable or full. This session works, but progress may not survive closing the app.'; } }
  function unit(id) { return state.units[id] ||= { stage: 'reading', answers: {}, drafts: {}, checks: {}, listened: false, transcriptShown: false }; }
  function removeResolvedWrongs() {
    if(!state.preferences.autoRemoveResolvedWrongs)return;
    for(const records of Object.values(state.quizAnswers))for(const record of Object.values(records)){
      const attempts=record.attempts||[],dismissed=record.dismissedThrough??-1;
      if(attempts.some((a,i)=>i>dismissed&&a.correct===false)&&wrongAnswerCount(attempts,dismissed)===0)record.dismissedThrough=attempts.length-1;
    }
    for(const [unitId,u] of Object.entries(state.units))for(const [questionId,record] of Object.entries(u.answers||{})){
      const attempts=record.attempts||[],dismissed=state.wrongDismissed[unitId]?.[questionId]??-1;
      if(attempts.some((a,i)=>i>dismissed&&a.correct===false)&&wrongAnswerCount(attempts,dismissed)===0){state.wrongDismissed[unitId]||={};state.wrongDismissed[unitId][questionId]=attempts.length-1;}
    }
  }

  return {
    get state() { return state; }, get warning() { return warning; }, unit,
    wordStatus(id) { return ['learning','mastered'].includes(state.wordStatus[id])?state.wordStatus[id]:'new'; },
    setWordStatus(id,status) {
      if(!id||!['new','learning','mastered'].includes(status))throw new Error('Invalid word status');
      state.wordStatus[id]=status;save();
    },
    preference(key, value) {
      const allowed = { theme:['light','dark','system'], studyLevel:STUDY_LEVEL_IDS, uiLang:['en','ko'], hapticEnabled:[true,false],autoRemoveResolvedWrongs:[true,false],clozeShowTranslation:[true,false],scrambleShowTranslation:[true,false] };
      if (!allowed[key]?.includes(value)) throw new Error('Invalid preference');
      state.preferences[key] = value; if(key==='autoRemoveResolvedWrongs'&&value)removeResolvedWrongs(); save();
    },
    resetStudy() {
      const previous=state;
      state={...empty(),preferences:{...previous.preferences},wrongDismissed:{},wordStatus:{},quizAnswers:emptyQuizAnswers()};
      save();
      if(warning){state=previous;return false;}
      return true;
    },
    dismissWrong(id, question) {
      const attempts = unit(id).answers[question]?.attempts || [];
      state.wrongDismissed[id] ||= {};
      state.wrongDismissed[id][question] = attempts.length - 1; save();
    },
    recordQuizAnswer(mode,question,input,correct,metadata={}) {
      if(!QUIZ_MODES.includes(mode))throw new Error('Invalid quiz mode');
      const previous=state.quizAnswers[mode][question.id];
      const attempt={input,correct,review:metadata.review===true,at:Date.now(),...(LISTENING_MODES.includes(mode)?{listening:{heard:metadata.heard===true,hintUsed:metadata.hintUsed===true,plays:metadata.plays||0}}:{})};
      // Keep the last failed prompt/options when later correct answers use new distractors.
      const snapshot = SNAPSHOT_MODES.includes(mode)
        ? correct && previous?.questionSnapshot
          ? previous.questionSnapshot
          : snapshotQuestion(question)
        : null;
      const saved=snapshot||question;
      state.quizAnswers[mode][question.id]={wordId:saved.word.id,level:saved.word.cefr,example:saved.example,answer:mode==='scramble'?saved.example.de:saved.displayAnswer||saved.answer,prompt:saved.prompt||'',questionSnapshot:snapshot,questionContext:{start:question.start??null,tense:question.tense||null,person:question.person||null,case:question.case||null,number:question.number||null,pattern:question.pattern||null},correct,dismissedThrough:previous?.dismissedThrough??-1,attempts:[...(previous?.attempts||[]),attempt]};removeResolvedWrongs();save();
    },
    dismissQuizWrong(mode,id) {
      const record=state.quizAnswers[mode]?.[id];if(!record)return;
      record.dismissedThrough=record.attempts.length-1;save();
    },
    recordReviewAnswer(id,question,input,result) {
      const u=unit(id),previous=u.answers[question.id]||{};
      const attempt={input,correct:result.correct,hinted:true,review:true,run:previous.run||1,at:Date.now()};
      u.answers[question.id]={...previous,input,...result,attempts:[...(previous.attempts||[]),attempt]};removeResolvedWrongs();save();
    },
    stage(id, stage) { unit(id).stage = stage; state.lastUnit = id; save(); },
    hint(id, question) { const u = unit(id); u.hints ||= {}; u.hints[question] = true; save(); },
    answer(id, question, input, result, { listening = false } = {}) {
      const u = unit(id), previous = u.answers[question.id];
      if (previous?.locked) return;
      const hinted = !!u.hints?.[question.id] || listening && u.transcriptShown;
      const run = previous?.run || 1;
      const priorInRun = previous?.attempts?.filter(a => (a.run || 1) === run) || [];
      const attempt = { input, correct: result.correct, review:false, hinted, run, at: Date.now() };
      const attempts = [...(previous?.attempts || []), attempt];
      u.answers[question.id] = { input, ...result, attempts, run, locked: true };
      // A corrected answer still needs an independent review later.
      const records = question.skill ? state.skills : state.concepts;
      const key = question.skill || question.concept;
      records[key] = reviewSchedule(records[key], result.correct, hinted || priorInRun.length > 0);
      state.lastUnit = id; save();
    },
    retry(id, question) { const a = unit(id).answers[question]; if (a && !a.correct) { a.locked = false; a.input = ''; save(); } },
    draft(id, kind, text) { unit(id).drafts[kind] = text.slice(0, 5000); save(); },
    check(id, kind, i, value) { unit(id).checks[kind] ||= {}; unit(id).checks[kind][i] = value; save(); },
    listened(id) { unit(id).listened = true; save(); },
    transcript(id) { unit(id).transcriptShown = true; save(); },
    recording(id, metadata) { unit(id).recording = metadata; save(); },
    beginRun(id, questions, { listening = false } = {}) { const u = unit(id); if (listening) { u.listened = false; u.transcriptShown = false; } for (const q of questions) { const old = u.answers[q.id]; u.answers[q.id] = { attempts: old?.attempts || [], run: (old?.run || 1) + 1, input: '', locked: false }; if (u.hints) delete u.hints[q.id]; } save(); },
  };
}
