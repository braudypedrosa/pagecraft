type Summary = { id: string; subject: string; updatedAt: string; latestMessageRole: 'customer' | 'support' | null; unread?: boolean };
type Ticket = Pick<Summary, 'id' | 'subject' | 'updatedAt'> & { messages: { id: string; role: 'customer' | 'support'; body: string; createdAt: string; unread?: boolean }[] };

/** Serialized into both support surfaces. User-provided strings only reach text nodes. */
export function supportClient() {
  const root = document.querySelector<HTMLElement>('[data-support]')!;
  const el = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const launcher = root.querySelector<HTMLButtonElement>('[data-launch]');
  const badge = root.querySelector<HTMLElement>('[data-unread-count]');
  const readChanges = typeof BroadcastChannel === 'function' ? new BroadcastChannel('pagecraft-support-read') : null;
  const panel = el<HTMLElement>('[role=dialog]');
  const title = el<HTMLElement>('[data-title]');
  const status = el<HTMLElement>('[data-status]');
  const empty = el<HTMLElement>('[data-empty]');
  const list = el<HTMLUListElement>('[data-list]');
  const columns = el<HTMLElement>('[data-columns]');
  const thread = el<HTMLOListElement>('[data-thread]');
  const form = el<HTMLFormElement>('[data-form]');
  const message = el<HTMLTextAreaElement>('textarea');
  const send = el<HTMLButtonElement>('button[type=submit]');
  const add = el<HTMLButtonElement>('[data-new]');
  const back = el<HTMLButtonElement>('[data-back]');
  const expand = el<HTMLAnchorElement>('[data-expand]');
  const api = '/api/support/tickets';
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const drafts = new Map<string, { body: string; requestId: string }>();
  let view: 'list' | 'new' | 'ticket' = 'list';
  let selected = '';
  let revision = 0;
  let busy = false;
  let initialized = false;
  let refreshing = false;
  let lastMessage = '';
  let renderedList = '';
  let badgeRevision = 0;
  let loadingBadge = false;
  const acknowledging = new Set<string>();

  function announcement(text: string, error = false) {
    status.textContent = text;
    status.toggleAttribute('data-error', error);
  }

  function url(id: string) {
    return id ? '/account/support?ticket=' + encodeURIComponent(id) : '/account/support';
  }

  function show(next: typeof view, id = '') {
    view = next;
    columns.hidden = true;
    renderedList = '';
    selected = id;
    revision++;
    lastMessage = '';
    title.textContent = next === 'list' ? 'Your tickets' : next === 'new' ? 'New ticket' : 'Conversation';
    add.hidden = next !== 'list';
    back.hidden = next === 'list';
    list.hidden = next !== 'list';
    empty.hidden = true;
    thread.hidden = true;
    form.hidden = next !== 'new';
    thread.replaceChildren();
    message.value = drafts.get(id)?.body || '';
    message.placeholder = next === 'new' ? 'How can we help?' : 'Write a reply…';
    if (launcher) expand.href = url(id);
    else history.replaceState(null, '', url(id));
    announcement('');
  }

  async function request(path: string, options?: RequestInit) {
    const response = await fetch(path, { cache: 'no-store', ...options });
    if (!response.ok) {
      if (response.status === 401) throw Error('Your session has expired. Sign in again to continue.');
      if (response.status === 404) throw Error('This ticket is unavailable. Choose another ticket.');
      if (response.status === 429) throw Error('Too many requests. Try again in a moment.');
      if (options?.method === 'POST') throw Error('Could not confirm delivery. Your message is here to retry.');
      throw Error('Could not load support tickets. Please try again.');
    }
    return response.json();
  }

  function setBadge(count: number) {
    if (!launcher || !badge || !Number.isInteger(count) || count < 0) return;
    badgeRevision++;
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    launcher.setAttribute('aria-label', count
      ? 'Support chat, ' + count + ' unread ' + (count === 1 ? 'ticket' : 'tickets')
      : 'Support chat');
  }

  async function refreshBadge() {
    if (!launcher || document.hidden || loadingBadge) return;
    loadingBadge = true;
    const start = badgeRevision;
    try {
      const { count } = await request('/api/support/unread');
      if (start === badgeRevision) setBadge(count);
    } catch { /* Keep the last confirmed count and retry on the next poll. */ }
    finally { loadingBadge = false; }
  }

  async function acknowledge(ticket: Ticket) {
    if (document.hidden || selected !== ticket.id || (launcher && panel.hidden) || acknowledging.has(ticket.id)) return;
    const ids = ticket.messages.filter(item => item.role === 'support' && item.unread).map(item => item.id);
    if (!ids.length) return;
    acknowledging.add(ticket.id);
    try {
      for (let i = 0; i < ids.length; i += 100) {
        const { count } = await request(api + '/' + encodeURIComponent(ticket.id) + '/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds: ids.slice(i, i + 100) })
        });
        setBadge(count);
      }
      readChanges?.postMessage(null);
    } catch { /* A later visible thread refresh retries any unacknowledged replies. */ }
    finally { acknowledging.delete(ticket.id); }
  }

  function readableError(error: unknown) {
    return error instanceof TypeError ? 'Connection interrupted. Please try again.' :
      error instanceof Error ? error.message : 'Unable to load this conversation.';
  }

  function timestamp(value: string) {
    const time = document.createElement('time');
    time.dateTime = value;
    time.textContent = date.format(new Date(value));
    return time;
  }

  function display(ticket: Ticket) {
    title.textContent = ticket.subject;
    const latest = ticket.messages.at(-1)?.id || '';
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 36;
    if (latest !== lastMessage || thread.children.length !== ticket.messages.length) {
      const rows = ticket.messages.map(item => {
        const row = document.createElement('li');
        const meta = document.createElement('div');
        meta.className = 'pc-support-meta';
        const who = document.createElement('strong');
        who.textContent = item.role === 'support' ? 'Pagecraft Support' : 'You';
        meta.append(who, timestamp(item.createdAt));
        const body = document.createElement('p');
        body.textContent = item.body;
        row.append(meta, body);
        return row;
      });
      thread.replaceChildren(...rows);
    }
    thread.hidden = ticket.messages.length === 0;
    form.hidden = false;
    if (latest !== lastMessage && (nearBottom || !lastMessage)) thread.scrollTop = thread.scrollHeight;
    lastMessage = latest;
    void acknowledge(ticket);
  }

  async function loadTicket(id: string) {
    if (busy) return;
    show('ticket', id);
    const start = revision;
    announcement('Loading conversation…');
    try {
      const { ticket } = await request(api + '/' + encodeURIComponent(id));
      if (start !== revision) return;
      display(ticket);
      announcement('');
    } catch (error) {
      if (start === revision) announcement(readableError(error), true);
    }
  }

  function displayList(tickets: Summary[]) {
    setBadge(tickets.filter(ticket => ticket.unread).length);
    const signature = JSON.stringify(tickets);
    if (signature === renderedList) return;
    renderedList = signature;
    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const rows = tickets.map(ticket => {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.href = url(ticket.id);
      const label = document.createElement('span');
      label.className = 'pc-support-subject';
      const subject = document.createElement('strong');
      subject.textContent = ticket.subject;
      if (ticket.unread) {
        const dot = document.createElement('span');
        dot.className = 'pc-support-unread-dot';
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', 'Unread support reply');
        label.append(dot);
      }
      label.append(subject);
      if (ticket.latestMessageRole === 'support') {
        const tag = document.createElement('span');
        tag.className = 'pc-support-replied';
        tag.textContent = 'Support replied';
        label.append(tag);
      }
      const updated = timestamp(ticket.updatedAt);
      updated.setAttribute('aria-label', 'Updated ' + updated.textContent);
      link.append(label, updated);
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void loadTicket(ticket.id);
        title.focus();
      });
      row.append(link);
      return row;
    });
    list.replaceChildren(...rows);
    empty.hidden = Boolean(tickets.length);
    columns.hidden = Boolean(launcher) || !tickets.length;
    if (focused instanceof HTMLAnchorElement) {
      Array.from(list.querySelectorAll('a')).find(link => link.href === focused.href)?.focus({ preventScroll: true });
    }
  }

  async function loadList(openLatest = false) {
    if (busy) return;
    show('list');
    const start = revision;
    list.replaceChildren();
    announcement('Loading tickets…');
    try {
      const result = await request(api);
      if (start !== revision) return;
      const tickets: Summary[] = result.tickets;
      if (openLatest && !tickets.some(ticket => ticket.unread)) {
        setBadge(0);
        if (tickets.length) await loadTicket(tickets[0].id);
        else show('new');
        return;
      }
      displayList(tickets);
      announcement('');
    } catch (error) {
      if (start === revision) {
        announcement(readableError(error), true);
        const retry = document.createElement('button');
        retry.className = 'pc-btn';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => void loadList(openLatest));
        status.append(' ', retry);
      }
    }
  }

  add.addEventListener('click', () => { show('new'); message.focus(); });
  back.addEventListener('click', () => { void loadList(); title.focus(); });
  message.addEventListener('input', () => {
    drafts.set(selected, { body: message.value, requestId: crypto.randomUUID() });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = message.value.trim();
    if (busy || !body) return;
    let draft = drafts.get(selected);
    if (!draft || draft.body.trim() !== body) {
      draft = { body, requestId: crypto.randomUUID() };
      drafts.set(selected, draft);
    }
    busy = true;
    revision++;
    send.disabled = back.disabled = message.disabled = true;
    announcement('Sending…');
    try {
      const path = selected ? api + '/' + encodeURIComponent(selected) + '/messages' : api;
      const { ticket } = await request(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, requestId: draft.requestId })
      });
      drafts.delete(selected);
      show('ticket', ticket.id);
      display(ticket);
      announcement('Message sent.');
    } catch (error) {
      announcement(readableError(error), true);
    } finally {
      busy = false;
      send.disabled = back.disabled = message.disabled = false;
      if (!launcher || !panel.hidden) message.focus();
    }
  });

  async function refresh() {
    if (document.hidden) return;
    if (launcher && (panel.hidden || view !== 'list')) void refreshBadge();
    if (refreshing || busy || view === 'new' || (launcher && panel.hidden)) return;
    const start = revision;
    refreshing = true;
    try {
      if (view === 'list') {
        const { tickets } = await request(api);
        if (start === revision) {
          displayList(tickets);
          announcement('');
        }
      } else {
        const { ticket } = await request(api + '/' + encodeURIComponent(selected));
        if (start === revision) display(ticket);
      }
    } catch { /* A transient refresh failure leaves the conversation and unsent draft available. */ }
    finally { refreshing = false; }
  }

  if (launcher) {
    void refreshBadge();
    const closePanel = () => {
      panel.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    };
    launcher.addEventListener('click', () => {
      if (!panel.hidden) { closePanel(); return; }
      panel.hidden = false;
      launcher.setAttribute('aria-expanded', 'true');
      title.focus();
      if (!initialized || (badge && !badge.hidden)) { initialized = true; void loadList(true); }
      else void refresh();
    });
    el('[data-close]').addEventListener('click', closePanel);
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { event.stopPropagation(); closePanel(); }
    });
  } else {
    const id = new URLSearchParams(location.search).get('ticket');
    if (id) void loadTicket(id);
    else void loadList();
  }
  document.addEventListener('visibilitychange', refresh);
  readChanges?.addEventListener('message', () => void refresh());
  window.setInterval(refresh, 10000);
}
