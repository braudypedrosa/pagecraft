import type { Hono, Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import type { AuthStore, User } from './auth.ts';
import { normalEmail, validEmail } from './auth.ts';
import type { Store } from './store.ts';
import { LiveReviewStore, secret, type ReviewPerson, type LiveLink, type ReviewDevice } from './live-reviews.ts';
import { liveReviewPage, reviewEntry, escapeReview } from './live-review-page.ts';
import { reviewBridge } from './live-review-client.ts';
import { throttle } from './mail.ts';
export function liveReviewRoutes(app: Hono, o: {
  store: Store; auth: AuthStore; reviews: LiveReviewStore; who: (c: Context) => Promise<User | null>;
  origin?: string; secure?: boolean;
  notifyInvitation?: (c: Context, user: User, href: string, kind: string) => Promise<void>;
  preview: (siteId: string, page: string) => Promise<{ html: string; version: number; pages: { path: string; name: string }[] } | null>;
}) {
  const limit = throttle(90, 60000, 5000);
  const inviteLimit = throttle(20, 3600000, 5000);
  const baseOf = (l: LiveLink) => '/review/' + l.token;
  const access = async (c: Context) => {
    const link = await o.reviews.link(c.req.param('token') || '');
    if (!link || !await o.store.byId(link.siteId)) return null;
    const user = await o.who(c);
    const membership = user ? await o.auth.membership(link.siteId, user.id) : null;
    const owner = membership?.role === 'owner';
    const developer = !!(user && membership && await o.reviews.invited(link.siteId, normalEmail(user.email), 'developer'));
    const invited = !!(user && membership && await o.reviews.invited(link.siteId, normalEmail(user.email)));
    const allowed = owner || (link.access === 'public') || (link.access === 'developer' ? developer : invited);
    const person: ReviewPerson | null = !allowed ? null : user ? { id: user.id, name: user.name || user.email } : link.access === 'public' ? await o.reviews.guest(link.siteId, getCookie(c, 'pc_review_guest_' + link.siteId) || '') : null;
    return { link, user, owner, canEdit: membership?.role === 'owner' || membership?.role === 'content', canResolve: owner || developer, person };
  };
  app.use('/review/*', async (c, next) => {
    c.header('cache-control', 'private, no-store'); c.header('referrer-policy', 'no-referrer'); c.header('x-robots-tag', 'noindex, nofollow');
    if (c.req.method === 'POST') {
      const expected = new URL(o.origin || c.req.url).origin;
      let origin = c.req.header('origin'); if (!origin) { try { origin = new URL(c.req.header('referer') || '').origin; } catch {} }
      if (origin !== expected) return c.json({ error: 'Please reload this review and try again.' }, 403);
      if (!limit.take(c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown')) return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    await next();
  });
  app.use('/review/*', bodyLimit({ maxSize: 16384 }));
  app.post('/sites/:id/reviews/live', async c => {
    const user = await o.who(c), siteId = c.req.param('id');
    if (!user || (await o.auth.membership(siteId, user.id))?.role !== 'owner') return c.text('Owner access required', 403);
    const body = await c.req.parseBody(); const kind = String(body.access || 'private');
    if (!['public','private','developer'].includes(kind)) return c.text('Invalid link access', 400);
    const link = await o.reviews.createLink(siteId, kind as LiveLink['access']);
    return c.redirect(baseOf(link), 303);
  });
  app.get('/review/:token', async c => {
    const a = await access(c); if (!a) return c.text('This review link is unavailable or has been revoked.', 404);
    const site = (await o.store.byId(a.link.siteId))!;
    if (!a.person) return c.html(reviewEntry(site.name, baseOf(a.link), a.link.access === 'public', a.user ? 'This account has not been invited. Sign in with the invited email or ask the owner for access.' : ''));
    const preview = await o.preview(site.id, 'index.html');
    if (!preview) return c.text('Site preview is not available. Ask the owner to save the site.', 422);
    return c.html(liveReviewPage({ name: site.name, siteId: site.id, base: baseOf(a.link), person: a.person.name, owner: a.owner, canResolve: a.canResolve, canEdit: a.canEdit, pages: preview.pages, links: a.owner ? await o.reviews.links(site.id) : [], invitations: a.owner ? await o.reviews.invitations(site.id) : [] }));
  });
  app.post('/review/:token/join', async c => {
    const a = await access(c); if (!a || a.link.access !== 'public') return c.text('Guest access is unavailable.', 403);
    const body = await c.req.parseBody(); const name = String(body.name || '').trim();
    if (!name || name.length > 80) return c.text('Enter a name of up to 80 characters.', 400);
    const token = await o.reviews.addGuest(a.link.siteId, name);
    setCookie(c, 'pc_review_guest_' + a.link.siteId, token, { httpOnly: true, secure: !!o.secure, sameSite: 'Lax', path: '/review', maxAge: 30 * 86400 });
    return c.redirect(baseOf(a.link), 303);
  });
  app.get('/review/:token/state', async c => {
    const a = await access(c); if (!a?.person) return c.json({ error: 'Your access has expired. Reload and sign in again.' }, 403);
    return c.json({ pins: await o.reviews.pins(a.link.siteId), version: (await o.store.byId(a.link.siteId))?.version });
  });
  app.get('/review/:token/preview', async c => {
    const a = await access(c); if (!a?.person) return c.json({ error: 'Sign in or enter your name first.' }, 403);
    const page = c.req.query('page') || 'index.html';
    const preview = await o.preview(a.link.siteId, page); if (!preview) return c.json({ error: 'This page is no longer available. Choose another page.' }, 404);
    const channel = secret();
    // CSP and iframe sandbox retain an opaque origin. Site scripts cannot read app cookies.
    const bridge = `<script>(${reviewBridge.toString()})(${JSON.stringify(channel)});</script>`;
    const html = preview.html.replace(/<html\b/i, '<html data-review-page="' + escapeReview(page) + '"');
    return c.json({ html: html.replace(/<\/body>/i, bridge + '</body>'), version: preview.version, channel });
  });
  app.post('/review/:token/pin', async c => {
    const a = await access(c); if (!a?.person) return c.json({ error: 'Sign in or enter your name first.' }, 403);
    const b = await c.req.json().catch(() => null);
    if (!b || typeof b.body !== 'string' || !b.body.trim() || b.body.length > 4000 || typeof b.page !== 'string' || !['desktop','tablet','mobile'].includes(b.device) || ![b.x,b.y,b.nodeX,b.nodeY].every(Number.isFinite) || b.x < 0 || b.x > 1 || b.y < 0 || b.y > 1000000 || b.nodeX < 0 || b.nodeX > 1 || b.nodeY < 0 || b.nodeY > 1 || typeof b.nodeId !== 'string' || b.nodeId.length > 200) return c.json({ error: 'Choose a point on the site and enter a comment of up to 4,000 characters.' }, 400);
    if (!await o.preview(a.link.siteId, b.page)) return c.json({ error: 'The page no longer exists. Reload the review.' }, 400);
    return c.json(await o.reviews.addPin({ siteId: a.link.siteId, page: b.page, device: b.device as ReviewDevice, x: b.x, y: b.y, nodeId: b.nodeId, nodeX: b.nodeX, nodeY: b.nodeY, body: b.body.trim(), author: a.person }), 201);
  });
  app.post('/review/:token/reply', async c => {
    const a = await access(c); if (!a?.person) return c.json({ error: 'Review access required.' }, 403);
    const b = await c.req.json().catch(() => null);
    if (!b || typeof b.body !== 'string' || !b.body.trim() || b.body.length > 4000) return c.json({ error: 'Enter a reply of up to 4,000 characters.' }, 400);
    try { return c.json(await o.reviews.reply(a.link.siteId, b.pinId, a.person, b.body.trim())); } catch { return c.json({ error: 'Comment not found.' }, 404); }
  });
  app.post('/review/:token/resolve', async c => {
    const a = await access(c); if (!a?.person || !a.canResolve) return c.json({ error: 'Only the owner or an invited developer can resolve comments.' }, 403);
    const b = await c.req.json().catch(() => null); if (typeof b?.done !== 'boolean') return c.json({ error: 'Choose done or open.' }, 400);
    try { return c.json(await o.reviews.resolve(a.link.siteId, b.pinId, a.person, b.done)); } catch { return c.json({ error: 'Comment not found.' }, 404); }
  });
  app.post('/review/:token/invite', async c => {
    const a = await access(c); if (!a?.owner || !a.user) return c.text('Owner access required', 403);
    if (!inviteLimit.take(a.user.id)) return c.text('Invitation limit reached. Try again later.', 429);
    const b = await c.req.parseBody(), email = normalEmail(String(b.email || '')), kind = String(b.kind || '');
    if (!validEmail(email) || !['private','developer'].includes(kind)) return c.text('Enter a valid email and access type.', 400);
    let link = (await o.reviews.links(a.link.siteId)).find(l => l.active && l.access === kind);
    if (!link) link = await o.reviews.createLink(a.link.siteId, kind as 'private' | 'developer');
    const member = (await o.auth.members(a.link.siteId)).find(m => normalEmail(m.email) === email);
    const result = await o.auth.provisionInvitation({ siteId: a.link.siteId, actorUserId: a.user.id, email, role: member?.role || 'reviewer', redirectTo: `${o.origin || new URL(c.req.url).origin}/auth/confirm?type=invite&next=${encodeURIComponent(baseOf(link))}` });
    if (result.status === 'forbidden' || result.status === 'last_owner') return c.text('Could not grant access. Refresh and try again.', 403);
    await o.reviews.invite(a.link.siteId, email, kind as 'private' | 'developer');
    await o.auth.drainInvitationOutbox('review-' + secret(), 5);
    if (result.status === 'granted') await o.notifyInvitation?.(c, result.user, baseOf(link), kind);
    return c.redirect(baseOf(a.link), 303);
  });
  app.post('/review/:token/remove-invite', async c => {
    const a = await access(c); if (!a?.owner) return c.text('Owner access required', 403);
    const b = await c.req.parseBody(); await o.reviews.removeInvite(a.link.siteId, normalEmail(String(b.email || '')));
    return c.redirect(baseOf(a.link), 303);
  });
  app.post('/review/:token/revoke', async c => {
    const a = await access(c); if (!a?.owner) return c.text('Owner access required', 403);
    const b = await c.req.parseBody(); await o.reviews.revoke(a.link.siteId, String(b.linkId || ''));
    return c.redirect('/sites/' + a.link.siteId + '/reviews', 303);
  });
}
