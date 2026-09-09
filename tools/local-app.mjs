import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {randomBytes, createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import pg from 'pg';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const dir = join(root,'.pagecraft-local','development');
mkdirSync(dir,{recursive:true,mode:0o700});
// Never inherit production destinations or release credentials in local development.
const env = Object.fromEntries(Object.entries(process.env).filter(([k])=>! /^(DATABASE_|SUPABASE_|PAGECRAFT_|EDITOR_|TURNSTILE_|SMTP_|OWNER_EMAIL|CLIENT_EMAIL|NODE_ENV|PORT$)/.test(k)));
const run = (cmd,args,options={})=>execFileSync(cmd,args,{cwd:root,env,stdio:'inherit',...options});
run('docker',['info'],{stdio:'ignore'});
run(process.execPath,['build.mjs']);
run('supabase',['start']);
const status = JSON.parse(run('supabase',['status','-o','json'],{stdio:['ignore','pipe','ignore'],encoding:'utf8'}));
for (const name of ['API_URL','DB_URL']) {
 const url = new URL(status[name]);
 if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error(`Refusing non-local ${name}`);
}
const keyFile = join(dir,'gateway-key');
if (!existsSync(keyFile)) writeFileSync(keyFile,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
const key=readFileSync(keyFile,'utf8').trim();
const client=new pg.Client({connectionString:status.DB_URL});
await client.connect();
try { await client.query("insert into public.gateway_config (id,secret_hash) values ('primary',$1) on conflict(id) do update set secret_hash=excluded.secret_hash",[createHash('sha256').update(key).digest('hex')]); }
finally { await client.end(); }
const origin='http://localhost:8787';
const functionEnv=join(dir,'functions.env');
writeFileSync(functionEnv,`PAGECRAFT_EDITOR_ORIGIN=${origin}\n`,{mode:0o600});
const children=[];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');process.exitCode=code;}
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>stop());
const functions=spawn('supabase',['functions','serve','--env-file',functionEnv],{cwd:root,env,stdio:'inherit'});
children.push(functions);
functions.on('exit',code=>{if(!stopping)stop(code||1);});
const localEnv={...env,NODE_ENV:'development',PORT:'8787',BIND_HOST:'127.0.0.1',EDITOR_HOST:'localhost',EDITOR_ORIGIN:origin,
 DATABASE_GATEWAY_URL:status.API_URL+'/functions/v1/pagecraft-db',DATABASE_GATEWAY_KEY:key,
 SUPABASE_URL:status.API_URL,SUPABASE_PUBLISHABLE_KEY:status.PUBLISHABLE_KEY||status.ANON_KEY,
 PAGECRAFT_AUTH_TEST_MODE:'1',TURNSTILE_SITE_KEY:'1x00000000000000000000AA',PAGECRAFT_PUBLICATION_ROOT:join(dir,'publications')};
let ready=false;
for(let i=0;i<30;i++){
 try {const r=await fetch(localEnv.DATABASE_GATEWAY_URL,{method:'POST',headers:{'content-type':'application/json','x-pagecraft-gateway-key':key},body:JSON.stringify({op:'site.listMeta',args:{}})}); if(r.ok){ready=true;break;}} catch{}
 await new Promise(r=>setTimeout(r,1000));
}
if(!ready){stop(1);throw new Error('Local gateway did not become ready. See function logs.');}
console.log(`\nPagecraft local: ${origin}\nLocal confirmation email inbox: ${status.INBUCKET_URL||'http://127.0.0.1:55424'}\nCtrl+C stops the app; Supabase keeps its data.\n`);
const app=spawn(process.execPath,['server/src/index.ts'],{cwd:root,env:localEnv,stdio:'inherit'});
children.push(app);app.on('exit',code=>{if(!stopping)stop(code||0);});
