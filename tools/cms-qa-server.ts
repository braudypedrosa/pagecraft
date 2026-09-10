/** Isolated local Cloud host; real HTTP routes and storage contracts, fixture identity. */
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server/src/app.ts';
import { MemoryStore } from '../server/src/store.ts';
import { MemoryAuthStore } from '../server/src/auth.ts';
import { MemoryAssetStore } from '../server/src/assets.ts';
import { MemoryOwnedSiteStore } from '../server/src/accounts.ts';
import { FileHostedPublicationStore } from '../server/src/publications.ts';
import { validatePortablePackage } from '../server/src/portable-packages.ts';
import { cmsPilot } from './cms-pilot.ts';
import type { AccountAuth } from '../server/src/account-auth.ts';
if (
  !process.argv.includes('--local-only') ||
  process.env.NODE_ENV === 'production'
)
  throw new Error('Local QA only');
const port = Number(process.env.CMS_QA_PORT || 4940);
const store = new MemoryStore(),
  auth = new MemoryAuthStore(),
  assets = new MemoryAssetStore();
const identity = {
  authUserId: 'cms-qa-local',
  email: 'cms-qa@example.invalid',
  name: 'CMS QA',
};
const owner = await auth.ensureAuthUser(
  identity.authUserId,
  identity.email,
  identity.name,
);
const pkg = validatePortablePackage(
  await readFile('premade-sites/stillwood/1.0.0/site.pagecraft-site.zip'),
);
const site = await store.create({
  name: 'Stillwood CMS QA',
  host: 'cms-qa.test',
  slug: 'stillwood-cms-qa',
  doc: cmsPilot(pkg.document),
  savedBy: owner.id,
});
await auth.grant(site.id, owner.id, 'owner');
for (const f of pkg.manifest.files.filter((f) => f.role === 'asset'))
  await assets.put({
    id: f.asset!.id,
    siteId: site.id,
    name: f.asset!.name,
    type: f.mediaType,
    w: f.asset!.width,
    h: f.asset!.height,
    bytes: pkg.files.get(f.path)!,
  });
const accountAuth: AccountAuth = {
  identity: async () => identity,
  oauth: async () => null,
  signUp: async () => 'confirmation_required',
  signIn: async () => identity,
  confirm: async () => identity,
  forgot: async () => {},
  reset: async () => false,
  updateEmail: async () => false,
  updatePassword: async () => false,
  signOut: async () => {},
};
const app = createApp({
  store,
  auth,
  assets,
  accountAuth,
  ownedSites: new MemoryOwnedSiteStore(store, auth),
  editorHost: 'localhost',
  editorOrigin: `http://localhost:${port}`,
  editorHtml: await readFile('index.html', 'utf8'),
  publications: new FileHostedPublicationStore(
    '.pagecraft-local/cms-qa/publications',
  ),
});
let failNextSave = process.env.CMS_QA_FAIL_FIRST_SAVE === '1';
const saveDelay = Math.min(15000, Math.max(0, Number(process.env.CMS_QA_SAVE_DELAY_MS) || 0));
serve({
  fetch: async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/qa-viewport') {
      const width = Number(url.searchParams.get('width'));
      if (![390, 768, 1280].includes(width))
        return new Response('Unsupported QA viewport', { status: 400 });
      return new Response(
        `<meta charset="utf-8"><title>CMS QA — ${width}px</title><style>body{margin:0;background:#ddd}iframe{display:block;border:0;width:${width}px;height:900px}</style><iframe title="CMS responsive QA" src="/edit/${site.id}"></iframe>`,
        { headers: { 'content-type': 'text/html' } },
      );
    }
    if (request.method === 'PUT' && url.pathname === `/api/sites/${site.id}`) {
      if (saveDelay) await new Promise(resolve => setTimeout(resolve, saveDelay));
      if (failNextSave) {
        failNextSave = false;
        return Response.json({error: 'qa_save_unavailable', detail: 'QA save failure. Please retry.'}, {status: 500});
      }
    }
    const response = await app.fetch(request);
    // Local-only iframe harness for real CSS viewport checks; production CSP is unchanged.
    if (url.pathname.startsWith('/edit/')) {
      const headers = new Headers(response.headers);
      headers.set(
        'content-security-policy',
        "frame-ancestors 'self'; base-uri 'none'; object-src 'none'",
      );
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  },
  port,
  hostname: '127.0.0.1',
});
console.log(`CMS QA http://localhost:${port}/edit/${site.id}`);
