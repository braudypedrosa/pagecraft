import { test } from 'vitest';
import a from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
const entry = join(import.meta.dirname, '../src/reports-index.ts');

test('native reports startup requires the verified founder allowlist', async () => {
  await a.rejects(() => promisify(execFile)(process.execPath, [entry], {
    env: {...process.env, NODE_ENV:'production', REPORTS_HOST:'reports.test',
      REPORTS_ORIGIN:'https://reports.test', REPORTS_APP_ORIGIN:'',
      PAGECRAFT_REPORTS_CONFIG:'', PAGECRAFT_OWNER_AUTH_USER_IDS:''},
  }), error => /Reports requires a verified owner account allowlist/.test(String((error as {stderr?:string}).stderr)));
});

test('native reports process boots independently and rejects anonymous data without customer routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-reports-boot-'));
  const reservation = createServer();
  await new Promise<void>(resolve => reservation.listen(0,'127.0.0.1',resolve));
  const address = reservation.address();
  a.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(resolve => reservation.close(()=>resolve()));
  const processUnderTest = spawn(process.execPath, [entry], {env:{...process.env,
    NODE_ENV:'production', PORT:String(port), BIND_HOST:'127.0.0.1',
    REPORTS_HOST:'reports.test', REPORTS_ORIGIN:'https://reports.test', REPORTS_APP_ORIGIN:'',
    REPORTS_DATA_ENVIRONMENT:'unconfigured', PAGECRAFT_REPORTS_STORAGE_ROOT:root,
    PAGECRAFT_REPORTS_CONFIG:'', PAGECRAFT_OWNER_AUTH_USER_IDS:'123e4567-e89b-42d3-a456-426614174000',
    SUPABASE_URL:'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY:'disposable-test-only',
    DATABASE_GATEWAY_URL:'', DATABASE_GATEWAY_KEY:'', REPORTS_DATA_GATEWAY_URL:'', PADDLE_API_KEY:'', PADDLE_ENVIRONMENT:'sandbox',
  }});
  let diagnostic = '';
  processUnderTest.stderr.on('data',data=>{diagnostic+=String(data);});
  try {
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Reports native boot timed out: '+diagnostic)),6000);
      processUnderTest.stdout.on('data',data=>{if(String(data).includes('Private founder reports listening')){clearTimeout(timeout);resolve();}});
      processUnderTest.once('exit',code=>{clearTimeout(timeout);reject(new Error('Reports exited '+code+': '+diagnostic));});
    });
    // Native HTTP preserves the intended Host header for origin-isolation checks.
    const request=(path:string)=>new Promise<Response>((resolve,reject)=>{
      const outgoing=get({hostname:'127.0.0.1',port,path,headers:{host:'reports.test'}},incoming=>{
        const chunks:Buffer[]=[];
        incoming.on('data',chunk=>chunks.push(Buffer.from(chunk)));
        incoming.on('end',()=>{
          const headers=new Headers();
          for(const [key,value] of Object.entries(incoming.headers)){
            if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
          }
          resolve(new Response(Buffer.concat(chunks),{status:incoming.statusCode,headers}));
        });
        incoming.on('error',reject);
      });
      outgoing.on('error',reject);
      outgoing.setTimeout(5000,()=>outgoing.destroy(new Error('Reports request timed out')));
    });
    let response=await request('/api/crm/summary');
    a.equal(response.status,401);
    a.match(response.headers.get('cache-control') || '',/no-store/);
    a.deepEqual(await response.json(),{error:'authentication_required'});
    response=await request('/sign-in');
    a.equal(response.status,200);
    a.match(await response.text(),/Pagecraft HQ/);
    for(const path of ['/sign-up','/edit/example','/api/sites'])a.equal((await request(path)).status,404);
    response=await request('/brand/pagecraft-logo.svg');
    a.equal(response.status,200);
    a.match(response.headers.get('content-type') || '',/image\/svg/);
  } finally {
    const exited=new Promise<void>(resolve=>processUnderTest.once('exit',()=>resolve()));
    if(processUnderTest.exitCode===null){processUnderTest.kill('SIGTERM');await exited;}
    await rm(root,{recursive:true,force:true});
  }
});
