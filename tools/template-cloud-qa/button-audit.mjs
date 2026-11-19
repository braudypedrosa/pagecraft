/* For every published button: the background/border its own rule declares vs what renders. */
import { openBrowser, sleep, ORIGIN } from './editor-driver.mjs';
const sites = JSON.parse(process.argv[2]);
const b = await openBrowser({ width: 1440, height: 900 });
const out = [];
for (const [slug, pages] of Object.entries(sites)) for (const page of pages) {
  await b.goto(`${ORIGIN}/${slug}/${page === 'index' ? '' : page}`); await sleep(400);
  const r = await b.eval(() => {
    const decl = cls => { const found = {}; const visit = rs => { for (const r of rs) { if (r.cssRules && !r.selectorText) { if (!r.conditionText) visit(r.cssRules); } else if (r.selectorText === '.' + cls) for (const p of ['background-color', 'border-top-width', 'border-top-color', 'color']) { const v = r.style.getPropertyValue(p); if (v) found[p] = v; } } }; for (const s of document.styleSheets) { try { visit(s.cssRules); } catch {} } return found; };
    return [...document.querySelectorAll('.pagecraft-button')].filter(a => a.offsetParent).map(a => {
      const cls = [...a.classList].find(c => /^pagecraft-(?!button)/.test(c) && !/^pagecraft-button$/.test(c));
      const want = decl(cls), s = getComputedStyle(a);
      const probe = document.createElement('span'); probe.style.color = want['background-color'] || ''; a.parentElement.appendChild(probe); const wantBg = want['background-color'] ? getComputedStyle(probe).color : null; probe.remove();
      return { text: a.textContent.trim().slice(0, 28), variant: a.dataset.variant, cls, wantBg, bg: s.backgroundColor, border: s.borderTopWidth, color: s.color, lost: !!wantBg && wantBg !== s.backgroundColor };
    }).filter(x => x.lost);
  });
  for (const x of r) out.push({ slug, page, ...x });
}
console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
await b.close();
