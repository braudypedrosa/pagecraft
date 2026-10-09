import a from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test, vi } from 'vitest';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import { createFounderReportsApp } from '../src/founder-reports.ts';
import { founderCrmCsv } from '../src/founder-crm-routes.ts';
import { FileFounderCrmStore } from '../src/founder-crm-store.ts';
import type { CrmContactInput, CrmPlatformSnapshot } from '../src/founder-crm-types.ts';
import { FileOwnerCostStore } from '../src/owner-billing.ts';

const OWNER = '123e4567-e89b-42d3-a456-426614174000';
const OTHER = '123e4567-e89b-42d3-a456-426614174001';
const ACCOUNT = '123e4567-e89b-42d3-a456-426614174002';
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const identity = (id = OWNER): VerifiedIdentity => ({ authUserId:id, email:'founder@example.test', name:'Founder' });
const contact: CrmContactInput = { accountId:null, name:'Avery', email:'avery@example.test', company:'Example Studio', stage:'lead', source:'referral', notes:'Review pricing', followUpOn:'2026-10-09', isTest:false };
const snapshot: CrmPlatformSnapshot = {
  accounts:[{id:ACCOUNT,authUserId:OTHER,name:'Verified person',email:'verified@example.test',plan:'free',createdAt:'2026-10-01T00:00:00Z',ownedSites:1,publishedSites:1,mediaBytes:300,lastEditedAt:'2026-10-08T00:00:00Z'}],
  sites:[{id:'site-1',ownerIds:[ACCOUNT],name:'Example site',slug:'example',published:true,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-08T00:00:00Z'}],
  accountTotal:1,siteTotal:1,coverage:'complete',
};

async function rig() {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-crm-routes-')); roots.push(root);
  let current: VerifiedIdentity | null = identity();
  const contacts = new FileFounderCrmStore(join(root, 'contacts.json'));
  const costs = new FileOwnerCostStore(join(root, 'costs.json'));
  const platform = { snapshot:vi.fn(async () => structuredClone(snapshot)) };
  const app = createFounderReportsApp({host:'reports.test',origin:'http://reports.test',dataEnvironment:'staging',
    accountAuth:{identity:async () => current} as unknown as AccountAuth,
    billing:{ownerAuthUserIds:[OWNER],costs,now:() => new Date('2026-10-09T12:00:00Z')},crm:{platform,contacts},
  });
  const request = (path:string, init:RequestInit = {}) => app.request(new Request('http://reports.test'+path, {...init,headers:{host:'reports.test',...init.headers}}));
  const post = (fields:Record<string,string>, headers:Record<string,string> = {}) => request('/crm/contacts', {method:'POST',headers:{origin:'http://reports.test','content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(fields)});
  const fields = (patch:Record<string,string> = {}) => ({name:contact.name,email:contact.email,company:contact.company,stage:contact.stage,source:contact.source,notes:contact.notes,followUpOn:contact.followUpOn!,range:'90d',tests:'exclude',currency:'USD',returnSection:'pipeline',...patch});
  return {root,contacts,costs,platform,request,post,fields,setIdentity:(value:VerifiedIdentity|null) => { current=value; }};
}

test('all CRM pages and exports gate identity before reading private sources', async () => {
  const r=await rig();
  for(const current of [null,identity(OTHER)]) {
    r.setIdentity(current);
    for(const section of ['overview','customers','pipeline','revenue','costs','reports','sources']) {
      a.equal((await r.request('/'+section)).status,current ? 403 : 303);
    }
    for(const path of ['/api/crm/summary','/exports/customers.csv']) a.equal((await r.request(path)).status,current ? 403 : 401);
    a.equal((await r.post(r.fields())).status,current ? 403 : 303);
  }
  a.equal(r.platform.snapshot.mock.calls.length,0);
  a.deepEqual(await r.contacts.list(),[]);
  r.setIdentity(identity());
  for(const section of ['overview','customers','pipeline','revenue','costs','reports','sources']) {
    const response=await r.request('/'+section);
    a.equal(response.status,200,section);
    a.match(response.headers.get('cache-control') || '',/no-store/);
    a.match(await response.text(),/Pagecraft HQ/);
  }
  const legacy=await r.request('/owner/billing');
  a.equal(legacy.status,303); a.equal(legacy.headers.get('location'),'/overview');
});

test('contact writes reject cross-origin, oversized and malformed requests without mutation', async () => {
  const r=await rig();
  a.equal((await r.post(r.fields(),{origin:'https://elsewhere.test',authorization:'Bearer unrelated'})).status,403);
  a.equal((await r.post(r.fields({notes:'x'.repeat(17_000)}))).status,413);
  a.equal((await r.request('/crm/contacts',{method:'POST',headers:{origin:'http://reports.test','content-type':'application/json'},body:'{}'})).status,415);
  a.deepEqual(await r.contacts.list(),[]);
});

test('lead creation, revision edits, duplicate rejection and drafts retain selected filters', async () => {
  const r=await rig();
  let response=await r.post(r.fields());
  a.equal(response.status,303);
  a.equal(response.headers.get('location'),'/pipeline?range=90d&tests=exclude&message=contact_saved&currency=USD');
  const saved=(await r.contacts.list())[0];
  a.equal(saved.revision,1);
  response=await r.post(r.fields({id:saved.id,expectedRevision:'1',stage:'qualified',notes:'Updated notes'}));
  a.equal(response.status,303);
  response=await r.post(r.fields({id:saved.id,expectedRevision:'1',notes:'Unsaved stale draft'}));
  a.equal(response.status,409);
  let html=await response.text();
  a.match(html,/Unsaved stale draft/); a.match(html,/changed; reload/);
  a.match(html,/value="90d" selected/); a.match(html,/value="exclude" selected/);
  a.equal((await r.contacts.list())[0].notes,'Updated notes');
  response=await r.post(r.fields()); a.equal(response.status,422);
  html=await response.text(); a.match(html,/already exists/);
  response=await r.post(r.fields({email:'new@example.test',followUpOn:'2026-02-30',notes:'Retain my notes'}));
  a.equal(response.status,422); a.match(await response.text(),/Retain my notes/);
  a.equal((await r.contacts.list()).length,1);
});

test('linked account annotation uses verified identity and never accepts supplied profile fields', async () => {
  const r=await rig();
  let response=await r.post(r.fields({accountId:ACCOUNT,name:'Spoofed name',email:'spoofed@example.test'}));
  a.equal(response.status,303);
  const saved=(await r.contacts.list())[0];
  a.equal(saved.name,'Verified person'); a.equal(saved.email,'verified@example.test'); a.equal(saved.accountId,ACCOUNT);
  response=await r.post(r.fields({accountId:OTHER,email:'unknown@example.test'}));
  a.equal(response.status,422);
  a.equal((await r.contacts.list()).length,1);
  r.platform.snapshot.mockRejectedValue(new Error('internal gateway secret'));
  response=await r.post(r.fields({id:saved.id,expectedRevision:'1',accountId:ACCOUNT,notes:'Keep draft on outage'}));
  a.equal(response.status,503);
  const html=await response.text(); a.match(html,/Keep draft on outage/); a.doesNotMatch(html,/internal gateway secret/);
  a.equal((await r.contacts.list())[0].revision,1);
});

test('summary and customer export exclude marked tests and CSV protects spreadsheet text', async () => {
  const r=await rig();
  await r.contacts.put({...contact,name:'=HYPERLINK("bad")',company:'+formula',notes:'@command'});
  await r.contacts.put({...contact,name:'Internal',email:'internal@example.test',isTest:true});
  const summary=await r.request('/api/crm/summary?range=12m&tests=exclude');
  a.equal(summary.status,200);
  const data=await summary.json(); a.equal(data.range,'12m'); a.equal(data.includeTests,false); a.equal(data.customers.length,2);
  const response=await r.request('/exports/customers.csv?range=12m&tests=exclude&currency=USD');
  a.equal(response.status,200);
  a.equal(response.headers.get('x-report-test-records'),'excluded');
  a.equal(response.headers.get('x-report-currency'),'USD');
  a.match(response.headers.get('content-disposition') || '',/pagecraft-hq-customers-12m\.csv/);
  const csv=await response.text(); a.match(csv,/'=HYPERLINK/); a.match(csv,/'\+formula/); a.match(csv,/'@command/); a.doesNotMatch(csv,/internal@example\.test/);
  a.equal((await r.request('/exports/unknown.csv')).status,404);
  a.equal(founderCrmCsv([['quote " line\ntext','-command',-12]]),'\uFEFF"quote "" line\ntext","\'-command","-12"\r\n');
});

test('exports fail closed for unavailable sources instead of returning empty success files', async () => {
  const r=await rig();
  a.equal((await r.request('/exports/payments.csv')).status,503);
  r.platform.snapshot.mockRejectedValue(new Error('private source path'));
  a.equal((await r.request('/exports/customers.csv')).status,503);
  a.equal((await r.request('/exports/metrics.csv')).status,503);
  const response=await r.request('/overview'); a.equal(response.status,200);
  const html=await response.text(); a.match(html,/Unavailable|unavailable/); a.doesNotMatch(html,/private source path/);
});

test('monthly budget writes return to the CRM costs screen preserving the viewing context', async () => {
  const r=await rig();
  const response=await r.request('/owner/billing/costs?range=90d&tests=exclude&currency=PHP',{method:'POST',headers:{origin:'http://reports.test','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'Hosting',category:'hosting',amount:'25.00',currencyCode:'USD'})});
  a.equal(response.status,303);
  a.equal(response.headers.get('location'),'/costs?message=saved&range=90d&tests=exclude&currency=PHP');
  await r.costs.put({label:'Other currency',category:'email',amountMinor:'1000',currencyCode:'PHP'});
  const csv=await (await r.request('/exports/budgets.csv?currency=PHP')).text();
  a.match(csv,/Other currency/); a.doesNotMatch(csv,/Hosting/);
});
