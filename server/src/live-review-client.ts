// @ts-nocheck
/** Browser code serialized into the review shell; all user text uses textContent. */
export function reviewClient() {
  const config = JSON.parse(document.getElementById('review-config').textContent);
  const $ = id => document.getElementById(id);
  const frame = $('site-frame');
  let device = 'desktop', page = 'index.html', pins = [], channel = '', pending = null, selected = null, mode = 'comment', version = null, loading = false;
  const replyDrafts = new Map();
  const widths = { desktop: 1440, tablet: 768, mobile: 390 };
  const error = message => { $('feedback').textContent = message; };
  const api = async (path, body) => {
    const r = await fetch(config.base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not save. Please try again.');
    return data;
  };
  const button = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
  const send = extra => frame.contentWindow?.postMessage({ reviewChannel: channel, ...extra }, '*');
  const fit = () => {
    const work = $('canvas').parentElement;
    work.style.height = innerWidth > 800 ? Math.max(320, innerHeight - (work.getBoundingClientRect().top + scrollY)) + 'px' : 'auto';
    const scale = Math.min(1, Math.max(0.1, ($('canvas').clientWidth - 32) / widths[device]));
    frame.style.width = widths[device] + 'px';
    frame.style.height = Math.max(300, ($('canvas').clientHeight - 32) / scale) + 'px';
    frame.style.transform = `scale(${scale})`;
    $('frame-wrap').style.width = widths[device] * scale + 'px';
    $('frame-wrap').style.marginLeft = Math.floor(Math.max(0, ($('canvas').clientWidth - 32 - widths[device] * scale) / 2)) + 'px';
    $('frame-wrap').style.height = frame.style.height.replace('px', '') * scale + 'px';
    $('viewport-size').textContent = widths[device] + ' px';
  };
  new ResizeObserver(fit).observe($('canvas'));
  addEventListener('resize', fit);
  document.querySelector('.sharing')?.addEventListener('toggle', fit);
  const visible = () => pins.filter(p => p.page === page && p.device === device && ($('status-filter').value === 'all' || p.done === ($('status-filter').value === 'done')));
  const render = () => {
    const list = $('threads'); list.replaceChildren();
    const rows = visible();
    $('thread-count').textContent = rows.length + (rows.length === 1 ? ' comment' : ' comments');
    if (!rows.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'No ' + ($('status-filter').value === 'all' ? '' : $('status-filter').value + ' ') + 'comments on this ' + device + ' page. Choose Comment, then click anywhere on the site to add a pin.'; list.append(p); }
    rows.forEach(pin => {
      const article = document.createElement('article'); article.id = 'thread-' + pin.id; article.className = 'thread' + (selected === pin.id ? ' selected' : '');
      const heading = button('#' + (pins.findIndex(p => p.id === pin.id) + 1) + ' · ' + pin.author.name + (pin.done ? ' · Done' : ''), () => { selected = pin.id; send({ focus: pin.id }); render(); });
      heading.className = 'thread-heading'; article.append(heading);
      const body = document.createElement('p'); body.textContent = pin.body; article.append(body);
      const time = document.createElement('time'); time.dateTime = pin.createdAt; time.textContent = new Date(pin.createdAt).toLocaleString(); article.append(time);
      if (selected === pin.id) {
        pin.replies.forEach(reply => { const p = document.createElement('p'); p.className = 'reply'; const name = document.createElement('strong'); name.textContent = reply.author.name + ': '; p.append(name, document.createTextNode(reply.body)); article.append(p); });
        const form = document.createElement('form'), input = document.createElement('textarea'); input.required = true; input.maxLength = 4000; input.placeholder = 'Reply to this comment'; input.setAttribute('aria-label', 'Reply to comment'); input.value = replyDrafts.get(pin.id) || ''; input.oninput = () => replyDrafts.set(pin.id, input.value);
        const submit = document.createElement('button'); submit.textContent = 'Reply'; form.append(input, submit);
        form.onsubmit = async e => { e.preventDefault(); submit.disabled = true; try { await api('/reply', { pinId: pin.id, body: input.value }); replyDrafts.delete(pin.id); await refresh(); } catch (e) { error(e.message); submit.disabled = false; } }; article.append(form);
        if (config.canResolve) article.append(button(pin.done ? 'Reopen' : 'Mark done', async () => { try { await api('/resolve', { pinId: pin.id, done: !pin.done }); await refresh(); } catch (e) { error(e.message); } }));
      }
      list.append(article);
    });
    send({ pins: rows.map(p => ({ ...p, number: pins.findIndex(v => v.id === p.id) + 1 })), mode });
  };
  const refresh = async (preserveDraft = false) => { const data = await api('/state'); pins = data.pins; if (!preserveDraft || !pending && document.activeElement?.tagName !== 'TEXTAREA') render(); if (version !== null && data.version !== version) { $('update-site').hidden = false; $('update-site').textContent = 'Site updated — load latest'; if (!pending && ![...replyDrafts.values()].some(value => value.trim()) && document.activeElement?.tagName !== 'TEXTAREA') await load(); } };
  const load = async () => {
    if (loading) return; loading = true; error('Loading site…'); pending = null; $('new-comment').hidden = true;
    try { const data = await api('/preview?page=' + encodeURIComponent(page)); channel = data.channel; version = data.version; frame.srcdoc = data.html; $('update-site').hidden = true; error(''); }
    catch (e) { error(e.message); } finally { loading = false; }
  };
  frame.onload = () => { fit(); render(); };
  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow || e.data?.reviewChannel !== channel) return;
    const d = e.data;
    if (d.pin && mode === 'comment') { pending = d.pin; $('new-comment').hidden = false; $('new-body').focus(); }
    if (d.select && pins.some(p => p.id === d.select)) { selected = d.select; render(); if (innerWidth <= 800) { const thread = $('thread-' + selected); thread?.scrollIntoView({ block: 'start' }); thread?.querySelector('button')?.focus({ preventScroll: true }); } }
    if (typeof d.navigate === 'string' && config.pages.some(p => p.path === d.navigate)) { page = d.navigate; $('page-select').value = page; load(); }
  });
  $('new-comment').onsubmit = async e => {
    e.preventDefault(); if (!pending) return;
    $('save-comment').disabled = true;
    try { await api('/pin', { ...pending, page, device, body: $('new-body').value }); $('new-body').value = ''; pending = null; $('new-comment').hidden = true; await refresh(); error('Comment added.'); }
    catch (e) { error(e.message); } finally { $('save-comment').disabled = false; }
  };
  $('cancel-comment').onclick = () => { pending = null; $('new-comment').hidden = true; };
  document.querySelectorAll('[data-device]').forEach(b => b.onclick = () => { device = b.dataset.device; pending = null; $('new-comment').hidden = true; document.querySelectorAll('[data-device]').forEach(v => v.setAttribute('aria-pressed', String(v === b))); fit(); render(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(v => v.setAttribute('aria-pressed', String(v === b))); render(); });
  $('page-select').onchange = () => { page = $('page-select').value; load(); };
  $('status-filter').onchange = render;
  $('update-site').onclick = load;
  document.querySelectorAll('[data-copy-link]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(new URL(b.dataset.copyLink, location.origin).href); error('Review link copied.'); } catch { error('Copy the review link from the address bar.'); } });
  refresh().then(load).catch(e => error(e.message));
  setInterval(() => { if (!document.hidden) refresh(true).catch(e => error(e.message)); }, 15000);
}

/** Runs inside an opaque iframe. Only placement and navigation events cross the boundary. */
export function reviewBridge(channel) {
  let mode = 'comment', pins = [];
  const layer = document.createElement('div'); layer.id = 'pc-review-pins';
  Object.assign(layer.style, { position: 'absolute', top: '0', left: '0', width: '0', height: '0', zIndex: '2147483647' }); document.body.append(layer);
  const send = data => parent.postMessage({ reviewChannel: channel, ...data }, '*');
  const target = id => id ? document.getElementById(id) : null;
  const draw = () => {
    layer.replaceChildren();
    pins.forEach(p => { const el = target(p.nodeId), r = el?.getBoundingClientRect(); const x = r ? r.left + scrollX + r.width * p.nodeX : p.x * innerWidth; const y = r ? r.top + scrollY + r.height * p.nodeY : p.y;
      const b = document.createElement('button'); b.textContent = p.number; b.type = 'button'; b.setAttribute('aria-label', 'Open comment ' + p.number);
      Object.assign(b.style, { position: 'absolute', left: x + 'px', top: y + 'px', transform: 'translate(-50%,-50%)', width: '28px', height: '28px', borderRadius: '50%', border: '2px solid white', background: p.done ? '#52615a' : '#285c36', color: '#fff', cursor: 'pointer', font: 'bold 12px sans-serif', padding: '0' });
      b.onclick = e => { e.stopPropagation(); send({ select: p.id }); }; layer.append(b);
    });
  };
  addEventListener('message', e => { if (e.source !== parent || e.data?.reviewChannel !== channel) return; const d = e.data; if (d.mode) mode = d.mode; if (d.pins) { pins = d.pins; draw(); } if (d.focus) { const p = pins.find(p => p.id === d.focus); if (p) { const el = target(p.nodeId); if (el) el.scrollIntoView({ block: 'center' }); else scrollTo(0, Math.max(0, p.y - innerHeight / 2)); } } document.documentElement.style.cursor = mode === 'comment' ? 'crosshair' : ''; });
  document.addEventListener('click', e => {
    if (layer.contains(e.target)) return;
    if (mode === 'comment') {
      e.preventDefault(); e.stopImmediatePropagation(); const el = e.target.closest('[id]'), r = el?.getBoundingClientRect();
      send({ pin: { x: Math.max(0, Math.min(1, (e.clientX + scrollX) / innerWidth)), y: Math.max(0, e.clientY + scrollY), nodeId: el?.id || '', nodeX: r?.width ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0, nodeY: r?.height ? Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) : 0 } });
    } else { const a = e.target.closest('a'); if (a) { const href = a.getAttribute('href') || ''; if (href.startsWith('#')) return; e.preventDefault(); const url = new URL(href, 'https://review.invalid/' + document.documentElement.dataset.reviewPage); if (url.origin !== 'https://review.invalid') return; const path = url.pathname.slice(1); send({ navigate: path.endsWith('/') ? path + 'index.html' : path || 'index.html' }); } }
  }, true);
  document.addEventListener('submit', e => e.preventDefault(), true);
  addEventListener('resize', draw); new ResizeObserver(draw).observe(document.body);
}
