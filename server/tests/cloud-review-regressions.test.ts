import { test, onTestFinished } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Context } from 'hono';
import { createApp } from '../src/app.ts';
import { SupabaseAccountAuth, type AccountAuth } from '../src/account-auth.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';
import { GatewayStore, GatewayAssetStore, PagecraftGateway, GatewayHostedPublishPreparer } from '../src/store-gateway.ts';

for (const rejected of [false, true]) {
  test(`password changes send current_password and propagate provider ${rejected ? 'failure' : 'success'}`, async () => {
    const adapter = new SupabaseAccountAuth({url:'https://example.invalid',publishableKey:'test',secureCookies:false});
    let sent: Record<string, unknown> = {};
    // Replace only the provider client; exercise the actual production adapter mapping.
    Object.defineProperty(adapter, 'client', {value: () => ({auth:{updateUser:async (body:Record<string,unknown>) => {
      sent=body; return {error:rejected ? {message:'Current password is incorrect'} : null};
    }}})});
    assert.equal(await adapter.updatePassword({} as Context,{password:'new-test-password',currentPassword:'old-test-password'}), !rejected);
    assert.deepEqual(sent,{password:'new-test-password',current_password:'old-test-password'});
  });
}

test('setting a first password does not invent a current-password value', async () => {
  const adapter = new SupabaseAccountAuth({url:'https://example.invalid',publishableKey:'test',secureCookies:false});
  let sent: unknown;
  Object.defineProperty(adapter,'client',{value:()=>({auth:{updateUser:async(body:unknown)=>{sent=body;return {error:null};}}})});
  assert.equal(await adapter.updatePassword({} as Context,{password:'first-test-password'}),true);
  assert.deepEqual(sent,{password:'first-test-password'});
});

async function publicationRig() {
  const root = await mkdtemp(join(tmpdir(),'pc-publish-regression-'));
  onTestFinished(()=>rm(root,{recursive:true,force:true}));
  const publications = new FileHostedPublicationStore(root);
  const common = {siteId:'review-site',slug:'review-site',host:'review.invalid',files:[{path:'index.html',mediaType:'text/html',bytes:new TextEncoder().encode('<h1>Fixture</h1>')}]};
  const old = await publications.create({...common,sourceVersion:2});
  const newer = await publications.create({...common,sourceVersion:3});
  const identity = {authUserId:'review-auth',email:'review@example.test',name:'Review'};
  const row = {id:'review-site',slug:'review-site',host:'review.invalid',name:'Review',doc:{},version:2,published_version:2,published_publication_id:old.id,published_release_id:null,updated_at:'2026-09-08T00:00:00Z'};
  let status = 'ok';
  let databaseChecks = 0;
  const gateway = new PagecraftGateway('https://gateway.invalid','test-key',async()=>{
    databaseChecks++;
    return Response.json({data:status==='ok' ? {status,role:'owner',user:{id:'review-user',auth_user_id:identity.authUserId,email:identity.email,name:'Review',created_at:row.updated_at},site:row,revision:null,assets:[]} : {status}});
  });
  const store = new GatewayStore(gateway);
  const mutations = new GatewayHostedPublishPreparer(gateway,store,new GatewayAssetStore(gateway));
  await mutations.prepare({siteId:row.id,identity}); // Warm the real four-hour owner/site cache.
  databaseChecks=0;
  const app = createApp({store,auth:new MemoryAuthStore(),publications,editorHost:'admin.test',editorOrigin:'http://admin.test',accountAuth:{identity:async()=>identity} as unknown as AccountAuth,hostedPublish:mutations,cloudMutations:mutations});
  return {publications,old,newer,row,setStatus:(value:string)=>{status=value;},checks:()=>databaseChecks,
    publish:()=>app.request('http://admin.test/api/sites/review-site/publish',{method:'POST',headers:{host:'admin.test',origin:'http://admin.test','content-type':'application/json'},body:JSON.stringify({sourceVersion:2})})};
}

test('stale cached publish returns conflict and keeps the newer public release',async()=>{
  const r=await publicationRig();
  await r.publications.promote(r.newer);
  r.row.version=3; r.row.published_version=3; r.row.published_publication_id=r.newer.id;
  const response=await r.publish();
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'stale_source_version');
  assert.equal(r.checks(),1);
  assert.equal((await r.publications.currentBySlug('review-site'))?.id,r.newer.id);
});

for (const [status,code] of [['forbidden',403],['missing',404]] as const) {
  test(`cached owner cannot publish after authoritative ${status}`,async()=>{
    const r=await publicationRig();
    await r.publications.promote(r.newer);
    r.setStatus(status);
    assert.equal((await r.publish()).status,code);
    assert.equal(r.checks(),1);
    assert.equal((await r.publications.currentBySlug('review-site'))?.id,r.newer.id);
  });
}

test('fresh unchanged publish still repairs an absent filesystem pointer',async()=>{
  const r=await publicationRig();
  const response=await r.publish();
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,'unchanged');
  assert.equal(r.checks(),1);
  assert.equal((await r.publications.currentBySlug('review-site'))?.id,r.old.id);
});
