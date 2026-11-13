/** Fictional, loopback-only acceptance fixture for the readiness consent changes. */
import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { createApp } from '../server/src/app.ts';
import { MemoryStore } from '../server/src/store.ts';
import { MemoryAuthStore, hashToken } from '../server/src/auth.ts';
import { MemoryAssetStore } from '../server/src/assets.ts';
import { MemoryLibraryStore } from '../server/src/libraries.ts';
import { MemoryCollaborationInvitationStore } from '../server/src/collaboration-invitations.ts';
import { MemoryOwnedSiteStore } from '../server/src/accounts.ts';
import { blankDoc } from '../server/src/render.ts';

const store = new MemoryStore(), auth = new MemoryAuthStore(), libraries = new MemoryLibraryStore();
const owner = await auth.ensureAuthUser('qa-owner', 'owner@example.invalid', 'Workshop owner');
const recipient = await auth.ensureAuthUser('qa-recipient', 'recipient@example.invalid', 'Readiness reviewer');
const site = await store.create({ name: 'Community workshop', host: 'workshop.example.invalid', slug: 'community-workshop', doc: blankDoc('Community workshop'), savedBy: owner.id });
await auth.grant(site.id, owner.id, 'owner');
const mine = await store.create({ name: 'Readiness preview', host: 'preview.example.invalid', slug: 'readiness-preview', doc: blankDoc('Readiness preview'), savedBy: recipient.id });
await auth.grant(mine.id, recipient.id, 'owner');
const library = await libraries.create({ ownerId: owner.id, name: 'Workshop components' });
const invitations = new MemoryCollaborationInvitationStore(store, auth, libraries);
await invitations.invite({ kind: 'site_owner', resourceId: site.id, invitedBy: owner.id, recipientId: recipient.id });
await invitations.invite({ kind: 'library', resourceId: library.id, invitedBy: owner.id, recipientId: recipient.id });
await auth.createManualImportCredential({ id: 'qa-wordpress', ownerId: recipient.id, installationId: 'qa-wordpress-installation', siteUrl: 'https://workshop.example.invalid/studio/', accessTokenDigest: hashToken('fictional-access'), accessExpiresAt: Date.now() + 900000, refreshTokenDigest: hashToken('fictional-refresh') });

let current = recipient;
const unavailable = async () => { throw new Error('Authentication changes are unavailable in this fictional fixture'); };
const accountAuth = { identity: async () => ({ authUserId: current.authUserId, email: current.email, name: current.name, providers: ['email'] }), oauth: unavailable, signUp: unavailable, signIn: unavailable, confirm: unavailable, forgot: unavailable, reset: unavailable, updateEmail: unavailable, updatePassword: unavailable, signOut: unavailable };
for (const user of [owner, recipient]) await auth.putSession(hashToken(`fictional-${user.id}`), user.id, Date.now() + 86400000);
const app = createApp({ store, auth, assets: new MemoryAssetStore(), libraries, collaborationInvitations: invitations, accountAuth, ownedSites: new MemoryOwnedSiteStore(store, auth), componentGallery: true, editorHost: 'localhost', editorOrigin: 'http://localhost:4945', editorHtml: await readFile(new URL('../index.html', import.meta.url), 'utf8') });
serve({ hostname: '127.0.0.1', port: 4945, fetch(request) {
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) return new Response('Loopback fixture only', { status: 403 });
  if (url.pathname === '/qa') return new Response('<h1>Fictional readiness acceptance</h1><p>No live accounts, emails, or database.</p><a href="/qa/recipient">Recipient</a> <a href="/qa/owner">Owner</a>', { headers: { 'content-type': 'text/html' } });
  if (url.pathname === '/qa/owner' || url.pathname === '/qa/recipient') {
    current = url.pathname === '/qa/owner' ? owner : recipient;
    return Response.redirect(`http://localhost:4945/${current === owner ? `sites/${site.id}/people` : 'invitations'}`, 303);
  }
  const headers = new Headers(request.headers);
  headers.set('host', 'localhost'); headers.set('cookie', `pc_session=fictional-${current.id}`);
  if (headers.get('origin') === 'http://127.0.0.1:4945') headers.set('origin', 'http://localhost:4945');
  return app.fetch(new Request(request, { headers }));
}}, () => console.log('Fictional readiness fixture: http://localhost:4945/invitations; account switch: /qa'));
