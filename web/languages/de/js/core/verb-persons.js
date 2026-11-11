/** Explicit practice eligibility; missing finite data alone does not restrict a person. */
export const PERSONS=Object.freeze(['ich','du','er','wir','ihr','sie']);
export const isValidVerbPersons=value=>value===undefined||Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(person=>PERSONS.includes(person));
export function getVerbPersons(word){const selected=word?.verb_persons;return selected===undefined?PERSONS:isValidVerbPersons(selected)?PERSONS.filter(person=>selected.includes(person)):[];}
