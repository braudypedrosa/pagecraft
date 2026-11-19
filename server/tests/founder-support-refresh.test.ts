import { test, expect, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { founderCrmSupportPage, founderSupportUpdates } from '../src/founder-crm-page.ts';
import { mountSupportInbox } from '../src/founder-crm-client/support.ts';
import type { CrmSupportInbox } from '../src/founder-crm-types.ts';

test('refreshes the selected support ticket after a failed reply without disturbing the draft', async () => {
  const ticket = {
    id: '70d2c5cc-e775-4cfb-aedd-6597e594ba67',
    subject: 'Page title', updatedAt: '2026-11-19T01:00:00Z', latestMessageRole: 'support' as const,
  };
  const firstMessage = { role: 'support' as const, body: 'Which page?', createdAt: ticket.updatedAt };
  const support: CrmSupportInbox = {
    environment: 'staging', sourceLabel: 'Staging support', state: 'available', tickets: [ticket],
    selected: { ...ticket, messages: [firstMessage] }, requestId: 'a609cfac-6552-4ace-bdbf-a86111dea1ae',
    draftBody: 'I will check',
  };
  const page = founderCrmSupportPage({ id: 'founder', name: 'River', email: 'river@example.test' }, {
    section: 'support', dataEnvironment: 'staging', support, error: 'Could not confirm delivery. Retry your reply.',
  });
  const update = { ...ticket, updatedAt: '2026-11-19T01:02:00Z', latestMessageRole: 'customer' as const };
  const fragments = founderSupportUpdates({
    ...support, tickets: [update],
    selected: { ...update, messages: [firstMessage, { role: 'customer', body: 'The home page.', createdAt: update.updatedAt }] },
  });

  const dom = new JSDOM(page, { url: 'https://reports.example.test/support/' + ticket.id + '/replies?environment=staging', pretendToBeVisual: true });
  const doc: Document = dom.window.document;
  const draft = doc.querySelector<HTMLTextAreaElement>('#support-reply')!;
  draft.focus();
  draft.value += ' the home page.';
  draft.setSelectionRange(5, 9);
  const poll = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(fragments));
  dom.window.fetch = poll;
  vi.useFakeTimers();
  const unmount = mountSupportInbox(doc);
  try {
    await vi.advanceTimersByTimeAsync(15_000);
    expect(doc.querySelector('[data-support-inbox]')?.textContent).toContain('Replied');
    expect(doc.querySelector('[data-support-thread]')?.children.length).toBe(1);
    await vi.advanceTimersByTimeAsync(15_000);

    expect(poll).toHaveBeenCalledTimes(2);
    for (const [url, init] of poll.mock.calls) {
      expect(url).toBe('/support?environment=staging&ticket=' + ticket.id);
      expect(init?.headers).toEqual({ accept: 'text/vnd.pagecraft.support+html' });
    }
    expect(doc.querySelector('[data-support-inbox]')?.textContent).toContain('Needs reply');
    expect(doc.querySelector('[data-support-thread]')?.children.length).toBe(2);
    expect(doc.querySelector('[data-support-thread]')?.textContent).toContain('The home page.');
    expect(doc.activeElement).toBe(draft);
    expect(draft.value).toBe('I will check the home page.');
    expect([draft.selectionStart, draft.selectionEnd]).toEqual([5, 9]);
  } finally {
    unmount();
    dom.window.close();
    vi.useRealTimers();
  }
});
