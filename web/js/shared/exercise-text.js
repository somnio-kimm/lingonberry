import {EXERCISE_INSTRUCTIONS} from './exercise-instructions.js';
const translations=new Map();
for(const row of EXERCISE_INSTRUCTIONS)for(const text of Object.values(row))translations.set(text,row);
/** Localise known UI instructions, including saved variants; never machine-translate learning content. */
export function localizeExerciseText(text,displayLanguage='en'){
 const value=String(text??''),row=translations.get(value);return row?.[displayLanguage]||row?.en||value;
}
