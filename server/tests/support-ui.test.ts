import assert from 'node:assert/strict';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { test } from 'vitest';
import { dashboardPage } from '../src/account-pages.ts';
import { supportPage, withSupportWidget } from '../src/support-page.ts';

test('widget retries the same request and the full page continues the same thread', async () => {
  const body = 'Where do I change the title?';
  const reply = 'Open the page settings.';
  const requests: string[] = [];
  const ticket = {
    id: 'ticket-one', subject: body, updatedAt: '2026-11-19T08:00:00Z',
    messages: [{ id: 'message-one', role: 'customer', body, createdAt: '2026-11-19T08:00:00Z' }]
  };
  const fetch = async (url: string, options: RequestInit) => {
    if (options.method === 'POST') {
      const input = JSON.parse(String(options.body));
      requests.push(input.requestId);
      assert.equal(input.body, body);
      if (requests.length === 1) return new Response(null, { status: 503 });
      return Response.json({ ticket });
    }
    const latest = ticket.messages.at(-1)!;
    const summary = { id: ticket.id, subject: ticket.subject, updatedAt: latest.createdAt, latestMessageRole: latest.role };
    return url.endsWith('/ticket-one') ? Response.json({ ticket }) : Response.json({ tickets: requests.length ? [summary] : [] });
  };
  const open = (widget: boolean, url: string) => {
    const user = { id: 'member-one', name: 'Morgan Hale', email: 'morgan@example.test' };
    const html = widget
      ? withSupportWidget(dashboardPage(user, [], 0, { usedBytes: 0, limitBytes: 1024 }, []))
      : supportPage(user);
    const dom = new JSDOM(html, { runScripts: 'outside-only', url, pretendToBeVisual: true });
    const support = dom.window.document.querySelector('main.dashboard-app [data-support]');
    assert.ok(support);
    dom.window.fetch = fetch;
    dom.window.eval(support.nextElementSibling.textContent);
    return dom;
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const widget = open(true, 'https://app.example.test/');
  let page;
  try {
    const doc = widget.window.document;
    assert.equal(doc.querySelector('[aria-label="Help"]').getAttribute('href'), '/account/support');
    doc.querySelector('[data-launch]').click();
    await tick();
    assert.equal(doc.querySelector('[data-form]').hidden, false);
    const textarea = doc.querySelector('textarea');
    textarea.value = body;
    textarea.dispatchEvent(new widget.window.Event('input'));
    doc.querySelector('[data-form] [type=submit]').click();
    await tick();
    assert.equal(textarea.value, body);
    assert.ok(doc.querySelector('[data-status]').hasAttribute('data-error'));
    doc.querySelector('[data-form] [type=submit]').click();
    await tick();
    assert.equal(requests.length, 2);
    assert.equal(requests[0], requests[1]);
    assert.equal(doc.querySelector('[data-thread] li p').textContent, body);

    ticket.messages.push({ id: 'message-two', role: 'support', body: reply, createdAt: '2026-11-19T08:15:00Z' });
    const link = doc.querySelector('[data-expand]').href;
    assert.equal(link, 'https://app.example.test/account/support?ticket=ticket-one');
    page = open(false, link);
    await tick();
    const header = page.window.document.querySelector('.pc-topbar');
    assert.equal(header.querySelector('.pc-docname').textContent, 'Support');
    for (const selector of ['[aria-label="Help"]', '[data-notify-root]', '#account-menu']) {
      assert.equal(header.querySelector(selector).outerHTML, doc.querySelector('.pc-topbar').querySelector(selector).outerHTML);
    }
    doc.dispatchEvent(new widget.window.Event('visibilitychange'));
    await tick();
    for (const surface of [widget, page]) {
      const senders = surface.window.document.querySelectorAll('[data-thread] strong');
      assert.equal(senders[0].textContent, 'You');
      assert.equal(senders[0].classList.contains('pc-support-staff-author'), false);
      assert.equal(senders[1].textContent, 'Pagecraft Support Admin');
      assert.equal(senders[1].classList.contains('pc-support-staff-author'), true);
    }
    assert.equal(page.window.document.querySelector('[data-thread] li:last-child p').textContent, reply);

    for (const surface of [widget, page]) {
      surface.window.document.querySelector('[data-back]').click();
      await tick();
      const row = surface.window.document.querySelector('[data-list] a');
      assert.equal(row.querySelector('strong').textContent, body);
      assert.equal(row.querySelector('.pc-support-replied').textContent, 'Support replied');
      assert.equal(row.querySelector('time').dateTime, '2026-11-19T08:15:00Z');
    }
    ticket.messages.push({ id: 'message-three', role: 'customer', body: 'Thank you.', createdAt: '2026-11-19T08:20:00Z' });
    for (const surface of [widget, page]) {
      const list = surface.window.document.querySelector('[data-list]');
      list.querySelector('a').focus();
      surface.window.document.dispatchEvent(new surface.window.Event('visibilitychange'));
      await tick();
      assert.equal(list.querySelector('.pc-support-replied'), null);
      assert.equal(list.querySelector('time').dateTime, '2026-11-19T08:20:00Z');
      assert.equal(surface.window.document.activeElement, list.querySelector('a'));
    }
  } finally {
    page?.window.close();
    widget.window.close();
  }
});

test('unread tickets stay counted until their replies are displayed in the widget or full page', async () => {
  const unread = new Set(['first', 'second']);
  const acknowledged: string[] = [];
  const user = { id: 'member-two', name: 'River Hayes', email: 'river@example.test' };
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  let releaseTicket: (() => void) | undefined;
  let holdTicket = false;
  const open = (widget: boolean, url: string) => {
    const dom = new JSDOM(widget ? withSupportWidget(dashboardPage(user, [], 0, { usedBytes: 0, limitBytes: 1024 })) : supportPage(user),
      { url, pretendToBeVisual: true, runScripts: 'outside-only' });
    dom.window.fetch = async (path: string, options: RequestInit) => {
      if (path === '/api/support/unread') return Response.json({ count: unread.size });
      const ids = ['first', 'second'];
      const summary = (id: string) => ({
        id, subject: 'Ticket ' + id, updatedAt: '2026-11-19T10:00:00Z', latestMessageRole: 'support', unread: unread.has(id)
      });
      if (path === '/api/support/tickets') return Response.json({ tickets: ids.map(summary) });
      const id = path.split('/')[4];
      assert.ok(ids.includes(id));
      if (path.endsWith('/read')) {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(String(options.body)), { messageIds: ['reply-' + id] });
        unread.delete(id);
        acknowledged.push(id);
        return Response.json({ count: unread.size });
      }
      if (holdTicket) await new Promise<void>(resolve => { releaseTicket = resolve; });
      return Response.json({ ticket: { ...summary(id), messages: [{
        id: 'reply-' + id, role: 'support', body: 'Your update is ready.', createdAt: '2026-11-19T10:00:00Z', unread: unread.has(id)
      }] } });
    };
    dom.window.eval(dom.window.document.querySelector('[data-support]').nextElementSibling.textContent);
    return dom;
  };
  const widget = open(true, 'https://app.example.test/');
  let page;
  try {
    const doc = widget.window.document;
    const badge = doc.querySelector('[data-unread-count]'), launch = doc.querySelector('[data-launch]');
    await settle();
    assert.equal(badge.hidden, false);
    assert.equal(badge.textContent, '2');
    assert.equal(launch.getAttribute('aria-label'), 'Support chat, 2 unread tickets');
    launch.click();
    await settle();
    assert.equal(doc.querySelectorAll('[data-list] a').length, 2);
    assert.deepEqual(acknowledged, []);
    holdTicket = true;
    doc.querySelector('[data-list] a').click();
    doc.querySelector('[data-close]').click();
    releaseTicket!();
    await settle();
    assert.deepEqual(acknowledged, []);
    holdTicket = false;
    launch.click();
    await settle();
    doc.querySelector('[data-list] a').click();
    await settle();
    assert.deepEqual(acknowledged, ['first']);
    assert.equal(badge.textContent, '1');
    assert.equal(launch.getAttribute('aria-label'), 'Support chat, 1 unread ticket');

    page = open(false, 'https://app.example.test/account/support?ticket=second');
    await settle();
    assert.deepEqual(acknowledged, ['first', 'second']);
    doc.querySelector('[data-close]').click();
    doc.dispatchEvent(new widget.window.Event('visibilitychange'));
    await settle();
    assert.equal(badge.hidden, true);
    assert.equal(launch.getAttribute('aria-label'), 'Support chat');

    unread.add('first');
    doc.dispatchEvent(new widget.window.Event('visibilitychange'));
    await settle();
    assert.equal(badge.hidden, false);
    assert.equal(badge.textContent, '1');
    assert.deepEqual(acknowledged, ['first', 'second']);
  } finally {
    widget.window.close();
    page?.window.close();
  }
});
