/** Rasterize the inert saved homepage once, then let the host cache the
 * small image. No live frames, authored scripts, public-page requests or screenshot workers. */
/**
 * @param {Document} doc
 * @param {AbortSignal} [signal]
 * @param {string} [baseUrl]
 * @param {(body: Element, css: string) => ({ images: Set<Element>, shown: Set<string> } | null)} [measure] replaces the layout step in tests
 */
export async function captureSitePreview(doc, signal, baseUrl = doc.baseURI, measure) {
  // The thumbnail shows only the first desktop screen, so only images drawn there are
  // fetched. Each draft image costs seconds on the host; a homepage has many below the fold.
  const W = 1368, H = 855;
  const URL_PATTERN = /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi;
  const FONT = /\.(woff2?|ttf|otf|eot)([?#]|$)/i;
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  // Lays out a copy with every resource neutralised (nothing is fetched, no script runs) and
  // reports which <img> elements and CSS image URLs land on the first screen. Images without
  // known dimensions collapse, which moves later content up: the error only ever adds images.
  const measureFold = (body, css) => {
    if (typeof document === 'undefined' || !document.body) return null;
    const frame = document.createElement('iframe');
    try {
      const urls = [];
      const neutral = text => String(text).replace(URL_PATTERN, (_m, _q, raw) => {
        let i = urls.indexOf(raw); if (i < 0) i = urls.push(raw) - 1;
        return `url("data:,pc${i}")`;
      });
      frame.setAttribute('sandbox', 'allow-same-origin'); frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
      frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;border:0;visibility:hidden;pointer-events:none`;
      document.body.append(frame);
      const fdoc = frame.contentDocument, view = frame.contentWindow;
      if (!fdoc || !view || !fdoc.body) return null;
      const copy = fdoc.importNode(body, true);
      const originals = [body, ...body.querySelectorAll('*')], copies = [copy, ...copy.querySelectorAll('*')];
      if (originals.length !== copies.length) return null;
      copies.forEach(node => {
        ['src', 'srcset', 'poster'].forEach(name => node.removeAttribute(name));
        if (node.hasAttribute('style')) node.setAttribute('style', neutral(node.getAttribute('style')));
      });
      const style = fdoc.createElement('style');
      style.textContent = neutral(css) + `\nhtml,body{width:${W}px!important;height:${H}px!important;margin:0!important;overflow:hidden!important}*,*::before,*::after{animation:none!important;transition:none!important}`;
      fdoc.head.append(style);
      fdoc.documentElement.replaceChild(copy, fdoc.body);
      if (!copy.getBoundingClientRect().width) return null; // no layout engine (tests, detached views)
      const images = new Set(), shown = new Set();
      copies.forEach((node, i) => {
        const r = node.getBoundingClientRect();
        const across = r.left < W && r.right > 0 && r.top < H;
        if (node.tagName === 'IMG') { if (across && r.bottom >= 0) images.add(originals[i]); return; }
        const fold = across && r.bottom > 0 && r.width > 0 && r.height > 0;
        for (const pseudo of [null, '::before', '::after']) {
          const cs = view.getComputedStyle(node, pseudo);
          const used = [cs.backgroundImage, cs.maskImage, cs.webkitMaskImage, cs.listStyleImage, cs.borderImageSource, cs.content].join(' ');
          // A pseudo-element can be positioned anywhere around its box; count it when the box is near.
          const near = pseudo ? across && r.bottom > -H : fold;
          for (const m of used.matchAll(/data:,pc(\d+)/g)) if (near) shown.add(urls[Number(m[1])]);
        }
      });
      return { images, shown };
    } catch {
      return null;
    } finally {
      frame.remove();
    }
  };
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
    const url = new URL(raw, baseUrl).href;
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
  // Compiler styles include local font faces. Resolve linked font stylesheets too.
  const sheets = await Promise.all([...doc.querySelectorAll('style,link[rel="stylesheet"]')].map(async node => {
    if (node.tagName === 'STYLE') return { css: node.textContent || '', base: baseUrl };
    const response = await fetch(new URL(node.getAttribute('href'), baseUrl), { credentials: 'same-origin', signal });
    if (!response.ok) throw new Error('Preview styles unavailable');
    return { css: await response.text(), base: new URL(node.getAttribute('href'), baseUrl).href };
  }));
  const fold = (measure || measureFold)(clone, sheets.map(s => s.css).join('\n'));
  const images = [...clone.querySelectorAll('img')];
  await Promise.all(images.map(async image => {
    const offscreen = fold && !fold.images.has(image);
    image.setAttribute('src', offscreen ? BLANK : await embed(image.getAttribute('src')));
    image.removeAttribute('srcset'); image.removeAttribute('loading');
  }));
  const inlineUrls = async (css, base) => {
    const urls = [...new Set([...css.matchAll(URL_PATTERN)].map(m => m[2]))];
    await Promise.all(urls.map(async raw => {
      if (/^(data:|#)/i.test(raw)) return;
      // Fonts may shape first-screen text; other images are kept only when drawn there.
      const data = fold && !fold.shown.has(raw) && !FONT.test(raw) ? BLANK : await embed(new URL(raw, base).href);
      css = css.split(raw).join(data);
    }));
    return css;
  };
  let css = (await Promise.all(sheets.map(s => inlineUrls(s.css, s.base)))).join('\n');
  await Promise.all([...clone.querySelectorAll('[style]'), clone].map(async node => {
    if (node.hasAttribute('style')) node.setAttribute('style', await inlineUrls(node.getAttribute('style'), baseUrl));
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
      const timer = setTimeout(() => controller.abort(), 60000);
      status(state, 'Updating preview…');
      try {
        const source = await fetch(state.card.dataset.previewSource + '&publication=' + encodeURIComponent(version.split(':')[1] || ''), {
          cache: 'no-store', signal: controller.signal,
        });
        if (!source.ok) throw new Error('Preview unavailable');
        const doc = new DOMParser().parseFromString(await source.text(), 'text/html');
        // An inert document has no browsing context: authored scripts never run and
        // images/fonts are fetched exactly once, explicitly by the capture function.
        doc.querySelectorAll('base').forEach(node => node.remove());
        const baseUrl = source.url || new URL(state.card.dataset.previewSource, location.href).href;
        if (doc?.documentElement.dataset.dashboardPreview !== 'ready') throw new Error('Preview unavailable');
        if (doc.documentElement.dataset.previewVersion !== version) {
          // A save overtook navigation. Never cache these pixels under the previous key.
          state.version = doc.documentElement.dataset.previewVersion || version;
          throw new Error('Preview version changed');
        }
        const snapshot = await capture(doc, controller.signal, baseUrl);
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
      } catch (error) {
        console.warn('Pagecraft preview capture failed:', error);
        if (version === state.version) status(state, state.card.classList.contains('is-ready') ? 'Previous preview shown.' : 'Preview unavailable.', true);
      } finally {
        clearTimeout(timer); state.running = false;
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
    const visible = [...states.values()].filter(s => s.visible);
    try {
      const response = await fetch('/api/sites?previews=1', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Unavailable');
      const sites = await response.json();
      if (!Array.isArray(sites)) throw new Error('Unavailable');
      await Promise.allSettled(visible.map(async state => {
        try {
          const result = sites.find(site => site.id === state.card.dataset.previewSite);
          if (!result) throw new Error('Unavailable');
          const version = result.previewVersion;
          if (!version) return;
          if (version === state.version) {
            if (state.completed === version && !state.running) status(state, '');
            return;
          }
          state.controller?.abort(); state.version = version; state.card.dataset.previewVersion = version;
          state.card.dataset.previewSource = '/api/sites/' + encodeURIComponent(state.card.dataset.previewSite) + '/dashboard-preview/index.html?v=' + result.version;
          if (result.cachedPreviewVersion === version && result.previewUrl) {
            await showImage(state, result.previewUrl, version);
            if (state.version === version) { state.completed = version; status(state, ''); }
          } else generate(state);
        } catch { status(state, 'Preview freshness could not be checked.', true); }
      }));
    } catch { visible.forEach(state => status(state, 'Preview freshness could not be checked.', true)); }
    finally { refreshing = false; }
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
