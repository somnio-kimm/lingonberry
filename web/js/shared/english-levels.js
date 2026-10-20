/** Editorial vocabulary groups; these labels do not certify or predict an IELTS score. */
export const ENGLISH_LEVELS=Object.freeze([
 'IELTS 1.0–3.5','IELTS 4.0–6.5','IELTS 7.0–8.0','IELTS 8.5–9.0',
]);
const tierGroups=Object.freeze({foundation:0,everyday:0,independent:1,advanced:2,precision:3});
const legacyTiers=Object.freeze({'1.0':0,'3.0':0,'5.0':1,'6.5':2,'8.0':3});
/** Saved target scores select the containing range. */
export function normaliseEnglishSelection(value){
 if(ENGLISH_LEVELS.includes(value))return value;
 if(typeof value!=='string'||!/^\d\.[05]$/u.test(value))return ENGLISH_LEVELS[0];
 const band=Number(value);
 if(band<1||band>9)return ENGLISH_LEVELS[0];
 return ENGLISH_LEVELS[band<=3.5?0:band<=6.5?1:band<=8?2:3];
}
export function assignEnglishLevel(entry){
 if(ENGLISH_LEVELS.includes(entry.level))return entry.level;
 // Historic numeric entry levels named five editorial tiers, not assessed IELTS scores.
 const tier=entry.grammar?.studyTier??entry.studyTier;
 const group=tierGroups[tier]??legacyTiers[entry.level];
 return group===undefined?normaliseEnglishSelection(entry.level):ENGLISH_LEVELS[group];
}
