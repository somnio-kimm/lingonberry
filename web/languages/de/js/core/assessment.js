function normalizeAnswer(value, caseSensitive = false) {
  const text = String(value).normalize('NFC').trim().replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '').trim();
  return caseSensitive ? text : text.toLocaleLowerCase('de');
}
export function judgeAnswer(question, input) {
  const value = normalizeAnswer(input, question.case_sensitive);
  const correct = question.accepted.some(a => normalizeAnswer(a, question.case_sensitive) === value);
  const orthography = !correct && question.case_sensitive && question.accepted.some(a => normalizeAnswer(a) === normalizeAnswer(input));
  return { correct, answer: question.answer, explanation: orthography ? 'Check sentence-initial capitalization and German noun capitalization. ' + question.explanation : question.explanation };
}
export function reviewSchedule(previous, correct, hinted, now = Date.now()) {
  const streak = correct && !hinted ? (previous?.streak || 0) + 1 : 0;
  const days = [1, 3, 7, 14, 30][Math.min(Math.max(streak - 1, 0), 4)];
  return { streak, due: now + (streak ? days * 86400000 : 600000), lastCorrect: correct, hinted, updated: now };
}
