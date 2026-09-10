/** Rasterize the already-sandboxed saved homepage once, then let the host cache the
 * small image. No authored scripts, public-page requests or screenshot workers. */
export async function captureSitePreview(doc, signal) {
  const dataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const resources = new Map();
  let embeddedBytes = 0;
  const embed = raw => {
    if (!raw || /^(data:|#)/i.test(raw)) return Promise.resolve(raw);
    const url = new URL(raw, doc.baseURI).href;
    if (!resources.has(url)) resources.set(url, (async () => {
      const response = await fetch(url, { credentials: 'same-origin', signal });
      if (!response.ok) throw new Error('Preview asset unavailable');
      const blob = await response.blob();
      embeddedBytes += blob.size;
      if (blob.size > 8 * 1024 * 1024 || embeddedBytes > 32 * 1024 * 1024) throw new Error('Preview assets too large');
      return dataUrl(blob);
    })());
    return resources.get(url);
  };
  const clone = doc.body.cloneNode(true);
  clone.querySelectorAll('script,iframe,object,embed,link').forEach(node => node.remove());
  clone.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => {
    if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
  }));
  const images = [...clone.querySelectorAll('img')];
  await Promise.all(images.map(async image => {
    image.setAttribute('src', await embed(image.getAttribute('src')));
    image.removeAttribute('srcset'); image.removeAttribute('loading');
  }));
  // Compiler styles include local font faces. Resolve linked font stylesheets too.
  const sheets = await Promise.all([...doc.querySelectorAll('style,link[rel="stylesheet"]')].map(async node => {
    if (node.tagName === 'STYLE') return { css: node.textContent || '', base: doc.baseURI };
    const response = await fetch(node.href, { credentials: 'same-origin', signal });
    if (!response.ok) throw new Error('Preview styles unavailable');
    return { css: await response.text(), base: node.href };
  }));
  const inlineUrls = async (css, base) => {
    const urls = [...new Set([...css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi)].map(m => m[2]))];
    await Promise.all(urls.map(async raw => {
      if (/^(data:|#)/i.test(raw)) return;
      const data = await embed(new URL(raw, base).href);
      css = css.split(raw).join(data);
    }));
    return css;
  };
  let css = (await Promise.all(sheets.map(s => inlineUrls(s.css, s.base)))).join('\n');
  await Promise.all([...clone.querySelectorAll('[style]'), clone].map(async node => {
    if (node.hasAttribute('style')) node.setAttribute('style', await inlineUrls(node.getAttribute('style'), doc.baseURI));
  }));
  // Fixed desktop viewport, independent of the dashboard's card size or device width.
  css += '\nhtml,body{width:1368px!important;height:855px!important;margin:0!important;overflow:hidden!important}*,*::before,*::after{animation:none!important;transition:none!important}';
  const markup = new XMLSerializer().serializeToString(clone);
  const style = doc.createElement('style'); style.textContent = css;
  const serializedStyle = new XMLSerializer().serializeToString(style);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1368" height="855"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${serializedStyle}${markup}</div></foreignObject></svg>`;
  const image = new Image();
  // A data URL keeps a self-contained foreignObject origin-clean for canvas export.
  image.src = await dataUrl(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  await image.decode();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Preview rendering unavailable');
  context.fillStyle = '#fff'; context.fillRect(0, 0, 960, 600);
  context.drawImage(image, 0, 0, 960, 600);
  const snapshot = canvas.toDataURL('image/webp', .78);
  if (!snapshot.startsWith('data:image/webp;')) throw new Error('Preview format unavailable');
  return snapshot;
}

export function installSitePreviews(capture) {
  document.querySelectorAll('.pc-site-preview:not([data-preview-site]) img').forEach(image => {
    const ready = () => image.parentElement.classList.add('is-ready');
    image.addEventListener('load', ready, { once: true });
    if (image.complete && image.naturalWidth) ready();
  });
  const cards = [...document.querySelectorAll('[data-preview-site]')];
  const states = new Map();
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < 2 && queue.length) {
      const job = queue.shift(); active++;
      job().finally(() => { active--; pump(); });
    }
  };
  const showImage = (state, url, version = state.version) => new Promise((resolve, reject) => {
    const image = new Image(); image.alt = ''; image.decoding = 'async';
    const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Preview image timed out')); }, 10000);
    image.onload = () => {
      clearTimeout(timeout);
      if (state.disposed || state.version !== version) return resolve();
      state.card.querySelector('img')?.remove();
      state.card.prepend(image); state.card.classList.add('is-ready');
      resolve();
    };
    image.onerror = error => { clearTimeout(timeout); reject(error); }; image.src = url;
  });
  const status = (state, text, retry = false) => {
    state.card.setAttribute('aria-busy', String(text === 'Updating preview…'));
    state.notice.hidden = !text; state.message.textContent = text;
    const fallback = state.card.querySelector('.pc-preview-fallback span');
    if (fallback) fallback.textContent = retry ? 'Preview unavailable' : 'Loading preview…';
    state.retry.hidden = !retry;
  };
  const generate = state => {
    if (state.disposed || !state.visible || state.running || state.completed === state.version) return;
    state.running = true;
    const version = state.version, controller = new AbortController();
    state.controller = controller;
    queue.push(async () => {
      if (controller.signal.aborted) { state.running = false; generate(state); return; }
      const timer = setTimeout(() => controller.abort(), 30000);
      let frame;
      status(state, 'Updating preview…');
      try {
        frame = document.createElement('iframe'); frame.className = 'pc-draft-preview';
        frame.setAttribute('sandbox', 'allow-same-origin'); frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1; frame.title = 'Generating site preview';
        // It is a renderer, never the visible card. Fixed layout avoids resize observers.
        frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1368px;height:855px;opacity:0;pointer-events:none';
        await new Promise((resolve, reject) => {
          frame.onload = resolve; frame.onerror = reject;
          controller.signal.addEventListener('abort', () => reject(new Error('Preview timed out')), { once: true });
          frame.src = state.card.dataset.previewSource + '&publication=' + encodeURIComponent(version.split(':')[1] || '');
          document.body.append(frame);
        });
        const doc = frame.contentDocument;
        if (doc?.documentElement.dataset.dashboardPreview !== 'ready') throw new Error('Preview unavailable');
        if (doc.documentElement.dataset.previewVersion !== version) {
          // A save overtook navigation. Never cache these pixels under the previous key.
          state.version = doc.documentElement.dataset.previewVersion || version;
          throw new Error('Preview version changed');
        }
        const snapshot = await capture(doc, controller.signal);
        if (version !== state.version || controller.signal.aborted) return;
        const response = await fetch('/api/sites/' + encodeURIComponent(state.card.dataset.previewSite) + '/dashboard-thumbnail', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ version, snapshot }), signal: controller.signal,
        });
        if (!response.ok) throw new Error('Preview could not be stored');
        const result = await response.json();
        if (version !== state.version || controller.signal.aborted) return;
        await showImage(state, result.url, version);
        if (version !== state.version || controller.signal.aborted) return;
        state.completed = version; state.card.dataset.cachedPreviewVersion = version;
        status(state, '');
      } catch {
        if (version === state.version) status(state, state.card.classList.contains('is-ready') ? 'Previous preview shown.' : 'Preview unavailable.', true);
      } finally {
        clearTimeout(timer); frame?.remove(); state.running = false;
        if (version !== state.version) generate(state);
      }
    });
    pump();
  };
  cards.forEach(card => {
    const state = { card, version: card.dataset.previewVersion, completed: card.dataset.cachedPreviewVersion || '', visible: false, running: false };
    state.notice = document.createElement('div'); state.notice.className = 'pc-preview-status'; state.notice.hidden = true;
    state.message = document.createElement('span'); state.message.setAttribute('role', 'status');
    state.retry = document.createElement('button'); state.retry.type = 'button'; state.retry.className = 'pc-btn'; state.retry.textContent = 'Retry';
    state.retry.setAttribute('aria-label', 'Retry preview for ' + card.closest('[data-site-card]').querySelector('.pc-site-name').textContent);
    state.retry.onclick = () => { state.completed = ''; generate(state); };
    state.notice.append(state.message, state.retry); card.append(state.notice);
    const image = card.querySelector('img');
    if (image) {
      const ready = () => card.classList.add('is-ready');
      const failed = () => { state.completed = ''; image.remove(); generate(state); };
      image.addEventListener('load', ready, { once: true }); image.addEventListener('error', failed, { once: true });
      if (image.complete) (image.naturalWidth ? ready : failed)();
    }
    states.set(card, state);
  });
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const state = states.get(entry.target); state.visible = entry.isIntersecting;
    if (state.visible) generate(state);
  }), { rootMargin: '200px' });
  cards.forEach(card => observer.observe(card));
  let refreshing = false;
  const refresh = async () => {
    if (document.hidden || refreshing) return;
    refreshing = true;
    try { await Promise.allSettled([...states.values()].filter(s => s.visible).map(async state => {
      try {
        const response = await fetch('/api/sites/' + encodeURIComponent(state.card.dataset.previewSite) + '/publication', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        const version = result.previewVersion;
        if (!version) return;
        if (version === state.version) {
          if (state.completed === version && !state.running) status(state, '');
          return;
        }
        state.controller?.abort(); state.version = version; state.card.dataset.previewVersion = version;
        state.card.dataset.previewSource = '/api/sites/' + encodeURIComponent(state.card.dataset.previewSite) + '/dashboard-preview/index.html?v=' + result.draftVersion;
        if (result.cachedPreviewVersion === version && result.previewUrl) {
          await showImage(state, result.previewUrl, version);
          if (state.version === version) { state.completed = version; status(state, ''); }
        } else generate(state);
      } catch { status(state, 'Preview freshness could not be checked.', true); }
    })); } finally { refreshing = false; }
  };
  window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
  const interval = setInterval(refresh, 30000);
  window.addEventListener('pageshow', event => {
    if (event.persisted) { states.forEach(state => { state.disposed = false; observer.observe(state.card); }); refresh(); }
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) clearInterval(interval); observer.disconnect();
    states.forEach(state => { state.disposed = true; state.controller?.abort(); });
  });
}
export const SITE_PREVIEWS_BOOT_SCRIPT = `(${installSitePreviews.toString()})(${captureSitePreview.toString()});`;
