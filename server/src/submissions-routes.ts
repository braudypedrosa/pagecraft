import { stream } from 'hono/streaming';
import { randomUUID } from 'node:crypto';
import type { Hono, Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Store } from './store.ts';
import type { User, Role } from './auth.ts';
import type { HostedPublicationStore } from './publications.ts';
import { FileSubmissionStore, siteForms, submissionValues, submissionOutcome, submissionsCsv } from './submissions.ts';
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
    const started = performance.now();
    let authMs = 0, siteMs = 0;
    const [accessResult, siteResult] = await Promise.allSettled([
      gate(c, 'read').then(value => { authMs = performance.now() - started; return value; }),
      o.store.byId(c.req.param('id')).then(value => { siteMs = performance.now() - started; return value; }),
    ]);
    if (accessResult.status === 'rejected') return c.text('Submissions could not be loaded. Try again shortly.', 503);
    const access = accessResult.value;
    if (!access.ok) return access.status === 401 && !embedded ? c.redirect('/sign-in?next=' + encodeURIComponent(new URL(c.req.url).pathname)) : c.text('Access denied', access.status);
    c.header('Cache-Control', 'no-store');
    if (!o.submissions) return c.text('Submissions are unavailable. Try again shortly.', 503);
    try {
      if (siteResult.status === 'rejected') throw siteResult.reason;
      const site = siteResult.value;
      const entries = await o.submissions.overview(c.req.param('id')!);
      const form = c.req.query('form') || '';
      const detail = form ? await o.submissions.page(c.req.param('id')!, entries, form, c.req.query('status') || '', Number(c.req.query('page')) || 1, c.req.query('order')) : undefined;
      if (!site) return c.notFound();
      const forms = siteForms(site.doc);
      const prepared: Record<string, string> = {};
      // Bound initial work independently of the total number of forms or entries.
      let entryBudget = 100, byteBudget = 512 * 1024;
      if (!form) for (const id of [...new Set([...forms.map(f => f.id), ...entries.map(e => e.formId)])].slice(0, 8)) {
        const count = Math.min(25, entries.filter(e => e.formId === id).length);
        if (count > entryBudget) continue;
        entryBudget -= count;
        const first = await o.submissions.page(site.id, entries, id, '', 1);
        const html = siteSubmissionsPage(access.user, site, access.role, forms, entries, id, '', 1, embedded, first.items, {}, true);
        const bytes = Buffer.byteLength(html);
        if (bytes > byteBudget) continue;
        byteBudget -= bytes;
        const query = new URLSearchParams({form:id,...(embedded?{embedded:'1'}:{})});
        prepared['/sites/' + encodeURIComponent(site.id) + '/submissions?' + query] = html;
      }
      c.header('Server-Timing', `auth;dur=${authMs.toFixed(1)}, site;dur=${siteMs.toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}`);
      return c.html(siteSubmissionsPage(access.user, site, access.role, siteForms(site.doc), entries, c.req.query('form') || '', c.req.query('status') || '', detail?.page || 1, embedded, detail?.items, prepared, false, c.req.query('order')));
    } catch { return c.text('Submissions could not be loaded. Try again shortly.', 503); }
  });
  app.get(base + '/export.csv', async c => {
    const access = await gate(c, 'read');
    if (!access.ok) return c.text('Access denied', access.status);
    c.header('Cache-Control', 'no-store');
    if (!o.submissions) return c.text('Submissions are unavailable.', 503);
    try {
      const form = c.req.query('form'), status = c.req.query('status');
      if (!form) return c.text('Choose a form to export.', 400);
      const siteId = c.req.param('id')!;
      const store = o.submissions;
      const metadata = (await store.overview(siteId)).filter(e => e.formId === form && (!status || submissionOutcome(e) === status));
      const pages = Math.ceil(metadata.length / 25);
      const labels = new Set<string>();
      for (let page=1;page<=pages;page++) for (const entry of (await store.page(siteId,metadata,form,status || '',page,c.req.query('order'))).items) for (const value of entry.values) labels.add(value.label);
      c.header('Content-Type', 'text/csv; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="submissions.csv"');
      return stream(c, async output => {
        await output.write(submissionsCsv([], [...labels]));
        for (let page=1;page<=pages;page++) {
          if (output.aborted) break;
          await output.write(submissionsCsv((await store.page(siteId,metadata,form,status || '',page,c.req.query('order'))).items, [...labels], false));
        }
      });
    } catch { return c.text('Export failed. Try again.', 503); }
  });
  app.post(base + '/:entry/delete', bodyLimit({ maxSize: 1024 }), async c => {
    const access = await gate(c, 'write');
    if (!access.ok) return c.text('Access denied', access.status);
    if (c.req.header('origin') !== new URL(o.editorOrigin || c.req.url).origin) return c.text('Refresh this page and try again.', 403);
    const data = new URLSearchParams(await c.req.text());
    if (!o.submissions) return c.text('Submissions are unavailable.', 503);
    if (data.get('confirmed') !== 'yes') return c.text('Confirm deletion first.', 400);
    try {
      if (!await o.submissions.remove(c.req.param('id')!, c.req.param('entry')!)) return c.notFound();
      const query = new URLSearchParams();
      for (const name of ['embedded','form','status','page','order']) if (data.get(name)) query.set(name,data.get(name)!);
      return c.redirect('/sites/' + encodeURIComponent(c.req.param('id')!) + '/submissions?' + query, 303);
    } catch { return c.text('Entry was not deleted. Try again.', 503); }
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
    catch (e) {
      const error = (e as Error).message;
      // Record only the failure reason; rejected field values are not retained.
      await o.submissions.add(id, {id:randomUUID(),formId,formName:form.name,values:[],status:'failed',error,createdAt:new Date().toISOString()}).catch(()=>{});
      return c.text(error + ' Go back to update your form.', 422);
    }
    const request = data.get('_pc_request') || '';
    try {
      await o.submissions.add(id, { id: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(request) ? request : randomUUID(), formId, formName: form.name, values, status: 'success', createdAt: new Date().toISOString() });
      return c.redirect('/forms/thanks', 303);
    } catch { return c.text('Your submission was not saved. Please try again shortly.', 503); }
  });
  app.get('/forms/thanks', c => { c.header('Cache-Control', 'no-store'); return c.html('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Submission received</title><body style="font:16px system-ui;background:#f5f7f8;color:#141914;margin:0"><main style="max-width:520px;margin:15vh auto;padding:32px"><h1>Thank you</h1><p>Your submission has been received.</p><button onclick="history.back()" style="padding:12px 20px;background:#b7f34a;border:0;border-radius:6px">Back to site</button></main></body></html>'); });
}
