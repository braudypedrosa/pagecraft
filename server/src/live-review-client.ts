// @ts-nocheck
/** Browser code serialized into the review shell; all user text uses textContent. */
export function reviewClient() {
  const config = JSON.parse(document.getElementById('review-config').textContent);
  const $ = id => document.getElementById(id);
  const frame = $('site-frame');
  let device = 'desktop', page = config.pages[0]?.path || 'index.html', pins = [], channel = '', pending = null, selected = null, mode = 'comment', version = null, loading = false;
  const replyDrafts = new Map();
  let targetMode = 'element', feedbackTimer, structure = [], anchors = new Map(), activeSection = null;
  const uiIcon = () => document.querySelector('[data-mode="comment"] svg')?.cloneNode(true);
  const widths = { desktop: 1440, tablet: 768, mobile: 390 };
  const error = message => { clearTimeout(feedbackTimer); $('feedback').textContent = message; if (message && !message.includes('Loading')) feedbackTimer = setTimeout(() => { $('feedback').textContent = ''; }, 6000); };
  const api = async (path, body) => {
    const r = await fetch(config.base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not save. Please try again.');
    return data;
  };
  const button = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; return b; };
  const send = extra => {
    const css = getComputedStyle(document.documentElement);
    const theme = Object.fromEntries(['ink','craft-green','on-ink','selection-text','selection-muted','selection-bg'].map(key => [key, css.getPropertyValue('--pc-' + key).trim()]));
    frame.contentWindow?.postMessage({ reviewChannel: channel, theme, ...extra }, '*');
  };
  const fit = () => {
    const canvas = $('canvas'), inset = innerWidth <= 800 ? 24 : 40;
    const scale = Math.min(1, Math.max(0.1, (canvas.clientWidth - inset) / widths[device]));
    frame.style.width = widths[device] + 'px';
    frame.style.height = Math.max(200, (canvas.clientHeight - inset / 2) / scale) + 'px';
    frame.style.transform = `scale(${scale})`;
    $('frame-wrap').style.width = widths[device] * scale + 'px';
    $('frame-wrap').style.marginLeft = Math.floor(Math.max(0, (canvas.clientWidth - inset - widths[device] * scale) / 2)) + 'px';
    $('frame-wrap').style.height = parseFloat(frame.style.height) * scale + 'px';
    $('viewport-size').textContent = widths[device] + ' px · ' + Math.round(scale * 100) + '%';
  };
  new ResizeObserver(fit).observe($('canvas'));
  addEventListener('resize', fit);
  $('open-share')?.addEventListener('click', () => $('share-dialog').showModal());
  $('close-share')?.addEventListener('click', () => $('share-dialog').close());
  const visible = () => pins.filter(p => p.page === page && p.device === device && ($('status-filter').value === 'all' || p.done === ($('status-filter').value === 'done')));
  const avatar = name => { const el = document.createElement('span'); el.className = 'avatar'; el.setAttribute('aria-hidden','true'); el.textContent = name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase(); return el; };
  const timestamp = value => { const el = document.createElement('time'); el.dateTime = value; el.textContent = new Date(value).toLocaleString(undefined, {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); return el; };
  const pageName = () => config.pages.find(p => p.path === page)?.name || page;
  const sectionOf = pin => anchors.get(pin.nodeId)?.sectionId || 'unplaced';
  const selectPin = id => { selected = id; activeSection = sectionOf(pins.find(p => p.id === id) || {}); send({focus:id}); render(); if(innerWidth<=800){const thread=$('thread-'+id);thread?.scrollIntoView({block:'start'});thread?.querySelector('button')?.focus({preventScroll:true});} };
  const navigate = next => { page = next; selected = null; activeSection = null; structure = []; anchors = new Map(); $('page-select').value = page; load(); render(); };
  const renderOutline = () => {
    const nav = $('site-outline'); nav.replaceChildren();
    const rows = visible();
    $('site-feedback-count').textContent = rows.length + (rows.length === 1 ? ' comment' : ' comments');
    if (!rows.length) {
      const hint = document.createElement('p'); hint.className = 'outline-hint';
      hint.textContent = loading ? 'Loading comments…' : 'No comments in this view. Select an element on the site to leave feedback.';
      nav.append(hint);
    }
    rows.forEach(pin => {
      const number = pins.findIndex(v => v.id === pin.id) + 1;
      const item = button('', () => selectPin(pin.id)); item.className = 'outline-feedback';
      item.setAttribute('aria-pressed', String(selected === pin.id));
      item.setAttribute('aria-label', 'Open comment ' + number);
      const badge = document.createElement('span'); badge.className = 'feedback-index'; badge.textContent = '#' + number;
      const text = document.createElement('span');
      const author = document.createElement('strong'); author.textContent = pin.author.name;
      const excerpt = document.createElement('span'); excerpt.textContent = pin.body;
      text.append(author, excerpt); item.append(badge, text); nav.append(item);
    });
  };
  const render = () => {
    const list = $('threads'); list.replaceChildren();
    renderOutline();
    const rows = visible().filter(pin => pin.id === selected);
    const inspectorOpen = !!pending || rows.length > 0;
    $('conversation-inspector').hidden = !inspectorOpen; document.querySelector('.work').classList.toggle('inspecting', inspectorOpen);
    const current = pending || rows[0]; const anchor = current && anchors.get(current.nodeId);
    const section = structure.find(s => s.id === anchor?.sectionId);
    $('selection-path').textContent = [pageName(),section?.label,anchor?.label || (current ? 'Page comment' : '')].filter(Boolean).join(' › ');
    const editor = $('open-editor');editor.hidden = !config.editorUrl || !current;
    if(!editor.hidden) editor.href = config.editorUrl + '?reviewPage=' + encodeURIComponent(page) + '&reviewNode=' + encodeURIComponent(current.nodeId || '');
    $('inspector-note').hidden = !editor.hidden;
    $('scope-page').textContent = config.pages.find(p => p.path === page)?.name || page;
    $('scope-device').textContent = device[0].toUpperCase() + device.slice(1);
    document.querySelectorAll('[data-status]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === $('status-filter').value)));
    $('thread-count').textContent = rows.length + (rows.length === 1 ? ' comment' : ' comments');
    if (!rows.length && !pending) {
      const empty = document.createElement('div'); empty.className = 'empty';
      const glyph = uiIcon(); if (glyph) empty.append(glyph);
      const title = document.createElement('strong'); title.textContent = $('status-filter').value === 'done' ? 'No resolved comments yet' : 'A fresh perspective starts here';
      const text = document.createElement('p'); text.textContent = $('status-filter').value === 'done' ? 'Completed feedback will appear here.' : 'Choose Comment, then select an element or section on the site to leave your feedback.';
      empty.append(title, text); list.append(empty);
    }
    rows.forEach(pin => {
      const article = document.createElement('article'); article.id = 'thread-' + pin.id; article.className = 'thread' + (selected === pin.id ? ' selected' : '');
      const heading = button('#' + (pins.findIndex(p => p.id === pin.id) + 1) + ' · ' + pin.author.name + (pin.done ? ' · Done' : ''), () => { selected = selected === pin.id ? null : pin.id; if (selected) send({ focus: pin.id }); render(); });
      heading.className = 'thread-heading'; heading.setAttribute('aria-expanded', String(selected === pin.id));
      const author = document.createElement('span'); author.textContent = pin.author.name;
      const number = document.createElement('span'); number.className = 'pin-number'; number.textContent = '#' + (pins.findIndex(p => p.id === pin.id) + 1);
      const authorDetails = document.createElement('span'); authorDetails.className = 'author-details'; authorDetails.append(author, timestamp(pin.createdAt));
      heading.setAttribute('aria-label', pin.author.name + ' ' + number.textContent);
      heading.replaceChildren(avatar(pin.author.name), authorDetails, number); article.append(heading);
      const body = document.createElement('p'); body.textContent = pin.body; body.className = 'thread-body'; article.append(body);
      const meta = document.createElement('div'); meta.className = 'thread-meta'; const glyph = uiIcon(); if (glyph) meta.append(glyph); meta.append(document.createTextNode(pin.replies.length + (pin.replies.length === 1 ? ' reply' : ' replies') + (pin.done ? ' · Resolved' : ' · Open'))); article.append(meta);
      if (selected === pin.id) {
        if (pin.replies.length) {
          const replies = document.createElement('ol'); replies.className = 'reply-list'; replies.setAttribute('aria-label','Replies');
          pin.replies.forEach(reply => {
            const item = document.createElement('li'); item.className = 'reply';
            const content = document.createElement('div'); content.className = 'reply-content';
            const name = document.createElement('strong'); name.textContent = reply.author.name;
            const text = document.createElement('p'); text.textContent = reply.body;
            content.append(name,timestamp(reply.createdAt),text); item.append(avatar(reply.author.name),content); replies.append(item);
          });
          article.append(replies);
        }
        const form = document.createElement('form'), input = document.createElement('textarea'); input.required = true; input.maxLength = 4000; input.placeholder = 'Reply to this comment'; input.setAttribute('aria-label', 'Reply to comment'); input.value = replyDrafts.get(pin.id) || ''; input.oninput = () => replyDrafts.set(pin.id, input.value);
        const submit = document.createElement('button'); submit.textContent = 'Reply'; form.append(input, submit);
        form.onsubmit = async e => { e.preventDefault(); submit.disabled = true; try { await api('/reply', { pinId: pin.id, body: input.value }); replyDrafts.delete(pin.id); await refresh(); } catch (e) { error(e.message); submit.disabled = false; } }; article.append(form);
        if (config.canResolve) { const resolve = button(pin.done ? 'Reopen' : 'Mark fixed', async () => { try { await api('/resolve', { pinId: pin.id, done: !pin.done }); await refresh(); } catch (e) { error(e.message); } }); resolve.className = 'resolve' + (pin.done ? '' : ' primary'); article.append(resolve); }
      }
      list.append(article);
    });
    send({ pins: visible().map(p => ({ ...p, number: pins.findIndex(v => v.id === p.id) + 1 })), mode, targetMode, selected, pending });
  };
  const refresh = async (preserveDraft = false) => { const data = await api('/state'); pins = data.pins; if (!preserveDraft || !pending && document.activeElement?.tagName !== 'TEXTAREA') render(); if (version !== null && data.version !== version) { $('update-site').hidden = false; $('update-site').textContent = 'Site updated — load latest'; if (!pending && ![...replyDrafts.values()].some(value => value.trim()) && document.activeElement?.tagName !== 'TEXTAREA') await load(); } };
  const load = async () => {
    if (loading) return; loading = true; error('Loading site…'); pending = null; $('new-comment').hidden = true;
    try { const data = await api('/preview?page=' + encodeURIComponent(page)); channel = data.channel; version = data.version; frame.srcdoc = data.html; $('update-site').hidden = true; error(''); }
    catch (e) { error(e.message); } finally { loading = false; }
  };
  frame.onload = () => { fit(); render(); send({requestOutline:true}); };
  window.addEventListener('message', e => {
    if (e.source !== frame.contentWindow || e.data?.reviewChannel !== channel) return;
    const d = e.data;
    if (d.cancel) { pending = null; $('new-comment').hidden = true; $('new-body').value = ''; render(); }
    if (Array.isArray(d.outline) && Array.isArray(d.anchors)) { structure = d.outline.slice(0,200); anchors = new Map(d.anchors.slice(0,5000).map(a => [a.id,a])); render(); }
    if (d.pin && mode === 'comment' && !pending) { pending = d.pin; selected = null; $('new-comment').hidden = false; $('anchor-label').textContent = d.label || 'Selected ' + targetMode; render(); $('new-body').focus(); }
    if (d.select && pins.some(p => p.id === d.select)) { selected = d.select; activeSection = sectionOf(pins.find(p=>p.id===selected)); render(); if (innerWidth <= 800) { const thread = $('thread-' + selected); thread?.scrollIntoView({ block: 'start' }); thread?.querySelector('button')?.focus({ preventScroll: true }); } }
    if (typeof d.navigate === 'string' && config.pages.some(p => p.path === d.navigate)) { navigate(d.navigate); }
  });
  $('new-comment').onsubmit = async e => {
    e.preventDefault(); if (!pending) return;
    $('save-comment').disabled = true;
    try { const created = await api('/pin', { ...pending, page, device, body: $('new-body').value }); selected = created.id; activeSection = sectionOf(created); $('new-body').value = ''; pending = null; $('new-comment').hidden = true; await refresh(); error('Comment added.'); }
    catch (e) { error(e.message); } finally { $('save-comment').disabled = false; }
  };
  const cancel = () => { pending = null; $('new-comment').hidden = true; $('new-body').value = ''; render(); };
  $('cancel-comment').onclick = cancel;
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && pending) cancel(); });
  document.querySelectorAll('[data-device]').forEach(b => b.onclick = () => { device = b.dataset.device; pending = null; selected = null; $('new-body').value = ''; $('new-comment').hidden = true; document.querySelectorAll('[data-device]').forEach(v => v.setAttribute('aria-pressed', String(v === b))); fit(); render(); });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; $('target-mode').disabled = mode === 'browse'; $('mode-hint').textContent = mode === 'browse' ? 'Browse the site · links and navigation are active' : 'Select an ' + targetMode + ' to leave feedback'; document.querySelectorAll('[data-mode]').forEach(v => v.setAttribute('aria-pressed', String(v === b))); render(); });
  $('page-select').onchange = () => navigate($('page-select').value);
  $('close-inspector').onclick = () => { selected = null; if(pending) { pending = null; $('new-comment').hidden = true; $('new-body').value = ''; } render(); };
  $('status-filter').onchange = render;
  document.querySelectorAll('[data-status]').forEach(b => b.onclick = () => { $('status-filter').value = b.dataset.status; render(); });
  $('target-mode').onchange = () => { targetMode = $('target-mode').value; $('mode-hint').textContent = 'Select ' + (targetMode === 'section' ? 'a section' : 'an element') + ' to leave feedback'; render(); };
  $('update-site').onclick = load;
  document.querySelectorAll('[data-copy-link]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(new URL(b.dataset.copyLink, location.origin).href); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 2000); error('Review link copied.'); } catch { error('Copy the review link from the address bar.'); } });
  refresh().then(load).catch(e => error(e.message));
  setInterval(() => { if (!document.hidden) refresh(true).catch(e => error(e.message)); }, 15000);
}

/** Runs inside an opaque iframe. Only placement and navigation events cross the boundary. */
export function reviewBridge(channel) {
  let mode = 'comment', targetMode = 'element', pins = [], selected = null, pending = null, hovered = null;
  // Preview-only anchors for inner elements without a builder ID. The structural path
  // is deterministic across renders; existing builder IDs remain the preferred anchor.
  document.querySelectorAll('body *').forEach(el => {
    if (el.id || ['SCRIPT','STYLE','LINK'].includes(el.tagName)) return;
    let cursor = el, path = '';
    while (cursor && cursor !== document.body) {
      if (cursor.id && !cursor.id.startsWith('pc-review-anchor-')) { path = '#' + cursor.id + '/' + path; break; }
      const siblings = Array.from(cursor.parentElement?.children || []);
      path = cursor.tagName + ':' + siblings.indexOf(cursor) + '/' + path; cursor = cursor.parentElement;
    }
    let hash = 2166136261; for (const char of path) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const id = 'pc-review-anchor-' + (hash >>> 0).toString(36);
    if (!document.getElementById(id)) el.id = id;
  });
  const layer = document.createElement('div'); layer.id = 'pc-review-pins';
  Object.assign(layer.style, { position:'absolute', top:'0', left:'0', width:'0', height:'0', zIndex:'2147483647' });
  const outline = document.createElement('div'); outline.id = 'pc-review-outline'; outline.hidden = true;
  Object.assign(outline.style, { position:'fixed', pointerEvents:'none', border:'2px solid var(--review-selection-text)', background:'transparent', boxSizing:'border-box', zIndex:'2147483646' });
  const label = document.createElement('span');
  Object.assign(label.style, { position:'absolute', top:'0', left:'0', transform:'translateY(-100%)', background:'var(--review-ink)', color:'var(--review-craft-green)', padding:'4px 8px', font:'600 11px/16px sans-serif', borderRadius:'0 0 4px 0', whiteSpace:'nowrap' });
  outline.append(label); document.body.append(outline, layer);
  const send = data => parent.postMessage({ reviewChannel: channel, ...data }, '*');
  const target = id => id ? document.getElementById(id) : null;
  const describe = el => ({H1:'Heading',H2:'Heading',H3:'Heading',P:'Text',A:'Link',IMG:'Image',BUTTON:'Button',SECTION:'Section',HEADER:'Header',FOOTER:'Footer',NAV:'Navigation',MAIN:'Page'}[el?.tagName] || (targetMode === 'section' ? 'Section' : 'Element'));
  const pick = el => targetMode === 'section' ? el.closest('section,header,footer,main,article') || el.closest('[id]') : el.closest('a,button,img,input,textarea,select,video,svg,h1,h2,h3,h4,p,li,[id]');
  const highlight = () => {
    const active = pending ? target(pending.nodeId) : hovered || target(pins.find(p => p.id === selected)?.nodeId);
    if (!active || mode !== 'comment' && !selected && !pending) { outline.hidden = true; return; }
    const r = active.getBoundingClientRect(); outline.hidden = false;
    Object.assign(outline.style, {left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    label.style.transform = r.top < 25 ? 'none' : 'translateY(-100%)';
    label.textContent = describe(active) + (pending ? ' · New comment' : selected && !hovered ? ' · Selected comment' : ' · Click to comment');
  };
  const outlineData = () => {
    const sections = Array.from(document.querySelectorAll('section,header,footer,main>article')).filter(el=>!layer.contains(el)&&!outline.contains(el));
    const sectionLabel = el => el.tagName==='HEADER'?'Header':el.tagName==='FOOTER'?'Footer':el.querySelector('h1,h2,h3')?.textContent?.trim().slice(0,80)||el.getAttribute('aria-label')||'Section '+(sections.indexOf(el)+1);
    const outlineRows = sections.map(el=>({id:el.id,label:sectionLabel(el)}));
    const anchorRows = Array.from(document.querySelectorAll('body [id]')).filter(el=>!layer.contains(el)&&el!==layer&&el!==outline&&!outline.contains(el)).map(el=>{
      const section = el.closest('section,header,footer,main>article');
      const label = describe(el); const text = /^(H[1-6]|A|BUTTON)$/.test(el.tagName) ? el.textContent?.trim().slice(0,60) : '';
      return {id:el.id,sectionId:section?.id||'unplaced',label:label+(text?' · '+text:'')};
    });
    send({outline:outlineRows,anchors:anchorRows});
  };
  const draw = () => {
    layer.replaceChildren();
    [...pins, ...(pending ? [{...pending,id:'pending',number:'+',done:false}] : [])].forEach(p => {
      const el = target(p.nodeId), r = el?.getBoundingClientRect();
      const x = r ? r.left + scrollX + r.width * p.nodeX : p.x * innerWidth;
      const y = r ? r.top + scrollY + r.height * p.nodeY : p.y;
      const b = document.createElement('button'); b.textContent = p.number; b.type = 'button'; b.setAttribute('aria-label', p.id === 'pending' ? 'New comment location' : 'Open comment ' + p.number);
      Object.assign(b.style, { position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,-50%)',width:'30px',height:'30px',borderRadius:'50% 50% 50% 4px',border:'2px solid var(--review-on-ink)',boxShadow:'0 2px 6px #0003',background:p.done?'var(--review-selection-muted)':p.id===selected||p.id==='pending'?'var(--review-craft-green)':'var(--review-ink)',color:p.done?'var(--review-on-ink)':p.id===selected||p.id==='pending'?'var(--review-ink)':'var(--review-craft-green)',cursor:'pointer',font:'bold 12px sans-serif',padding:'0' });
      b.onclick = e => { e.stopPropagation(); if(p.id !== 'pending') send({select:p.id}); }; layer.append(b);
    }); highlight();
  };
  addEventListener('message', e => {
    if (e.source !== parent || e.data?.reviewChannel !== channel) return;
    const d = e.data;
    if (d.theme) for (const key of ['ink','craft-green','on-ink','selection-text','selection-muted','selection-bg']) { const value = d.theme[key]; if (typeof value === 'string' && CSS.supports('color',value)) { layer.style.setProperty('--review-' + key,value); outline.style.setProperty('--review-' + key,value); } }
    if (d.requestOutline) outlineData();
    if (d.focusNode) { const el=target(d.focusNode);if(el){el.scrollIntoView({block:'start'});hovered=el;} }
    if (d.mode) mode = d.mode; if (d.targetMode) targetMode = d.targetMode;
    if ('selected' in d) selected = d.selected; if ('pending' in d) pending = d.pending;
    if (d.pins) pins = d.pins;
    if (!d.focusNode) hovered = null;
    if (d.focus) { selected = d.focus; const p = pins.find(p => p.id === d.focus); if(p) { const el = target(p.nodeId); if(el) el.scrollIntoView({block:'center'}); else scrollTo(0,Math.max(0,p.y-innerHeight/2)); } }
    document.documentElement.style.cursor = mode === 'comment' ? 'crosshair' : ''; draw();
  });
  document.addEventListener('pointermove', e => { if(mode !== 'comment' || pending || layer.contains(e.target)) return; hovered = pick(e.target); highlight(); });
  document.addEventListener('pointerleave', () => { hovered = null; highlight(); });
  document.addEventListener('click', e => {
    if (layer.contains(e.target)) return;
    if (mode === 'comment') {
      e.preventDefault(); e.stopImmediatePropagation(); if(pending) return;
      const el = pick(e.target), r = el?.getBoundingClientRect();
      const clientX = e.detail === 0 && r ? r.left + r.width/2 : e.clientX;
      const clientY = e.detail === 0 && r ? r.top + r.height/2 : e.clientY;
      pending = { x:Math.max(0,Math.min(1,(clientX+scrollX)/innerWidth)),y:Math.max(0,clientY+scrollY),nodeId:el?.id||'',nodeX:r?.width?Math.max(0,Math.min(1,(clientX-r.left)/r.width)):0,nodeY:r?.height?Math.max(0,Math.min(1,(clientY-r.top)/r.height)):0 };
      draw(); send({pin:pending,label:describe(el)});
    } else {
      const a = e.target.closest('a'); if(a) { const href = a.getAttribute('href') || ''; if(href.startsWith('#')) return; e.preventDefault(); const url = new URL(href,'https://review.invalid/'+document.documentElement.dataset.reviewPage); if(url.origin !== 'https://review.invalid') return; const path = url.pathname.slice(1); send({navigate:path.endsWith('/')?path+'index.html':path||'index.html'}); }
    }
  },true);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') { pending = null; hovered = null; draw(); send({cancel:true}); } });
  document.addEventListener('submit', e => e.preventDefault(),true);
  addEventListener('scroll',draw,true); addEventListener('resize',draw); new ResizeObserver(draw).observe(document.body);
}
