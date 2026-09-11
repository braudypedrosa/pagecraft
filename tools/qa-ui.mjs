/** Built-in-browser diagnostic server with fictional in-memory accounts/data.
 * Run: node tools/qa-ui.mjs. No Supabase, SMTP or production credentials are used.
 * It is deliberately loopback-only and must never be deployed as an app entrypoint. */
import {readFile} from 'node:fs/promises';
import {serve} from '@hono/node-server';
import {createApp} from '../server/src/app.ts';
import {MemoryStore} from '../server/src/store.ts';
import {MemoryAuthStore,hashToken} from '../server/src/auth.ts';
import {MemoryOwnedSiteStore} from '../server/src/accounts.ts';
import {TestHumanChallenge} from '../server/src/turnstile.ts';
import {blankDoc} from '../server/src/render.ts';
import {QA_SITE_NAME,uiFixtureDocument} from './fixtures/ui-site.ts';

const auth=new MemoryAuthStore(),store=new MemoryStore();
const identity={authUserId:'qa-ui-fictional-account',email:'qa-ui@example.invalid',name:'QA community workshop coordinator with a longer display name',providers:['email']};
const user=await auth.ensureAuthUser(identity.authUserId,identity.email,identity.name);
const token='local-fictional-ui-session';
await auth.putSession(hashToken(token),user.id,Date.now()+86400000);
for(const [name,slug,doc] of [
 [QA_SITE_NAME,'qa-ui-foundations',uiFixtureDocument()],
 ['QA Empty Site','qa-ui-empty',blankDoc('QA Empty Site')]
]){
 const site=await store.create({name,slug,host:`${slug}.example.invalid`,doc,savedBy:user.id});
 await auth.grant(site.id,user.id,'owner');
}
const unavailable=async()=>{throw new Error('Authentication changes are unavailable in this local UI fixture');};
const accountAuth={identity:async()=>identity,oauth:unavailable,signUp:unavailable,
 signIn:unavailable,confirm:unavailable,forgot:unavailable,reset:unavailable,
 updateEmail:unavailable,updatePassword:unavailable,signOut:unavailable};
const app=createApp({store,auth,accountAuth,ownedSites:new MemoryOwnedSiteStore(store,auth),
 challenge:new TestHumanChallenge(),turnstileSiteKey:'local-ui-fixture',
 componentGallery:true,editorHost:'localhost',editorOrigin:'http://localhost:4944',
 editorHtml:await readFile(new URL('../index.html',import.meta.url),'utf8')});
serve({hostname:'127.0.0.1',port:4944,fetch(request){
 const url=new URL(request.url);
 if(url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')return new Response('Loopback fixture only',{status:403});
 const headers=new Headers(request.headers);headers.set('host','localhost');headers.set('cookie',`pc_session=${token}`);
 return app.fetch(new Request(request,{headers}));
}},()=>console.log('Fictional UI fixtures: http://localhost:4944/ — data resets on restart'));
