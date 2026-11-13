/** Resettable Cloud template QA host. Loopback only, fictional accounts and MemoryStore.
 * Each /qa/template/<catalog-id> switches to its own fixture account so real site limits
 * remain intact while the actual dashboard creation flow is tested for every package.
 * Run: node tools/template-library-qa.mjs --local-only. Never deploy this entrypoint. */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from '../server/src/app.ts';
import { MemoryStore } from '../server/src/store.ts';
import { MemoryAuthStore } from '../server/src/auth.ts';
import { MemoryAssetStore } from '../server/src/assets.ts';
import { MemoryOwnedSiteStore } from '../server/src/accounts.ts';
import { MemoryHostedPublicationStore } from '../server/src/publications.ts';
import { FileSiteTemplateStore, latestSiteTemplates } from '../server/src/site-templates.ts';
import { TestHumanChallenge } from '../server/src/turnstile.ts';
import { FileSubmissionStore } from '../server/src/submissions.ts';

if (!process.argv.includes('--local-only') || process.env.NODE_ENV === 'production') {
  throw new Error('Explicit --local-only required; this is never a production server');
}
const port = 4945;
const templates = new FileSiteTemplateStore(new URL('../premade-sites/', import.meta.url).pathname);
const latest = latestSiteTemplates(await templates.list());
const fixtures = new Map(latest.map(template => [template.id, {
  authUserId: 'template-qa-' + template.id,
  email: template.id + '@example.invalid',
  name: 'Template QA · ' + template.sampleName,
}]));
let identity = fixtures.get('architecture-studio') || fixtures.values().next().value;
const unavailable = async () => { throw new Error('Real account operations are disabled in this local fixture'); };
const accountAuth = {
  identity: async () => identity, oauth: unavailable, signUp: unavailable, signIn: unavailable,
  confirm: unavailable, forgot: unavailable, reset: unavailable, updateEmail: unavailable,
  updatePassword: unavailable, signOut: unavailable,
};
const store = new MemoryStore(), auth = new MemoryAuthStore(), assets = new MemoryAssetStore();
const submissionRoot = await mkdtemp(join(tmpdir(), 'pagecraft-template-qa-'));
const app = createApp({
  store, auth, assets, accountAuth, ownedSites: new MemoryOwnedSiteStore(store, auth),
  publications: new MemoryHostedPublicationStore(), siteTemplates: templates,
  submissions: new FileSubmissionStore(submissionRoot),
  challenge: new TestHumanChallenge(), turnstileSiteKey: 'local-template-test-only',
  componentGallery: true, editorHost: 'localhost', editorOrigin: `http://localhost:${port}`,
  editorHtml: await readFile(new URL('../index.html', import.meta.url), 'utf8'),
});
const server = serve({ hostname: '127.0.0.1', port, fetch(request) {
  const url = new URL(request.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return new Response('Loopback only', { status: 403 });
  if (url.pathname.startsWith('/qa/template/')) {
    const selected = fixtures.get(url.pathname.slice('/qa/template/'.length));
    if (!selected) return new Response('Unknown fixture', { status: 404 });
    identity = selected;
    return new Response(null, { status: 303, headers: { location: '/' } });
  }
  const headers = new Headers(request.headers); headers.set('host', `localhost:${port}`);
  if (headers.get('origin') === `http://127.0.0.1:${port}`) headers.set('origin', `http://localhost:${port}`);
  const referer = headers.get('referer');
  if (referer?.startsWith(`http://127.0.0.1:${port}`)) headers.set('referer', referer.replace('127.0.0.1', 'localhost'));
  return app.fetch(new Request(request, { headers }));
}}, () => console.log(`Template library QA: http://127.0.0.1:${port}/ — five fictional fixture accounts, data resets on restart`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  server.close();
  await rm(submissionRoot, { recursive: true, force: true });
  process.exit(0);
});
