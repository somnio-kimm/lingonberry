import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('English form extraction excludes foreign-language homographs and table labels',()=>{
 const program=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('forms',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
rows=json.load(sys.stdin)
print(json.dumps([m.select_record(row,{'gift','gifts','went','glossary'},i,json.dumps(row).encode(),'source.jsonl.gz') for i,row in enumerate(rows,1)]))`;
 const rows=[
  {word:'gift',pos:'noun',lang_code:'en',forms:[{form:'gifts',tags:['plural']}]},
  {word:'Gift',pos:'noun',lang_code:'de',forms:[{form:'Gifte',tags:['plural']}]},
  {word:'go',pos:'verb',lang_code:'en',forms:[{form:'went',tags:['past']}]},
  {word:'unrelated',pos:'verb',lang_code:'en',forms:[{form:'glossary',tags:['inflection-template']}]},
  {word:'gift',pos:'noun',forms:[{form:'gifts',tags:['plural']}]},
 ];
 const result=JSON.parse(execFileSync('python3',['-c',program,fileURLToPath(new URL('../scripts/content/extract-english-forms.py',import.meta.url))],
  {input:JSON.stringify(rows),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
 assert.equal(result[0].word,'gift');assert.equal(result[0].language,'en');assert.equal(result[0].source.license,'CC-BY-SA-4.0');
 assert.equal(result[1],null);assert.equal(result[2].forms[0].form,'went');
 assert.equal(result[3],null);assert.equal(result[4],null);
});
