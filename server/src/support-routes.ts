import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { throttle } from './mail.ts';
import type { User } from './auth.ts';
import { SupportError, type SupportNotify, type SupportTicketStore } from './support-tickets.ts';

export function registerSupportRoutes(app: Hono, o: {
  who: (c: Context) => Promise<User | null>;
  store: SupportTicketStore;
  notify?: SupportNotify;
  editorOrigin?: string;
  page: (user: User) => string;
}) {
  const limit = throttle(30, 15 * 60_000);
  const base = '/api/support/tickets';
  const customer = (c: Context) => c.req.header('authorization') || c.req.header('x-pagecraft-editor-session')
    ? null : o.who(c);
  app.get('/account/support', async c => {
    c.header('Cache-Control', 'private, no-store');
    const user = await customer(c);
    if (user) return c.html(o.page(user));
    const { pathname, search } = new URL(c.req.url);
    return c.redirect('/sign-in?next=' + encodeURIComponent(pathname + search));
  });
  app.use('/api/support/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    await next();
  });
  app.get(base, async c => {
    const user = await customer(c);
    return user ? c.json({ tickets: await o.store.list(user.id) }) : c.json({ error: 'Sign in to view support tickets.' }, 401);
  });
  app.get(base + '/:id', async c => {
    const user = await customer(c);
    if (!user) return c.json({ error: 'Sign in to view support tickets.' }, 401);
    try {
      return c.json({ ticket: await o.store.get(user.id, c.req.param('id')!) });
    } catch (error) {
      if (error instanceof SupportError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  });
  const bounded = bodyLimit({ maxSize: 52 * 1024, onError: c => c.json({ error: 'Message is too large.' }, 413) });
  const send = async (c: Context) => {
    const user = await customer(c);
    if (!user) return c.json({ error: 'Sign in to send a support message.' }, 401);
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(o.editorOrigin || c.req.url).origin) return c.json({ error: 'Origin not allowed.' }, 403);
    if (!o.notify) return c.json({ error: 'Support email is temporarily unavailable.' }, 503);
    if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('content-type') || '')) return c.json({ error: 'Expected JSON.' }, 415);
    if (!limit.take(user.id)) return c.json({ error: 'Too many messages. Please try again later.' }, 429);
    const input = await c.req.json().catch(() => null);
    try {
      return c.json({ ticket: await o.store.send(user, c.req.param('id'), input, o.notify) });
    } catch (error) {
      if (error instanceof SupportError) return c.json({ error: error.message }, error.status);
      throw error;
    }
  };
  app.post(base, bounded, send);
  app.post(base + '/:id/messages', bounded, send);
}
