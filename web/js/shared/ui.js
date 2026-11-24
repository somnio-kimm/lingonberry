import {AnswerSounds} from './answer-sounds.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function bindRoutes(el, navigate) { el.querySelectorAll('[data-route]').forEach(b => b.onclick = () => navigate(b.dataset.route)); }

export function showQuizBurst(correct) {
  void AnswerSounds.play(correct);
  document.querySelectorAll('.quiz-feedback-burst').forEach(node => node.remove());
  const el = document.createElement('div');
  el.className = `quiz-feedback-burst ${correct ? 'is-correct' : 'is-wrong'}`;
  el.setAttribute('aria-hidden', 'true');
  const mark = document.createElement('div');
  mark.className = 'quiz-feedback-mark';
  mark.textContent = correct ? '✓' : '✕';
  el.appendChild(mark);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
