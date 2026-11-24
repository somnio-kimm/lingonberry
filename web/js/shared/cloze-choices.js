import {readChoiceInitial} from './meaning-distractors.js';
import {shuffle} from './random.js';

/** Sample actual answer strings across the pool, then avoid a visible initial outlier. */
export function chooseClozeOptions(correct, candidates, toOption, random = Math.random) {
 const seen = new Set([correct.text.normalize('NFKC').toLowerCase()]);
 const ids = new Set(correct.id === undefined ? [] : [correct.id]);
 const buckets = new Map();
 let count = 0;
 for (const candidate of shuffle(candidates, random)) {
  const option = toOption(candidate);
  if (!option?.text) continue;
  const text = option.text.normalize('NFKC').toLowerCase();
  if (seen.has(text) || ids.has(option.id)) continue;
  seen.add(text);
  if (option.id !== undefined) ids.add(option.id);
  const initial = readChoiceInitial(option.text);
  if (!buckets.has(initial)) buckets.set(initial, []);
  buckets.get(initial).push(option);
  if (++count === 64) break;
 }

 const initial = readChoiceInitial(correct.text);
 const distinct = [...buckets].filter(([key]) => key !== initial).map(([, options]) => options[0]);
 const options = [correct, ...distinct.slice(0, 3)];
 if (options.length < 4) {
  // Up to two of each initial gives four choices with no 3–1 split.
  const extras = [...buckets].map(([key, group]) => group[key === initial ? 0 : 1]).filter(Boolean);
  if (options.length + extras.length >= 4) options.push(...extras.slice(0, 4 - options.length));
  else if (buckets.get(initial)?.length >= 3) options.splice(1, 3, ...buckets.get(initial).slice(0, 3));
 }
 if (options.length === 1 && buckets.get(initial)?.length) options.push(...buckets.get(initial).slice(0, 2));
 return shuffle(options, random);
}
