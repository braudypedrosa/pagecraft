/* Publish a site's saved draft through the editor's Publish flow (local in-memory QA host). */
import { openBrowser, as, api, sleep } from './editor-driver.mjs';
const [tpl, site] = process.argv.slice(2);
await as(tpl);
const b = await openBrowser();
try {
  await b.editor(site);
  const checks = await b.eval(() => document.querySelector('[aria-label^="Site checks"]')?.getAttribute('aria-label'));
  await b.button('Publish this draft'); await sleep(900);
  if (await b.has('Create publication preview')) { await b.button('Create publication preview'); await sleep(3500); }
  await b.button('Publish reviewed version'); await sleep(1500);
  let confirm = null;
  if (await b.has('Publish this release')) { confirm = await b.eval(() => [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 160)).pop()); await b.button('Publish this release'); await sleep(2000); }
  const s = (await api('/api/sites')).find(x => x.id === site);
  console.log(JSON.stringify({ site, slug: s.slug, publishState: s.publishState, publishedVersion: s.publishedVersion, publication: s.publishedPublicationId, checks, confirm }));
} finally { await b.close(); }
