/** Refresh the active inbox and conversation while the founder writes a reply. */
export function mountSupportInbox(root: Document) {
  const view = root.defaultView;
  const inbox = root.querySelector<HTMLElement>('[data-support-inbox]');
  if (!view || !inbox) return () => {};
  const refreshUrl = inbox.dataset.supportRefresh;
  if (!refreshUrl) return () => {};
  const thread = root.querySelector<HTMLElement>('[data-support-thread]');
  const controller = new AbortController();
  let pending = false;
  async function refresh() {
    if (!view || !refreshUrl || root.hidden || pending || controller.signal.aborted) return;
    pending = true;
    try {
      const response = await view.fetch(refreshUrl, {
        headers: { accept: 'text/vnd.pagecraft.support+html' }, signal: controller.signal,
        cache: 'no-store', redirect: 'error',
      });
      if (!response.ok) return;
      const next = new view.DOMParser().parseFromString(await response.text(), 'text/html');
      for (const [selector, current] of [['[data-support-inbox]', inbox], ['[data-support-thread]', thread]] as const) {
        const incoming = next.querySelector(selector);
        if (!current || !incoming || current.isEqualNode(incoming) || current.contains(root.activeElement)) continue;
        const atEnd = current === thread && current.scrollHeight - current.scrollTop - current.clientHeight < 8;
        current.replaceChildren(...Array.from(incoming.childNodes));
        if (atEnd) current.scrollTop = current.scrollHeight;
      }
    } catch { /* Keep the current conversation and draft through a connection interruption. */ }
    finally { pending = false; }
  }
  const timer = view.setInterval(refresh, 15_000);
  root.addEventListener('visibilitychange', refresh);
  return () => {
    controller.abort();
    view.clearInterval(timer);
    root.removeEventListener('visibilitychange', refresh);
  };
}
