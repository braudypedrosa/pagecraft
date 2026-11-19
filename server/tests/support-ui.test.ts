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
    assert.equal(page.window.document.querySelector('[data-thread] li:last-child strong').textContent, 'Pagecraft Support');
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
