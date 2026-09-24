import {test} from 'node:test';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ts from 'typescript';

test('emitted ElevenLabs handlers load in native Node ESM and reject anonymous requests',async()=>{
 const root=resolve('verification-output');await mkdir(root,{recursive:true});
 const folder=await mkdtemp(join(root,'server-runtime-'));
 try {
  for(const file of ['server/auth.ts','api/elevenlabs/status.ts','api/elevenlabs/voices.ts','api/elevenlabs/generate.ts']){
   const output=join(folder,file.replace(/\.ts$/,'.js'));
   await mkdir(resolve(output,'..'),{recursive:true});
   const source=await readFile(file,'utf8');
   await writeFile(output,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  await writeFile(join(folder,'check.mjs'),`
    import assert from 'node:assert/strict';
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY='test-public-key';
    for(const name of ['status','voices','generate']){
      const {default:handler}=await import('./api/elevenlabs/'+name+'.js');
      let status;
      const res={status(code){status=code;return this;},json(){return this;},setHeader(){}};
      await handler({method:name==='generate'?'POST':'GET',headers:{}},res);
      assert.equal(status,401,name+' must load and require sign-in');
    }
  `);
  await promisify(execFile)(process.execPath,[join(folder,'check.mjs')],{timeout:15000});
 }finally{await rm(folder,{recursive:true,force:true});}
});
