/* Create a site from a template through the dashboard's Add new site flow, as the template's fixture account. */
import { openBrowser, as, sleep, ORIGIN } from './editor-driver.mjs';
const [tpl, card, name] = process.argv.slice(2);
await as(tpl);
const b = await openBrowser();
try {
  await b.goto(ORIGIN + '/'); await sleep(800);
  await b.button('Add new site'); await sleep(600);
  await b.text('Premade templates'); await sleep(900);
  await b.text(card); await sleep(400);
  await b.button('Continue', { exact: true }); await sleep(600);
  await b.field('My new site', name, { commit: false });
  await b.button('Create site', { exact: true });
  for (let i = 0; i < 60; i++) { await sleep(250); if ((await b.eval(() => location.pathname)).startsWith('/edit/')) break; }
  await sleep(1500);
  console.log(JSON.stringify({ url: await b.eval(() => location.pathname + location.search), canvas: await b.canvasEval(d => d.querySelectorAll('[data-id]').length).catch(() => 0) }));
} finally { await b.close(); }
