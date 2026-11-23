import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {shellAssets} from './shell-assets.mjs';
export async function auditRuntime(directory=fileURLToPath(new URL('../web/',import.meta.url))){
 const files=(await shellAssets(directory)).filter(file=>file.endsWith('.js')),sources=new Map(),hashes=new Map(),edges=new Map(),missingImports=[],unusedImportCandidates=[];
 let bytes=0;
 for(const file of files){const body=await readFile(resolve(directory,file)),source=body.toString('utf8'),hash=createHash('sha256').update(body).digest('hex');bytes+=body.length;sources.set(file,source);if(!hashes.has(hash))hashes.set(hash,[]);hashes.get(hash).push(file);}
 for(const [file,source]of sources){
  const targets=[];
  for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/gu))if(match[1].startsWith('.')){const target=relative(directory,resolve(directory,dirname(file),match[1]));if(!sources.has(target))missingImports.push({file,specifier:match[1]});else targets.push(target);}
  edges.set(file,targets);
  for(const match of source.matchAll(/^import\s*\{([^}]+)\}\s*from[^;]+;/gmu)){
   const body=source.slice(0,match.index)+source.slice(match.index+match[0].length);
   for(const item of match[1].split(',')){const name=item.trim().split(/\s+as\s+/u).at(-1);if(name&&!new RegExp('\\b'+name+'\\b','u').test(body))unusedImportCandidates.push({file,name});}
  }
 }
 const seen=new Set();function visit(file){if(seen.has(file)||!edges.has(file))return;seen.add(file);for(const target of edges.get(file))visit(target);}visit('js/app.js');
 return {modules:files.length,bytes,exactDuplicateModules:[...hashes.values()].filter(group=>group.length>1),missingImports,unreachableModules:files.filter(file=>!seen.has(file)),unusedImportCandidates};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await auditRuntime(),null,2));
