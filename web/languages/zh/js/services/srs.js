import { Store } from './store.js';

export function recordAnswer(correct) {
  const s = Store.streak;
  s.answered++;
  if (correct) s.correct++;
  Store.streak = s;
}
