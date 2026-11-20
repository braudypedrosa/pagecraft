/* The 13 Cloud editing exercises for one template site, through the real editor with trusted input.
   node edit-exercises.mjs <templateId> <siteId> <outJson> [only,checks]
   Every exercise records what was done and what was observed (canvas DOM, saved document, published
   output). A failed observation is recorded as a failure, never skipped. */
import { writeFile } from 'node:fs/promises';
import { openBrowser, as, api, sleep, ORIGIN } from './editor-driver.mjs';

const [tpl, site, out, only] = process.argv.slice(2);
const want = only ? new Set(only.split(',')) : null;
const log = { template: tpl, site, startedAt: new Date().toISOString(), exercises: [] };
const record = (check, pass, did, observed) => { log.exercises.push({ check, pass, did, observed }); console.log(pass ? 'PASS' : 'FAIL', check, JSON.stringify(observed).slice(0, 300)); };
const doc = async () => (await api(`/api/sites/${site}`)).doc;
const walk = (nodes, f) => { for (const n of nodes || []) { f(n); walk(n.children, f); } };
const allNodes = d => { const a = []; for (const r of [d.header, d.footer, ...d.pages.map(p => p.tree)]) walk(r, n => a.push(n)); return a; };

await as(tpl);
const b = await openBrowser();
const run = async (check, fn) => {
  if (want && !want.has(check)) return;
  // Each exercise starts from a freshly opened editor on the saved draft.
  try {
    if (!['save-reopen', 'publish-output', 'form-behavior'].includes(check)) {
      await b.editor(site);
      // The editor reopens on the last page shown; the exercises start on the home page.
      if (log.targets && !(await b.canvasEval((d, id) => !!d.querySelector(`[data-id="${id}"]`), log.targets.h1))) {
        const home = (await doc()).pages[0].name; await b.choose('Current page', o => o.startsWith(home)); await sleep(1200);
      }
    }
    await fn();
  } catch (error) { record(check, false, 'exercise threw', { error: error.message }); try { await b.key('Escape'); await b.editor(site); } catch {} }
};
const openSettings = async section => { await b.button('Design settings'); await sleep(400); await b.button(section, { exact: true }); await sleep(400); };
const closeSettings = async () => { await b.button('Close', { exact: true }).catch(() => b.key('Escape')); await sleep(500); };
const pick = async (comboLabel, avoid) => {
  await b.button(comboLabel); await sleep(300);
  const options = await b.eval(() => [...document.querySelectorAll('[role=option]')].filter(e => e.offsetParent).map(e => e.textContent.trim()));
  const choice = options.find(o => o && o !== avoid && !/^Default|^—/.test(o));
  await b.button(choice, { within: '[role=listbox]', exact: true }); await sleep(400);
  return { options: options.slice(0, 8), choice };
};

try {
  await b.editor(site);
  {
    const home = (await doc()).pages[0];
    const onHome = await b.eval(name => [...document.querySelectorAll('[role=combobox]')].some(e => e.getAttribute('aria-label') === 'Current page' && e.textContent.trim().startsWith(name)), home.name);
    if (!onHome) { await b.choose('Current page', o => o.startsWith(home.name)); await sleep(1200); }
  }
  const firstPage = await b.canvasEval(d => ({
    h1: d.querySelector('h1[data-id]')?.dataset.id,
    // An ordinary image whose centre is not covered by other content, so a click selects it.
    image: [...d.querySelectorAll('img[data-id]')].find(i => { if (i.closest('[data-id*=instance],[class*=instance]')) return false; i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return d.elementFromPoint(r.x + Math.min(r.width / 2, 40), r.y + Math.min(r.height / 2, 20)) === i; })?.dataset.id,
    instance: d.querySelector('[data-id*=instance]')?.dataset.id,
    button: d.querySelector('[data-t=button][data-id]')?.dataset.id,
    sections: [...d.querySelectorAll('section[data-id]')].map(s => s.dataset.id),
    title: [...d.querySelectorAll('[data-id].ts-title')].map(e => e.dataset.id),
  }));
  log.targets = firstPage;

  await run('global-colors', async () => {
    await openSettings('Colours');
    const tokens = await b.eval(() => [...document.querySelectorAll('input')].filter(i => i.offsetParent && i.type === 'text' && /colour value$/.test(i.getAttribute('aria-label') || '')).map(i => [i.getAttribute('aria-label'), i.value]));
    const rgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
    const usage = async hex => b.canvasEval((d, c) => [...d.querySelectorAll('[data-id]')].filter(e => { const s = getComputedStyle(e); return [s.color, s.backgroundColor, s.borderTopColor].includes(c) && (s.color === c || s.backgroundColor === c); }).length, rgb(hex));
    // The token most used on this page, so the change is visible.
    let best = null;
    // Only a token whose value no other token shares, so every element counted follows this token.
    for (const [label, value] of tokens) { if (tokens.filter(([, v]) => v.toLowerCase() === value.toLowerCase()).length > 1) continue; const n = await usage(value); if (!best || n > best.n) best = { label, value, n }; }
    await b.field(best.label, '#1f5f8b');
    await closeSettings();
    const usedAfter = await usage('#1f5f8b');
    await b.saved();
    const saved = JSON.stringify((await doc()).meta.tokens).includes('#1f5f8b');
    record('global-colors', best.n > 0 && usedAfter >= best.n && saved, `Settings › Colours: ${best.label.replace(/ colour value$/, '')} ${best.value} → #1f5f8b`, { elementsUsingToken: best.n, elementsRepaintedOnCanvas: usedAfter, savedInTokens: saved });
  });

  await run('global-typography', async () => {
    const fonts = () => b.canvasEval(d => ({ heading: getComputedStyle(d.querySelector('h1')).fontFamily.split(',')[0], h2: getComputedStyle(d.querySelector('h2') || d.querySelector('h1')).fontFamily.split(',')[0], body: getComputedStyle(d.querySelector('p') || d.body).fontFamily.split(',')[0] }));
    const before = await fonts();
    // Matched by position in the page (some rendered elements carry no id of their own).
    const titleBefore = await b.canvasEval(d => [...d.querySelectorAll('.ts-title')].map((e, i) => [e.dataset.id || `#${i}`, parseFloat(getComputedStyle(e).fontSize), i]));
    await openSettings('Typography');
    const head = await b.choose('Heading font', (o, cur) => o !== cur && !/Default|Inherit|System/.test(o));
    const body = await b.choose('Body font', (o, cur) => o !== cur && o !== head.to && !/Default|Inherit|System/.test(o));
    const sizeLabel = await b.eval(() => [...document.querySelectorAll('input')].find(i => i.offsetParent && /^Section title size$/.test(i.getAttribute('aria-label') || ''))?.getAttribute('aria-label') || [...document.querySelectorAll('input')].find(i => i.offsetParent && / size$/.test(i.getAttribute('aria-label') || '') && i.getAttribute('aria-label') !== 'Display size')?.getAttribute('aria-label'));
    const sizeBefore = await b.eval(l => document.querySelector(`input[aria-label="${l}"]`).value, sizeLabel);
    const target = parseFloat(sizeBefore) === 47 ? 45 : 47;
    await b.field(sizeLabel, `${target}px`);
    await closeSettings();
    await sleep(800);
    const after = await fonts();
    const titleAfter = await b.canvasEval(d => [...d.querySelectorAll('.ts-title')].map(e => parseFloat(getComputedStyle(e).fontSize)));
    // Elements that followed the style move to the new size; elements with a size of their own keep it.
    const followed = titleBefore.filter(([, v]) => v === parseFloat(sizeBefore)), own = titleBefore.filter(([, v]) => v !== parseFloat(sizeBefore));
    const titleSize = { followed: followed.map(([, , i]) => titleAfter[i]), ownSizeKept: own.map(([id, v, i]) => [id, v, titleAfter[i]]) };
    await b.saved();
    const m = (await doc()).meta;
    const headingFollows = after.heading.includes(head.to) && after.h2.includes(head.to);
    const bodyFollows = after.body.includes(body.to);
    record('global-typography', headingFollows && bodyFollows && followed.length > 0 && titleSize.followed.every(x => x === target) && titleSize.ownSizeKept.every(([, a, z]) => a === z), `Settings › Typography: Heading font ${head.from} → ${head.to}; Body font ${body.from} → ${body.to}; "${sizeLabel.replace(/ size$/, '')}" ${sizeBefore} → ${target}px`,
      { before, after, headingFollowsHeadingFont: headingFollows, bodyFollowsBodyFont: bodyFollows, sectionTitleSizes: titleSize, saved: { headFont: m.headFont.split(',')[0], font: m.font.split(',')[0] } });
  });

  /* Pick a library image different from the current one; returns the file name picked. */
  const pickDifferent = async (currentSrc, nth = 0) => {
    await b.button('Pick from the Media library'); await sleep(800);
    const names = await b.eval(() => [...document.querySelectorAll('[role=dialog] button[title]')].filter(e => e.offsetParent && /\.(webp|jpe?g|png|avif|svg)$/i.test(e.title)).map(e => e.title));
    // The dialog marks the image already in use; skip it by asset path in the thumbnail.
    const current = currentSrc.split('/').pop();
    const choices = await b.eval(cur => [...document.querySelectorAll('[role=dialog] button[title]')].filter(e => e.offsetParent && /\.(webp|jpe?g|png|avif|svg)$/i.test(e.title)).filter(e => !(e.querySelector('img')?.src || '').includes(cur)).map(e => e.title), current);
    const choice = choices[nth % choices.length] || names[0];
    await b.button(choice, { within: '[role=dialog]', exact: true }); await sleep(500);
    if (await b.has('Done', '[role=dialog]')) await b.button('Done', { within: '[role=dialog]', exact: true });
    await sleep(900);
    return choice;
  };

  await run('replace-images', async () => {
    const before = await b.canvasEval((d, id) => d.querySelector(`[data-id="${id}"]`).currentSrc, firstPage.image);
    await b.select(firstPage.image); await b.button('Content', { exact: true }).catch(() => {});
    const choice = await pickDifferent(before);
    const after = await b.canvasEval((d, id) => { const i = d.querySelector(`[data-id="${id}"]`); return { src: i.currentSrc, w: i.naturalWidth, attrs: [i.getAttribute('width'), i.getAttribute('height')] }; }, firstPage.image);
    // The patch: an instance's image property records the chosen photo's size.
    let instance = null;
    if (firstPage.instance) {
      await b.select(firstPage.instance); await b.button('Content', { exact: true }).catch(() => {});
      const instBefore = await b.canvasEval((d, id) => d.querySelector(`[data-id="${id}"] img`)?.currentSrc || '', firstPage.instance);
      const instChoice = await pickDifferent(instBefore, 1);
      await b.saved();
      const d = await doc();
      let node; for (const r of [d.header, d.footer, ...d.pages.map(p => p.tree)]) walk(r, n => { if (n.id === firstPage.instance) node = n; });
      const sizes = Object.entries(node?.vals || {}).filter(([k]) => k.startsWith('@image-size:'));
      const imgVal = Object.entries(node?.vals || {}).filter(([k, v]) => !k.startsWith('@') && /^asset:/.test(String(v)));
      const rendered = await b.canvasEval((d, id) => { const i = d.querySelector(`[data-id="${id}"] img`); return i && { src: i.currentSrc.split('/').pop(), loaded: i.naturalWidth > 0, natural: [i.naturalWidth, i.naturalHeight], attrs: [i.getAttribute('width'), i.getAttribute('height')] }; }, firstPage.instance);
      instance = { before: instBefore.split('/').pop(), picked: instChoice, imageValues: imgVal, recordedSizes: sizes, rendered };
    }
    await b.saved();
    const sizeMatches = !instance || instance.recordedSizes.some(([, v]) => { const x = JSON.parse(v); return instance.imageValues.some(([, a]) => a === x.src) && x.w === instance.rendered?.natural[0] && x.h === instance.rendered?.natural[1]; });
    const instanceOk = !instance || (instance.rendered?.loaded && instance.rendered.src !== instance.before && sizeMatches);
    record('replace-images', after.src !== before && after.w > 0 && instanceOk, `Replaced ${firstPage.image} with ${choice} from the Media library; replaced the photo of component instance ${firstPage.instance || '(none on home)'}`, { before: before.split('/').pop(), after, instance, recordedSizeMatchesNewPhoto: sizeMatches });
  });

  await run('long-headings', async () => {
    await b.key('Escape');
    await b.canvas(firstPage.h1); await b.button('Content', { exact: true }).catch(() => {});
    const text = await b.eval(() => [...document.querySelectorAll('textarea')].find(t => t.offsetParent)?.value);
    const long = `${text} ${text} — a much longer opening headline written to test wrapping across every width`;
    const box = await b.eval(() => { const t = [...document.querySelectorAll('textarea')].find(t => t.offsetParent); const r = t.getBoundingClientRect(); return { x: r.x + 20, y: r.y + 10 }; });
    await b.click(box.x, box.y); await b.selectAll(); await b.send('Input.insertText', { text: long }); await b.key('Tab'); await sleep(600);
    const widths = {};
    for (const mode of ['Mobile', 'Tablet', 'Desktop']) {
      await b.button(mode, { exact: true }); await sleep(700);
      widths[mode] = await b.canvasEval((d, id) => { const h = d.querySelector(`[data-id="${id}"]`); return { text: h.textContent.length, overflow: h.scrollWidth > h.clientWidth + 2, docOverflow: d.documentElement.scrollWidth > d.documentElement.clientWidth + 1, lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight || 1)) }; }, firstPage.h1);
    }
    await b.saved();
    const ok = Object.values(widths).every(w => !w.overflow && !w.docOverflow && w.text >= long.length - 2);
    record('long-headings', ok, `H1 lengthened to ${long.length} characters, checked in Mobile, Tablet and Desktop canvas modes`, widths);
  });

  await run('duplicate-reorder-delete', async () => {
    const sec = firstPage.sections[2] || firstPage.sections[1];
    const order = () => b.canvasEval(d => [...d.querySelectorAll('section[data-id]')].map(s => s.dataset.id));
    const start = await order();
    await b.select(sec);
    const selectedBeforeDelete = [];
    await b.key('d', 4); await sleep(700);
    const afterDup = await order();
    await b.key('ArrowUp', 8); await sleep(700);
    const afterMove = await order();
    selectedBeforeDelete.push(await b.selected());
    await b.key('Backspace'); await sleep(700);
    const afterDelete = await order();
    await b.saved();
    const saved = (await doc()).pages[0].tree.filter(n => n.type === 'section').length;
    record('duplicate-reorder-delete', afterDup.length === start.length + 1 && afterMove.join() !== afterDup.join() && afterDelete.length === start.length, `Selected section ${sec}; ⌘D duplicate, ⇧↑ move up, ⌫ delete the copy`, { selected: selectedBeforeDelete, start: start.length, afterDuplicate: afterDup.length, movedOrderChanged: afterMove.join() !== afterDup.join(), afterDelete: afterDelete.length, restoredOrder: afterDelete.join() === start.join(), savedSections: saved });
  });

  await run('shared-and-instance-styles', async () => {
    const size = id => b.canvasEval((d, id) => parseFloat(getComputedStyle(d.querySelector(`[data-id="${id}"]`)).fontSize), id);
    // Two section titles that both follow the text style (no size of their own).
    const sizes = []; for (const id of firstPage.title) sizes.push([id, await size(id)]);
    const common = Object.entries(sizes.reduce((m, [, v]) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})).sort((x, y) => y[1] - x[1])[0][0];
    const [a, c] = sizes.filter(([, v]) => String(v) === common).map(([id]) => id);
    const before = [await size(a), await size(c)];
    await b.key('Escape'); await b.canvas(a); await b.button('Style', { exact: true }); await sleep(300);
    await b.field('Size value', '31');
    const instanceOnly = [await size(a), await size(c)];
    // Shared: the "Update style to match" action pushes this element's look to every use of the style.
    await b.button('Content', { exact: true });
    const shared = await b.has('Update style to match');
    let confirm = null;
    if (shared) {
      await b.button('Update style to match'); await sleep(700);
      confirm = await b.eval(() => [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(e => e.offsetParent).map(e => e.innerText.split('\n')[0])[0] || null);
      if (confirm) await b.button('Update typography', { within: '[role=dialog],[role=alertdialog]', exact: true });
      await sleep(900);
    }
    const afterShared = [await size(a), await size(c)];
    await b.saved();
    record('shared-and-instance-styles', instanceOnly[0] === 31 && instanceOnly[1] === before[1] && shared && afterShared[1] === 31, `Section title ${a}: instance size 31px (This element), then "Update typography" to share it with ${c}`, { before, instanceOnly, afterShared, confirm });
  });

  await run('responsive-inspector', async () => {
    await b.key('Escape');
    await b.button('Mobile', { exact: true }); await sleep(700);
    await b.canvas(firstPage.h1); await b.button('Style', { exact: true }); await sleep(300);
    await b.field('Size value', '29');
    const mobile = await b.canvasEval((d, id) => parseFloat(getComputedStyle(d.querySelector(`[data-id="${id}"]`)).fontSize), firstPage.h1);
    await b.button('Desktop', { exact: true }); await sleep(800);
    const desktop = await b.canvasEval((d, id) => parseFloat(getComputedStyle(d.querySelector(`[data-id="${id}"]`)).fontSize), firstPage.h1);
    await b.saved();
    const node = (await doc()).pages[0].tree; let h; walk(node, n => { if (n.id === firstPage.h1) h = n; });
    record('responsive-inspector', mobile === 29 && desktop !== 29 && h?.css?.m?.['font-size'] === '29px', 'Mobile mode: H1 size 29px; back to Desktop', { mobileCanvas: mobile, desktopCanvas: desktop, savedMobileOverride: h?.css?.m?.['font-size'], savedDesktop: h?.css?.d?.['font-size'] ?? null });
  });

  await run('save-reopen', async () => {
    await b.saved();
    const v1 = await api(`/api/sites/${site}`);
    await b.editor(site);
    const reopened = await b.canvasEval((d, id) => ({ h1: d.querySelector(`[data-id="${id}"]`)?.textContent.length, blue: [...d.querySelectorAll('[data-id]')].some(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor].includes('rgb(31, 95, 139)')) }), firstPage.h1);
    const status = await b.status();
    record('save-reopen', reopened.h1 > 60 && reopened.blue && /Draft/.test(status), `Reloaded the editor after autosave (saved version ${v1.version})`, { savedVersion: v1.version, reopened, status });
  });

  await run('media-and-links', async () => {
    await b.canvas(firstPage.button); await b.button('Content', { exact: true }).catch(() => {});
    const before = await b.canvasEval((d, id) => d.querySelector(`[data-id="${id}"]`).getAttribute('href'), firstPage.button);
    const type = (await b.inspector()).find(l => l.startsWith('button|Link type|'));
    if (!/A page in this project/.test(type || '')) await b.choose('Link type', 'A page in this project');
    const chosen = await b.choose('Link page', (o, cur) => o !== cur && / \/[a-z]/.test(o));
    await sleep(600);
    const after = await b.canvasEval((d, id) => d.querySelector(`[data-id="${id}"]`).getAttribute('href'), firstPage.button);
    await b.saved();
    // Media library: list, usage counts and upload control present.
    await b.button('Media library'); await sleep(900);
    const lib = await b.eval(() => { const t = document.body.innerText; return { count: (t.match(/(\d+) of (\d+) (images|files|items|assets)/) || [])[0] || null, usage: /used \d+×/.test(t), upload: [...document.querySelectorAll('button')].some(e => e.offsetParent && /Upload/.test(e.textContent)) }; });
    await b.key('Escape');
    record('media-and-links', after !== before && !!chosen.to && lib.upload, `Button ${firstPage.button}: link page ${chosen.from} → ${chosen.to}; opened the Media library`, { hrefBefore: before, hrefAfter: after, library: lib });
  });

  await run('global-navigation-footer', async () => {
    await b.key('Escape');
    await b.canvas('.s-region[data-kind=header] button'); await sleep(800);
    const navId = await b.canvasEval(d => d.querySelector('.s-region[data-kind=header] nav[data-id], .s-region[data-kind=header] [data-t=nav][data-id]')?.dataset.id);
    await b.canvas(navId || '.s-region[data-kind=header] nav'); await sleep(500);
    // The first menu item's label (expanded by the inspector when the menu is selected).
    if (!(await b.eval(() => [...document.querySelectorAll('input')].some(i => i.offsetParent && /^Navigation label for /.test(i.getAttribute('aria-label') || ''))))) await b.button('Edit ').catch(() => {});
    const label = await b.eval(() => { const i = [...document.querySelectorAll('input')].find(i => i.offsetParent && /^Navigation label for /.test(i.getAttribute('aria-label') || '')); return [i.getAttribute('aria-label'), i.value]; });
    const box = await b.eval(l => { const i = document.querySelector(`input[aria-label="${l}"]`); i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; }, label[0]);
    await b.click(box.x, box.y); await b.selectAll(); await b.send('Input.insertText', { text: label[1] + ' & more' }); await b.key('Tab'); await sleep(500);
    await b.button('Done', { exact: true });
    await sleep(500);
    await b.saved();
    const d = await doc();
    const inHeader = JSON.stringify(d.header).includes(label[1] + ' & more');
    // Every page shows the shared header: check two pages in the canvas.
    const pages = [];
    for (const p of d.pages.slice(0, 3)) {
      await b.choose('Current page', o => o.startsWith(p.name)).catch(() => {}); await sleep(1000);
      pages.push({ page: p.slug, shows: await b.canvasEval((d, t) => d.querySelector('.s-region[data-kind=header]')?.textContent.includes(t), label[1] + ' & more') });
    }
    record('global-navigation-footer', inHeader && pages.every(p => p.shows), `Edit header: menu item "${label[1]}" → "${label[1]} & more"; checked on ${pages.length} pages`, { savedInSharedHeader: inHeader, pages, footerRegion: d.footer?.length > 0 });
  });

  await run('stress-content', async () => {
    const findParent = (nodes, id, up = null) => { for (const n of nodes || []) { if (n.id === id) return up; const f = findParent(n.children, id, n); if (f) return f; } return null; };
    const home0 = (await doc()).pages[0];
    const hasImage = n => { let y = false; walk([n], x => { if (x.type === 'image') y = true; }); return y; };
    // The repeated cards: instances of one component, or (in a template without components) a row of
    // three or more boxes that each carry a photo. Other children of the row are left alone.
    let parent, component = null, inst = firstPage.instance;
    if (inst) { parent = findParent(home0.tree, inst).id; walk(home0.tree, n => { if (n.id === inst) component = n.use; }); }
    else { walk(home0.tree, n => { if (!parent && (n.children || []).filter(c => c.type === 'box' && hasImage(c)).length >= 3) { parent = n.id; inst = n.children.find(c => c.type === 'box' && hasImage(c)).id; } }); }
    if (!parent) return record('stress-content', false, 'no repeated cards on the home page to stress', {});
    const isCard = c => component ? c.use === component : c.type === 'box' && hasImage(c);
    const kids = async () => { await b.saved(); let node; walk((await doc()).pages[0].tree, n => { if (n.id === parent) node = n; }); return (node?.children || []).filter(isCard).map(c => c.id); };
    const geometry = async () => { const ids = await kids(); return b.canvasEval((d, ids) => { const k = ids.map(id => d.querySelector(`[data-id="${id}"]`)).filter(Boolean); return { n: ids.length, rendered: k.length, overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth + 1, minWidth: Math.min(...k.map(x => Math.round(x.getBoundingClientRect().width))), broken: k.flatMap(x => [...x.querySelectorAll('img')]).filter(i => i.complete && !i.naturalWidth).length }; }, ids); };
    const start = (await kids()).length;
    await b.select(inst);
    const seen = {};
    for (let n = start; n < 7; n++) { await b.key('d', 4); await sleep(500); }
    for (let guard = 0; guard < 10 && (await kids()).length > 7; guard++) { const list = await kids(); await b.select(list[list.length - 1]); await b.key('Backspace'); await sleep(600); }
    for (const mode of ['Desktop', 'Tablet', 'Mobile']) { await b.button(mode, { exact: true }); await sleep(800); seen['7-' + mode] = await geometry(); }
    await b.button('Desktop', { exact: true }); await sleep(700);
    seen['3'] = null;
    for (let guard = 0; guard < 10 && (await kids()).length > 1; guard++) {
      const list = await kids();
      await b.select(list[list.length - 1]);
      await b.key('Backspace'); await sleep(600);
      if ((await kids()).length === 3) seen['3'] = await geometry();
    }
    seen['1'] = await geometry();
    const remaining = (await kids())[0];
    await b.select(remaining); await sleep(300);
    const descr = await b.eval(() => [...document.querySelectorAll('input')].filter(i => i.offsetParent && i.getBoundingClientRect().x > innerWidth - 380 && i.value.length > 40 && !/^Fictional/.test(i.value))[0]?.value);
    if (descr) {
      const box = await b.eval(v => { const i = [...document.querySelectorAll('input')].find(i => i.value === v && i.offsetParent); const r = i.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; }, descr);
      await b.click(box.x, box.y); await b.selectAll(); await b.send('Input.insertText', { text: `${descr} ${descr} ${descr}` }); await b.key('Tab'); await sleep(500);
    }
    // A plain card's photo is its own element; a component card removes the photo from its property.
    if (!component) { const img = await b.canvasEval((d, id) => d.querySelector(`[data-id="${id}"] img[data-id]`)?.dataset.id, remaining); if (img) await b.select(img); }
    const hadImage = await b.has('Remove image');
    if (hadImage) { await b.button('Remove image'); await sleep(700); }
    seen.missingImage = await b.canvasEval((d, id) => { const e = d.querySelector(`[data-id="${id}"]`); return { imgs: e.querySelectorAll('img').length, broken: [...e.querySelectorAll('img')].filter(i => i.complete && !i.naturalWidth).length, height: Math.round(e.getBoundingClientRect().height), overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth + 1 }; }, remaining);
    await b.saved();
    const ok = ['7-Desktop', '7-Tablet', '7-Mobile'].every(k => seen[k]?.n === 7 && !seen[k].overflow && !seen[k].broken) && seen['1']?.n === 1 && seen['3']?.n === 3 && hadImage && !seen.missingImage.broken && !seen.missingImage.overflow;
    record('stress-content', ok, `Row ${parent} (${component ? component + ' component cards' : 'photo cards'}): ${start} → 7 (checked in three modes) → 3 → 1; tripled the remaining card's description; removed its optional image`, { start, ...seen, longDescription: !!descr, removedImage: hadImage });
  });

  await run('publish-output', async () => {
    await b.key('Escape');
    await b.button('Publish this draft'); await sleep(900);
    if (await b.has('Create publication preview')) { await b.button('Create publication preview'); await sleep(3000); }
    await b.button('Publish reviewed version'); await sleep(1500);
    if (await b.has('Publish this release')) { await b.button('Publish this release'); await sleep(2000); }
    const s = (await api('/api/sites')).find(x => x.id === site);
    const d = await doc();
    const html = await (await fetch(`${ORIGIN}/${s.slug}/`)).text();
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
    const css = await (await fetch(`${ORIGIN}/${s.slug}/assets/${(html.match(/site\.[a-f0-9]+\.css/) || [])[0]}`)).text();
    record('publish-output', s.publishState === 'published' && h1.length > 60 && /1f5f8b/i.test(css) && html.includes('& more') || html.includes('&amp; more'), `Publish › preview › Publish reviewed version (version ${s.publishedVersion})`, { publishState: s.publishState, publishedVersion: s.publishedVersion, h1Length: h1.replace(/<[^>]+>/g, '').length, colourInCss: /1f5f8b/i.test(css), menuEditInHtml: html.includes('&amp; more') || html.includes('& more') });
    log.publishedSlug = s.slug; log.docVersion = d.version;
  });

  await run('form-behavior', async () => {
    const s = (await api('/api/sites')).find(x => x.id === site);
    const d = await doc();
    const formPage = d.pages.find(p => JSON.stringify(p.tree).includes('"type":"form"') && /contact|plan|stay/i.test(p.slug)) || d.pages.find(p => JSON.stringify(p.tree).includes('"type":"form"'));
    await b.goto(`${ORIGIN}/${s.slug}/${formPage.slug === 'index' ? '' : formPage.slug}`); await sleep(800);
    const form = await b.eval(() => { const f = [...document.forms].find(f => (f.method || '').toLowerCase() === 'post') || document.forms[0]; return f && { action: f.getAttribute('action'), method: f.method, fields: [...f.elements].filter(e => e.name).map(e => ({ name: e.name, type: e.type, required: e.required, label: e.labels?.[0]?.textContent.trim() || e.getAttribute('aria-label') })) }; });
    // Fill each field with test data through real typing, then submit.
    const filled = await b.eval(() => {
      const f = [...document.forms].find(f => (f.method || '').toLowerCase() === 'post') || document.forms[0];
      const boxes = [];
      for (const e of f.elements) {
        if (!e.name || e.name.startsWith('_pc') || e.type === 'hidden' || e.type === 'submit' || e.disabled || !e.offsetParent) continue;
        if (e.tagName === 'SELECT') { e.selectedIndex = Math.max(1, e.selectedIndex); e.dispatchEvent(new Event('change', { bubbles: true })); continue; }
        if (e.type === 'checkbox' || e.type === 'radio') { if (e.required || e.type === 'checkbox') e.checked = true; continue; }
        e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect();
        boxes.push({ name: e.name, type: e.hasAttribute('data-pagecraft-date') || /mm\/dd|dd\/mm|yyyy/i.test(e.placeholder || '') ? 'date' : e.type, x: r.x + 10, y: r.y + r.height / 2 });
      }
      return boxes;
    });
    for (const f of filled) {
      const value = f.type === 'email' ? 'qa-guest@example.invalid' : f.type === 'tel' ? '+1 555 0100' : f.type === 'date' ? null : f.type === 'number' ? '2' : `QA test ${f.name} — local fixture, not a real enquiry`;
      if (f.type === 'date') {
        // Typed the way the enhanced date field shows it (placeholder decides the order).
        const fmt = await b.eval(n => { const e = [...document.querySelectorAll(`[name="${n}"]`)].find(x => x.offsetParent); return { ph: e.placeholder, type: e.type }; }, f.name);
        const day = /depart|end|out/i.test(f.name) ? '17' : '14';
        const text = fmt.type === 'date' || /^yyyy/i.test(fmt.ph) ? `2027-05-${day}` : /^dd/i.test(fmt.ph) ? `${day}/05/2027` : `05/${day}/2027`;
        if (fmt.type === 'date') { await b.eval(([n, v]) => { const e = document.querySelector(`[name="${n}"]`); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [f.name, text]); continue; }
        const box = await b.eval(n => { const e = [...document.querySelectorAll(`[name="${n}"]`)].find(x => x.offsetParent); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; }, f.name);
        await b.click(box.x, box.y, { wait: 150 }); await b.send('Input.insertText', { text }); await b.key('Escape'); await sleep(150);
        continue;
      }
      const box = await b.eval(n => { const e = [...document.querySelectorAll(`[name="${n}"]`)].find(x => x.offsetParent); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + 10, y: r.y + r.height / 2 }; }, f.name);
      await b.click(box.x, box.y, { wait: 100 }); await b.send('Input.insertText', { text: value });
    }
    const submit = await b.eval(() => { const f = [...document.forms].find(f => (f.method || '').toLowerCase() === 'post') || document.forms[0]; const s = f.querySelector('[type=submit],button:not([type])'); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await b.click(submit.x, submit.y, { wait: 2500 });
    const landed = await b.eval(() => ({ url: location.href, h1: document.querySelector('h1')?.textContent.trim(), text: document.body.innerText.slice(0, 200), invalid: [...document.querySelectorAll(':invalid')].filter(e => e.name).map(e => `${e.name}: ${e.validationMessage}`) }));
    const subs = await (await fetch(`${ORIGIN}/sites/${site}/submissions?embedded=1`)).text();
    const stored = subs.includes('qa-guest@example.invalid') || subs.includes('QA test');
    record('form-behavior', !!form && /^https?:|^\//.test(form.action || '') && stored, `Published ${formPage.slug} form filled with test data and submitted`, { form, landed, storedInSubmissions: stored });
  });
} finally {
  log.finishedAt = new Date().toISOString(); log.chrome = b.version;
  log.consoleErrors = b.events.filter(e => (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') || e.method === 'Runtime.exceptionThrown').map(e => e.params.args?.map(a => a.value || a.description).join(' ') || e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text).slice(0, 30);
  await writeFile(out, JSON.stringify(log, null, 1));
  await b.close();
}
