import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { SupabaseAccountAuth } from '../src/account-auth.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GatewayStore, GatewayAssetStore, PagecraftGateway, GatewayHostedPublishPreparer } from '../src/store-gateway.ts';

test('review evidence: current password is sent under an unsupported attribute', async () => {
  const adapter = new SupabaseAccountAuth({url:'https://example.invalid',publishableKey:'test',secureCookies:false});
  let sent: Record<string, unknown> = {};
  (adapter as any).client = () => ({auth:{updateUser:async (body:any) => {sent=body; return {error:null};}}});
  await adapter.updatePassword({} as any,{password:'new-test-password',currentPassword:'old-test-password'});
  assert.equal(sent.current_password, undefined);
  assert.equal(sent.currentPassword, 'old-test-password');
});

test('review evidence: a stale cached unchanged publish rolls public release backwards without database authorization', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pc-review-publications-'));
  const publications = new FileHostedPublicationStore(root);
  const common = {siteId:'review-site',slug:'review-site',host:'review.invalid',files:[{path:'index.html',mediaType:'text/html',bytes:new TextEncoder().encode('<h1>Review fixture</h1>')}]};
  const old = await publications.create({...common,sourceVersion:2});
  const newer = await publications.create({...common,sourceVersion:3});
  await publications.promote(newer);
  const identity = {authUserId:'review-user',email:'review@example.test',name:'Review'};
  let databaseChecks = 0;
  const oldSite = {id:'review-site',slug:'review-site',host:'review.invalid',name:'Review',version:2,publishedVersion:2,publishedPublicationId:old.id,publishedReleaseId:null,updatedAt:'2026-09-08T00:00:00Z',doc:{}};
  const wireSite = {id:oldSite.id,slug:oldSite.slug,host:oldSite.host,name:oldSite.name,doc:oldSite.doc,version:2,published_version:2,published_publication_id:old.id,published_release_id:null,updated_at:oldSite.updatedAt};
  const gateway = new PagecraftGateway('https://example.invalid','test',async () => {
    databaseChecks++;
    return Response.json({data:{status:'ok',role:'owner',user:{id:'review-user',auth_user_id:'review-user',email:identity.email,name:'Review',created_at:oldSite.updatedAt},site:wireSite,revision:null,assets:[]}});
  });
  const gatewayStore = new GatewayStore(gateway);
  const mutations = new GatewayHostedPublishPreparer(gateway,gatewayStore,new GatewayAssetStore(gateway));
  await mutations.prepare({siteId:'review-site',identity});
  // Another worker has published version 3; this worker still caches version 2.
  databaseChecks = 0;
  const app = createApp({store:gatewayStore,auth:new MemoryAuthStore(),publications,editorHost:'admin.test',editorOrigin:'http://admin.test',accountAuth:{identity:async()=>identity} as any,
    hostedPublish:mutations,cloudMutations:mutations});
  const result = await app.request('http://admin.test/api/sites/review-site/publish',{method:'POST',headers:{host:'admin.test',origin:'http://admin.test','content-type':'application/json'},body:JSON.stringify({sourceVersion:2})});
  assert.equal(result.status,200);
  assert.equal((await result.json()).status,'unchanged');
  assert.equal(databaseChecks,0);
  assert.equal((await publications.currentBySlug('review-site'))?.sourceVersion,2);
  await rm(root,{recursive:true,force:true});
});
