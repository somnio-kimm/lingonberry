/** Carry only explicitly equivalent manual markers once; keep raw answers and old IDs. */
export function migrateEquivalentWordStatuses(state,rows=[]) {
 const rank=['new','learning','mastered'];let changed=false;
 const migrations=state.contentMigrations&&typeof state.contentMigrations==='object'&&!Array.isArray(state.contentMigrations)?state.contentMigrations:{};
 for(const row of rows){
  if(row.sameConcept!==true||!row.replacementId||Object.hasOwn(migrations,row.id)||!Object.hasOwn(state.wordStatus,row.id))continue;
  const old=state.wordStatus[row.id]||'new',current=state.wordStatus[row.replacementId]||'new';
  if(rank.indexOf(old)>rank.indexOf(current))state.wordStatus[row.replacementId]=old;
  migrations[row.id]=row.replacementId;state.contentMigrations=migrations;changed=true;
 }
 return changed;
}
