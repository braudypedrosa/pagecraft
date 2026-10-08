/** Resettable, loopback-only Free/Pro account fixture. Never deploy this entrypoint. */
import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { createApp } from '../server/src/app.ts';
import { MemoryAuthStore } from '../server/src/auth.ts';
import { MemoryStore } from '../server/src/store.ts';
import { MemoryAssetStore } from '../server/src/assets.ts';
import { MemoryOwnedSiteStore } from '../server/src/accounts.ts';
import { blankDoc } from '../server/src/render.ts';

if (!process.argv.includes('--local-only') || process.env.NODE_ENV === 'production') {
  throw new Error('Explicit --local-only required; never a production server');
}
class FixtureAuth extends MemoryAuthStore {
  plans = new Map();
  async userById(id) {
    const user = await super.userById(id);
    return user ? { ...user, plan: this.plans.get(id) || user.plan } : null;
  }
  async ensureAuthUser(id, email, name = '') {
    const user = await super.ensureAuthUser(id, email, name);
    return { ...user, plan: this.plans.get(user.id) || user.plan };
  }
}
const fixtures = new Map(['free', 'pro'].map(plan => [plan, {
  authUserId: `quota-fixture-${plan}`, email: `${plan}@example.invalid`, name: `Plan QA · ${plan === 'pro' ? 'Pro' : 'Free'}`,
}]));
let identity = fixtures.get('pro');
const unavailable = async () => { throw new Error('Real account operations disabled'); };
const accountAuth = { identity: async () => identity, oauth: unavailable, signUp: unavailable,
  signIn: unavailable, confirm: unavailable, forgot: unavailable, reset: unavailable,
  updateEmail: unavailable, updatePassword: unavailable, signOut: unavailable };
const auth = new FixtureAuth(), store = new MemoryStore(), assets = new MemoryAssetStore();
const ownedSites = new MemoryOwnedSiteStore(store, auth);
for (const [plan, fixture] of fixtures) {
  const owner = await auth.ensureAuthUser(fixture.authUserId, fixture.email, fixture.name);
  auth.plans.set(owner.id, plan);
  for (let i = 0; i < (plan === 'pro' ? 4 : 3); i++) await ownedSites.create({
    ownerId: owner.id, host: `${plan}-${i}.invalid`, name: `${plan.toUpperCase()} QA ${i + 1}`, doc: blankDoc(`QA ${i + 1}`),
  });
}
const port = 4946;
const app = createApp({ store, auth, assets, accountAuth, ownedSites,
  componentGallery: true, editorHost: 'localhost', editorOrigin: `http://localhost:${port}`,
  editorHtml: await readFile(new URL('../index.html', import.meta.url), 'utf8'),
});
const server = serve({ hostname: '127.0.0.1', port, fetch(request) {
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) return new Response('Loopback only', { status: 403 });
  if (url.pathname.startsWith('/qa/plan/')) {
    const selected = fixtures.get(url.pathname.slice('/qa/plan/'.length));
    if (!selected) return new Response('Unknown fixture', { status: 404 });
    identity = selected;
    return new Response(null, { status: 303, headers: { location: '/account?tab=plan' } });
  }
  const headers = new Headers(request.headers); headers.set('host', `localhost:${port}`);
  if (headers.get('origin') === `http://127.0.0.1:${port}`) headers.set('origin', `http://localhost:${port}`);
  return app.fetch(new Request(request, { headers }));
}}, () => console.log(`Plan QA: http://127.0.0.1:${port}/ — fictional accounts; resets on restart`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); process.exit(0); });
