import {randomUUID} from 'node:crypto';
import {writeFile,rename,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

/** Readers see the previous complete ledger or the next complete ledger. */
export async function writeTextAtomic(path,text) {
 const target=path instanceof URL?fileURLToPath(path):path;
 const temporary=target+'.tmp-'+process.pid+'-'+randomUUID();
 try {
  await writeFile(temporary,text);
  await rename(temporary,target);
 } finally {
  await rm(temporary,{force:true});
 }
}
