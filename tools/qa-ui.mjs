/** Built-in-browser diagnostic server with fictional in-memory accounts/data.
 * Run: node tools/qa-ui.mjs. No Supabase, SMTP or production credentials are used.
 * It is deliberately loopback-only and must never be deployed as an app entrypoint. */
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serve} from '@hono/node-server';
import {createApp} from '../server/src/app.ts';
import {MemoryAssetStore} from '../server/src/assets.ts';
import {MemoryStore} from '../server/src/store.ts';
import {MemoryAuthStore,hashToken} from '../server/src/auth.ts';
import {MemoryOwnedSiteStore} from '../server/src/accounts.ts';
import {MemoryHostedPublicationStore} from '../server/src/publications.ts';
import {MemoryPublicationScheduleStore} from '../server/src/schedules.ts';
import {MemoryLibraryStore} from '../server/src/libraries.ts';
import {AnalyticsRecorder,FileAnalyticsStore,emptyBucket} from '../server/src/analytics.ts';
import {FileAssistantStore,FileOAuthStore} from '../server/src/assistants.ts';
import {TestHumanChallenge} from '../server/src/turnstile.ts';
import {blankDoc} from '../server/src/render.ts';
import {QA_SITE_NAME,uiFixtureDocument} from './fixtures/ui-site.ts';

const auth=new MemoryAuthStore(),store=new MemoryStore(),assets=new MemoryAssetStore();
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
 if(slug==='qa-ui-foundations')for(const name of ['Workshop.png','Community-workshop-accessibility-review-and-event-photography-with-a-long-filename.png','Portrait.png']) {
  await assets.put({siteId:site.id,name,type:'image/svg+xml',w:320,h:240,
   bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#f1f3f5"/><circle cx="160" cy="120" r="60" fill="#b7f34a"/></svg>'),tags:['QA fixture']});
 }
}
/* Analytics in a throwaway directory, with a month of invented counts for the foundations site so
   the Analytics page has something to show. The empty site stays off. */
const analytics=new AnalyticsRecorder(new FileAnalyticsStore(await mkdtemp(join(tmpdir(),'pagecraft-qa-analytics-'))));
{
 const foundations=(await store.list()).find(site=>site.slug==='qa-ui-foundations');
 if(foundations){
  await analytics.store.setEnabled(foundations.id,true,user.id);
  for(let back=29;back>=0;back--){
   const day=new Date(Date.now()-back*86400000).toISOString().slice(0,10);
   const views=18+((back*37)%23)+(back%7===2?14:0);
   const bucket={...emptyBucket(),views,clicks:Math.round(views*.28),forms:back%4===0?2:back%5===0?1:0,
    pages:{'/':Math.round(views*.52),'/workshops':Math.round(views*.27),'/accessibility-resources':views-Math.round(views*.52)-Math.round(views*.27)},
    referrers:{'(direct)':Math.round(views*.46),'community-news.example':Math.round(views*.31),'search.example':views-Math.round(views*.46)-Math.round(views*.31)},
    devices:{desktop:Math.round(views*.58),mobile:views-Math.round(views*.58)-Math.round(views*.07),tablet:Math.round(views*.07)},
    actions:{'Register for a workshop\t/workshops':Math.round(views*.18),'Accessibility guide\tguides.example':Math.round(views*.1)},
    formIds:{}};
   bucket.formIds=bucket.forms?{'qa-contact':bucket.forms}:{};
   await analytics.store.writeOwn(foundations.id,day,{hours:{'14':bucket}});
  }
 }
}
const unavailable=async()=>{throw new Error('Authentication changes are unavailable in this local UI fixture');};
const accountAuth={identity:async()=>identity,oauth:unavailable,signUp:unavailable,
 signIn:unavailable,confirm:unavailable,forgot:unavailable,reset:unavailable,
 updateEmail:unavailable,updatePassword:unavailable,signOut:unavailable};
// In-memory publications and schedules let review previews and scheduling run locally.
const app=createApp({store,auth,assets,accountAuth,ownedSites:new MemoryOwnedSiteStore(store,auth),
 publications:new MemoryHostedPublicationStore(),schedules:new MemoryPublicationScheduleStore(),libraries:new MemoryLibraryStore(),analytics,
 ...await (async()=>{const dir=await mkdtemp(join(tmpdir(),'pagecraft-qa-assistants-'));return {assistants:new FileAssistantStore(dir),assistantOAuth:new FileOAuthStore(dir)};})(),
 challenge:new TestHumanChallenge(),turnstileSiteKey:'local-ui-fixture',
 componentGallery:true,editorHost:'localhost',editorOrigin:'http://localhost:4944',
 editorHtml:await readFile(new URL('../index.html',import.meta.url),'utf8')});
serve({hostname:'127.0.0.1',port:4944,fetch(request){
 const url=new URL(request.url);
 if(url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')return new Response('Loopback fixture only',{status:403});
 const headers=new Headers(request.headers);headers.set('host','localhost');headers.set('cookie',`pc_session=${token}`);
 const origin=headers.get('origin')||'';
 if(origin==='http://127.0.0.1:4944')headers.set('origin','http://localhost:4944');
 const referer=headers.get('referer')||'';
 if(referer.startsWith('http://127.0.0.1:4944'))headers.set('referer',referer.replace('http://127.0.0.1:4944','http://localhost:4944'));
 return app.fetch(new Request(request,{headers}));
}},()=>console.log('Fictional UI fixtures: http://localhost:4944/ — data resets on restart'));
