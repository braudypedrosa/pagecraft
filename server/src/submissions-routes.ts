import { randomUUID } from 'node:crypto';
import type { Hono, Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Store } from './store.ts';
import type { User, Role } from './auth.ts';
import type { HostedPublicationStore } from './publications.ts';
import { FileSubmissionStore, siteForms, submissionValues, type SubmissionStatus } from './submissions.ts';
import { siteSubmissionsPage } from './account-pages.ts';
import { throttle } from './mail.ts';

type Gate = { ok: true; user: User; role: Role } | { ok: false; status: 401 | 403 | 404 };
export function submissionRoutes(app: Hono, o: {
  store: Store; submissions?: FileSubmissionStore; publications?: HostedPublicationStore;
  allowed(c: Context, id: string, verb: 'read' | 'write'): Promise<Gate>;
  editorOrigin?: string; requestSource(c: Context): string;
}) {
  const base = '/sites/:id/submissions';
  const gate = (c: Context, verb: 'read' | 'write') => {
    if (c.req.header('authorization') || c.req.header('x-pagecraft-editor-session')) return Promise.resolve({ ok: false as const, status: 403 as const });
    return o.allowed(c, c.req.param('id')!, verb);
  };
  app.get(base, async c => {
    const embedded = c.req.query('embedded') === '1';
    if (embedded) c.header('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    const access = await gate(c, 'read');
    if (!access.ok) return access.status === 401 && !embedded ? c.redirect('/sign-in?next=' + encodeURIComponent(new URL(c.req.url).pathname)) : c.text('Access denied', access.status);
    const site = await o.store.byId(c.req.param('id'));
    if (!site) return c.notFound();
    c.header('Cache-Control', 'no-store');
    if (!o.submissions) return c.text('Submissions are unavailable. Try again shortly.', 503);
    try {
      return c.html(siteSubmissionsPage(access.user, site, access.role, siteForms(site.doc), await o.submissions.list(site.id), c.req.query('form') || '', c.req.query('status') || '', Number(c.req.query('page')) || 1, embedded));
    } catch { return c.text('Submissions could not be loaded. Try again shortly.', 503); }
  });
  app.post(base + '/:entry/status', bodyLimit({ maxSize: 1024 }), async c => {
    const access = await gate(c, 'write');
    if (!access.ok) return c.text('Access denied', access.status);
    if (c.req.header('origin') !== new URL(o.editorOrigin || c.req.url).origin) return c.text('Refresh this page and try again.', 403);
    const data = new URLSearchParams(await c.req.text());
    const status = data.get('status') as SubmissionStatus;
    if (data.get('embedded') === '1') c.header('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
    if (!['new', 'read', 'archived'].includes(status)) return c.text('Choose a valid status.', 400);
    if (!o.submissions) return c.text('Submissions are unavailable.', 503);
    try {
      if (!await o.submissions.status(c.req.param('id')!, c.req.param('entry')!, status)) return c.notFound();
      return c.redirect('/sites/' + encodeURIComponent(c.req.param('id')!) + '/submissions' + (data.get('embedded') === '1' ? '?embedded=1' : ''), 303);
    } catch { return c.text('Status was not saved. Try again.', 503); }
  });
  const perSource = throttle(10, 60000), perSite = throttle(100, 60000);
  app.post('/forms/:id/:form', bodyLimit({ maxSize: 32768, onError: c => c.text('This submission is too large.', 413) }), async c => {
    c.header('Cache-Control', 'no-store');
    const id = c.req.param('id'), formId = c.req.param('form');
    if (!o.submissions || !o.publications) return c.text('Submissions are temporarily unavailable. Please try again.', 503);
    if (!perSource.take(o.requestSource(c)) || !perSite.take(id)) { c.header('Retry-After', '60'); return c.text('Please wait a minute before trying again.', 429); }
    if (!(c.req.header('content-type') || '').startsWith('application/x-www-form-urlencoded')) return c.text('Unsupported submission format.', 415);
    const site = await o.store.byId(id);
    if (!site) return c.notFound();
    // The environment's actual public pointer is authoritative, not a draft or another environment's DB pointer.
    const published = await o.publications.currentBySlug(site.slug);
    if (!published || published.siteId !== id) return c.notFound();
    const origin = c.req.header('origin');
    const allowedOrigins = new Set([new URL(o.editorOrigin || c.req.url).origin]);
    if (!/\.invalid$/.test(site.host)) allowedOrigins.add('https://' + site.host);
    // Published HTML uses CSP sandbox without allow-same-origin, so native POSTs carry Origin: null.
    if (origin && origin !== 'null' && !allowedOrigins.has(origin)) return c.text('Submit this form from the published site.', 403);
    const revision = await o.store.revision(id, published.sourceVersion);
    const form = revision && siteForms(revision.doc).find(f => f.id === formId);
    if (!form || !form.fields.length) return c.notFound();
    const data = new URLSearchParams(await c.req.text());
    if (data.get('_pc_trap')) return c.redirect('/forms/thanks', 303);
    let values;
    try { values = submissionValues(form, data); }
    catch (e) { return c.text((e as Error).message + ' Go back to update your form.', 422); }
    const request = data.get('_pc_request') || '';
    try {
      await o.submissions.add(id, { id: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(request) ? request : randomUUID(), formId, formName: form.name, values, status: 'new', createdAt: new Date().toISOString() });
      return c.redirect('/forms/thanks', 303);
    } catch { return c.text('Your submission was not saved. Please try again shortly.', 503); }
  });
  app.get('/forms/thanks', c => { c.header('Cache-Control', 'no-store'); return c.html('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Submission received</title><body style="font:16px system-ui;background:#f8f7f0;color:#141914;margin:0"><main style="max-width:520px;margin:15vh auto;padding:32px"><h1>Thank you</h1><p>Your submission has been received.</p><button onclick="history.back()" style="padding:12px 20px;background:#b7f34a;border:0;border-radius:6px">Back to site</button></main></body></html>'); });
}
