/* Disposable, loopback-only review environment. No hosted account or database is used. */
import { serve } from '@hono/node-server';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createApp } from '../server/src/app.ts';
import { MemoryStore } from '../server/src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../server/src/auth.ts';
import { TemplateDraftStore } from '../server/src/template-draft-store.ts';
import { TemplateAuthorGrants } from '../server/src/template-authoring-grants.ts';

const port = Number(process.env.PAGECRAFT_REVIEW_PORT || 4398);
const origin = `http://127.0.0.1:${port}`;
const root = await mkdtemp(join(tmpdir(), 'pagecraft-template-review-'));
const auth = new MemoryAuthStore();
const owner = await auth.createUser('owner@example.test', 'Template Workshop');
const session = newToken();
await auth.putSession(hashToken(session), owner.id, Date.now() + 12 * 60 * 60_000);
const drafts = new TemplateDraftStore({ root, environment: 'test' }); await drafts.init();
const grants = new TemplateAuthorGrants(join(root, 'grants'), 'test', `${origin}/mcp/template-authoring`, [owner.id]);
const { token } = await grants.create(owner.id, 'Template review');
const connectionPath = '/tmp/pagecraft-template-review-connection.json';
await writeFile(connectionPath, JSON.stringify({ root, origin, token }), { mode: 0o600 });
const app = createApp({ store: new MemoryStore(), auth, templateAuthoring: { store: drafts, grants },
  componentGallery: true, editorOrigin: origin, editorHost: '127.0.0.1', editorHtml: await readFile(resolve('index.html'), 'utf8') });
serve({ port, hostname: '127.0.0.1', fetch: request => {
  const url = new URL(request.url);
  if (url.pathname === '/review-session') return new Response(null, { status: 303,
    headers: { location: '/owner/template-drafts', 'set-cookie': `pc_session=${session}; Path=/; HttpOnly; SameSite=Strict`, 'cache-control': 'no-store' } });
  return app.fetch(request);
} });
console.log(`Private template review ready at ${origin}/review-session`);
console.log(`Disposable connection metadata: ${connectionPath}`);
