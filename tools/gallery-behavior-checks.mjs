/** The component gallery's behavior checklist (docs/component-gallery.md), driven with real
 * input through a tab from tools/chrome-tab.mjs. Each check reports what it observed, so a
 * failure says why rather than only that it failed. Nothing here writes account or site data:
 * the gallery's own samples are local and inert. */
const sleep = ms => new Promise(done => setTimeout(done, ms));

async function page(tab, base, host, section, { reducedMotion }) {
  const cdp = await tab.capabilities.get('cdp');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await tab.goto(`${base}?host=${host}&section=${section}`);
  return cdp;
}
const js = (tab, fn, arg) => tab.playwright.evaluate(fn, arg);
const click = (tab, role, name) => tab.playwright.getByRole(role, { name, exact: true }).click();

const CHECKS = [
  ['Select Escape preserves Home, closes picker and returns focus', async (tab, base, host) => {
    await page(tab, base, host, 'menus', { reducedMotion: true });
    const before = await js(tab, () => document.getElementById('menu-select').selectedOptions[0].text);
    await click(tab, 'combobox', 'Current page');
    await sleep(200);
    // Opening moves focus into the list, so ask the trigger itself.
    const opened = await js(tab, () => ({ expanded: document.querySelector('.pc-custom-select-trigger[aria-expanded]')?.getAttribute('aria-expanded'),
      popovers: [...document.querySelectorAll('.pc-custom-select-popover')].filter(p => p.getBoundingClientRect().height > 0).length }));
    await tab.pressKey('ArrowDown');
    await tab.pressKey('Escape');
    await sleep(300);
    const after = await js(tab, () => ({ value: document.getElementById('menu-select').selectedOptions[0].text,
      expanded: document.activeElement?.getAttribute('aria-expanded'), role: document.activeElement?.getAttribute('role'),
      popovers: [...document.querySelectorAll('.pc-custom-select-popover')].filter(p => p.getBoundingClientRect().height > 0).length }));
    return { passed: before === 'Home' && opened.expanded === 'true' && opened.popovers === 1 && after.value === 'Home' && after.expanded === 'false' && after.role === 'combobox' && !after.popovers,
      detail: { before, opened, after } };
  }],
  ['Unsaved dialog value survives resize from 1440px to 768px', async (tab, base, host) => {
    const cdp = await page(tab, base, host, 'dialogs', { reducedMotion: true });
    await click(tab, 'button', 'Open dialog');
    await sleep(200);
    await tab.playwright.locator('#dialog-name').click();
    await js(tab, () => { const input = document.getElementById('dialog-name'); input.setSelectionRange(input.value.length, input.value.length); });
    await tab.type(' (unsaved QA edit)');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    const at768 = await js(tab, () => ({ open: document.getElementById('sample-dialog').open, value: document.getElementById('dialog-name').value, overflow: document.documentElement.scrollWidth > innerWidth }));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await tab.pressKey('Escape');
    return { passed: at768.open && at768.value === 'Sample page (unsaved QA edit)' && !at768.overflow, detail: at768 };
  }],
  ['Dialog Escape closes and returns focus to opener after exit animation', async (tab, base, host) => {
    await page(tab, base, host, 'dialogs', { reducedMotion: false });
    await click(tab, 'button', 'Open dialog');
    await sleep(400);
    const opened = await js(tab, () => document.getElementById('sample-dialog').open);
    await tab.pressKey('Escape');
    await sleep(600);
    const after = await js(tab, () => ({ open: document.getElementById('sample-dialog').open, focus: document.activeElement?.textContent.trim() }));
    return { passed: opened && !after.open && after.focus === 'Open dialog', detail: { opened, ...after } };
  }],
  ['Empty dialog footer has no displayed box', async (tab, base, host) => {
    await page(tab, base, host, 'dialogs', { reducedMotion: true });
    await click(tab, 'button', 'Open without footer');
    await sleep(200);
    const footer = await js(tab, () => { const f = document.getElementById('sample-dialog-foot'), r = f.getBoundingClientRect(), cs = getComputedStyle(f);
      return { display: cs.display, height: r.height, border: cs.borderTopWidth, children: f.children.length, open: document.getElementById('sample-dialog').open }; });
    await tab.pressKey('Escape');
    return { passed: footer.open && footer.children === 0 && (footer.display === 'none' || footer.height === 0), detail: footer };
  }],
  ['Processing prevents duplicate activation', async (tab, base, host) => {
    await page(tab, base, host, 'actions', { reducedMotion: true });
    await click(tab, 'button', 'Start processing');
    await sleep(150);
    const busy = await js(tab, () => { const b = document.getElementById('processing'); const r = b.getBoundingClientRect();
      return { disabled: b.disabled, busy: b.getAttribute('aria-busy'), label: b.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    // A second real click on the busy action must not restart it.
    await tab.clickAt(busy.x, busy.y);
    await sleep(150);
    const still = await js(tab, () => ({ disabled: document.getElementById('processing').disabled, finishEnabled: [...document.querySelectorAll('[data-finish]')].every(b => !b.disabled) }));
    await click(tab, 'button', 'Complete successfully');
    return { passed: busy.disabled && busy.busy === 'true' && still.disabled && still.finishEnabled, detail: { busy, still } };
  }],
  ['Success restores action', async (tab, base, host) => {
    await page(tab, base, host, 'actions', { reducedMotion: true });
    await click(tab, 'button', 'Start processing');
    await sleep(150);
    await click(tab, 'button', 'Complete successfully');
    await sleep(400);
    const after = await js(tab, () => { const b = document.getElementById('processing');
      return { disabled: b.disabled, busy: b.getAttribute('aria-busy'), label: b.textContent.trim(), finishDisabled: [...document.querySelectorAll('[data-finish]')].every(x => x.disabled) }; });
    return { passed: !after.disabled && after.busy !== 'true' && after.label === 'Start processing' && after.finishDisabled, detail: after };
  }],
  ['Failure restores action with recoverable error', async (tab, base, host) => {
    await page(tab, base, host, 'actions', { reducedMotion: true });
    await click(tab, 'button', 'Start processing');
    await sleep(150);
    await click(tab, 'button', 'Simulate failure');
    await sleep(400);
    const after = await js(tab, () => { const b = document.getElementById('processing');
      const alerts = [...document.querySelectorAll('[role=alert]')].filter(a => a.getBoundingClientRect().height > 0).map(a => a.textContent.trim());
      return { disabled: b.disabled, busy: b.getAttribute('aria-busy'), label: b.textContent.trim(), alert: alerts.find(t => t.includes('Preview failed')) || null }; });
    return { passed: !after.disabled && after.busy !== 'true' && after.label === 'Start processing' && !!after.alert, detail: after };
  }],
  ['Disclosure remains mounted during exit and survives rapid reopening', async (tab, base, host) => {
    await page(tab, base, host, 'actions', { reducedMotion: false });
    const state = () => js(tab, () => { const p = document.getElementById('motion-details'), t = document.querySelector('[data-motion-disclosure]');
      return { hidden: p.hidden, height: p.getBoundingClientRect().height, expanded: t.getAttribute('aria-expanded') }; });
    await click(tab, 'button', 'Toggle details');
    await sleep(400);
    const open = await state();
    await click(tab, 'button', 'Toggle details');
    const exiting = await state();
    await click(tab, 'button', 'Toggle details');
    await sleep(500);
    const reopened = await state();
    return { passed: !open.hidden && open.expanded === 'true' && !exiting.hidden && exiting.height > 0 && exiting.expanded === 'false'
      && !reopened.hidden && reopened.height > 0 && reopened.expanded === 'true', detail: { open, exiting, reopened } };
  }],
  ['Reduced-motion disclosure exit completes', async (tab, base, host) => {
    await page(tab, base, host, 'actions', { reducedMotion: true });
    await click(tab, 'button', 'Toggle details');
    await sleep(150);
    await click(tab, 'button', 'Toggle details');
    await sleep(200);
    const after = await js(tab, () => ({ hidden: document.getElementById('motion-details').hidden, expanded: document.querySelector('[data-motion-disclosure]').getAttribute('aria-expanded') }));
    return { passed: after.hidden && after.expanded === 'false', detail: after };
  }],
  ['Refresh failure retains previous result and offers retry', async (tab, base, host) => {
    await page(tab, base, host, 'feedback', { reducedMotion: true });
    const state = await js(tab, () => { const e = document.getElementById('refresh-error'), retry = document.querySelector('[data-retry]');
      return { errorShown: !e.hidden && e.getBoundingClientRect().height > 0, role: e.getAttribute('role'), previous: document.getElementById('previous-result')?.textContent.trim(), retryEnabled: !retry.disabled }; });
    return { passed: state.errorShown && state.role === 'alert' && !!state.previous && state.retryEnabled, detail: state };
  }],
  ['Refresh recovery clears error silently and retains result', async (tab, base, host) => {
    await page(tab, base, host, 'feedback', { reducedMotion: true });
    const notices = () => js(tab, () => [...document.querySelectorAll('[role=status],[role=alert]')].filter(n => n.id !== 'refresh-error' && n.getBoundingClientRect().height > 0 && n.textContent.trim()).length);
    const before = await notices();
    await click(tab, 'button', 'Retry refresh');
    await sleep(400);
    const after = await js(tab, () => ({ errorHidden: document.getElementById('refresh-error').hidden, previous: document.getElementById('previous-result')?.textContent.trim() }));
    const added = (await notices()) - before;
    return { passed: after.errorHidden && !!after.previous && added === 0, detail: { ...after, noticesAdded: added } };
  }],
];

export async function runBehaviorChecks(tab, base) {
  const results = [];
  for (const host of ['cloud', 'builder']) {
    for (const [check, run] of CHECKS) {
      let outcome;
      try { outcome = await run(tab, base, host); } catch (error) { outcome = { passed: false, detail: String(error.message) }; }
      results.push({ host, check, passed: outcome.passed === true, detail: outcome.detail });
    }
  }
  const cdp = await tab.capabilities.get('cdp');
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  return results;
}
