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

test('Google linking uses the authenticated Supabase operation and only commits cookies for the same linked user', async () => {
  const adapter = new SupabaseAccountAuth({url:'https://example.invalid',publishableKey:'test',secureCookies:false});
  const redirectTo = 'https://pagecraft.test/auth/confirm?link=google';
  const url = 'https://accounts.example.test/choose';
  let available = true;
  let cookieWrites = 0;
  const user = {
    id: 'original', email: 'casey@example.test', email_confirmed_at: '2026-11-01',
    app_metadata: { providers: ['email', 'google'] }, identities: [{ provider: 'email' }],
  };
  Object.defineProperty(adapter, 'client', {value: (_c: Context, stage?: (apply: () => void) => void) => ({auth: {
    linkIdentity: async (input: unknown) => {
      assert.deepEqual(input, { provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
      return available ? { data: { url }, error: null } : { data: { url: null }, error: { code: 'manual_linking_disabled' } };
    },
    exchangeCodeForSession: async (code: string, options: { flowId?: string }) => {
      assert.equal(code, 'return-code');
      assert.equal(options.flowId, 'profile-flow');
      stage!(() => { cookieWrites++; });
      return { data: { user }, error: null };
    },
  }})});
  const c = {} as Context;
  assert.equal(await adapter.oauth(c, { provider: 'google', link: true, redirectTo }), url);
  available = false;
  assert.equal(await adapter.oauth(c, { provider: 'google', link: true, redirectTo }), null);
  const confirm = () => adapter.confirm(c, { code: 'return-code', linkUserId: 'original', flowId: 'profile-flow' });
  assert.equal(await confirm(), null, 'provider metadata alone does not confirm a linked Google identity');
  user.identities.push({ provider: 'google' });
  user.id = 'different';
  assert.equal(await confirm(), null);
  assert.equal(cookieWrites, 0, 'a different session must never replace the signed-in account');
  user.id = 'original';
  assert.equal((await confirm())?.authUserId, 'original');
  assert.equal(cookieWrites, 1);
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

/* A fake Auth client: getClaims stands for the local signature check, getUser for the network
   round trip. `session` picks the session_id inside the verified token. */
function authRig() {
  let clock = 1_000_000;
  const adapter = new SupabaseAccountAuth({url:'https://example.invalid',publishableKey:'test',secureCookies:false,now:()=>clock});
  const s = {userCalls:0, claimCalls:0, confirmed:true, failed:false, invalid:false, session:'session-a', sub:'user', userId:'user'};
  Object.defineProperty(adapter,'client',{value:()=>({auth:{
    getClaims:async()=>{ s.claimCalls++; return s.invalid ? {data:null,error:new Error('bad signature')} : {data:{claims:{sub:s.sub,session_id:s.session}},error:null}; },
    getUser:async()=>{ s.userCalls++; return {data:{user:{id:s.userId,email:'qa@example.test',email_confirmed_at:s.confirmed?'2026-09-10':null,user_metadata:{name:'QA'}}},error:s.failed?new Error('revoked'):null}; },
    updateUser:async()=>({data:{user:{id:s.sub}},error:null}),
    signOut:async()=>({error:null}),
  }})});
  return {adapter, s, advance:(ms:number)=>{clock+=ms;}};
}

test('identity rejects unverified, failed, mismatched or locally invalid sessions', async () => {
  const {adapter, s} = authRig();
  assert.equal((await adapter.identity({} as Context))?.authUserId,'user');
  s.session='session-b'; s.confirmed=false; assert.equal(await adapter.identity({} as Context),null);
  s.session='session-c'; s.confirmed=true; s.failed=true; assert.equal(await adapter.identity({} as Context),null);
  s.session='session-d'; s.failed=false; s.userId='someone-else'; assert.equal(await adapter.identity({} as Context),null,'token subject must match the Auth user');
  const before=s.userCalls; s.invalid=true;
  assert.equal(await adapter.identity({} as Context),null);
  assert.equal(s.userCalls,before,'an invalid token never reaches Auth');
});

test('a verified session asks Auth once per five minutes, not on every request', async () => {
  const {adapter, s, advance} = authRig();
  for (let i=0;i<6;i++) assert.equal((await adapter.identity({} as Context))?.email,'qa@example.test');
  assert.equal(s.userCalls,1); assert.equal(s.claimCalls,6,'the token is still checked on every request');
  advance(4*60*1000); await adapter.identity({} as Context); assert.equal(s.userCalls,1);
  advance(61*1000); s.failed=true;
  assert.equal(await adapter.identity({} as Context),null,'after the TTL a revoked session is refused');
  assert.equal(s.userCalls,2);
});

test('sign-out and account changes on this server forget the cached session at once', async () => {
  for (const action of ['signOut','signOutEverywhere','updatePassword','updateEmail','reset'] as const) {
    const {adapter, s} = authRig();
    await adapter.identity({} as Context); assert.equal(s.userCalls,1);
    if (action==='updatePassword') await adapter.updatePassword({} as Context,{password:'new-test-password'});
    else if (action==='updateEmail') await adapter.updateEmail({} as Context,{email:'new@example.test',redirectTo:'https://example.invalid'});
    else if (action==='reset') await adapter.reset({} as Context,'new-test-password');
    else await adapter[action]!({} as Context);
    await adapter.identity({} as Context);
    assert.equal(s.userCalls,2,`${action} must send the next request back to Auth`);
  }
});
