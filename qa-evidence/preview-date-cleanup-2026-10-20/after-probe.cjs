const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const generated = fs.readFileSync('app/src/core/public-form-controls.generated.ts', 'utf8');
function generatedString(name) {
  const match = generated.match(new RegExp(`^export const ${name} = (.*);$`, 'm'));
  if (!match) throw new Error(`Missing ${name}`);
  return JSON.parse(match[1]);
}
const scriptBody = source => source.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
const DATE = scriptBody(generatedString('PUBLIC_DATE_JS'));
const markup = () => '<div id="preview-root"><form class="pagecraft-form" data-pagecraft-controls><label for="visit">Visit</label><input id="visit" name="visit" type="date" data-pagecraft-date required></form></div>';

function makeDom() {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${markup()}</body></html>`, {
    runScripts: 'outside-only', url: 'https://site.test/', pretendToBeVisual: true,
  });
  const win = dom.window;
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  win.requestAnimationFrame = callback => win.setTimeout(() => callback(Date.now()), 0);
  win.cancelAnimationFrame = handle => win.clearTimeout(handle);
  win.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  win.PointerEvent = win.MouseEvent;
  win.CSS ||= {};
  win.CSS.escape ||= value => String(value).replace(/[^\w-]/g, '\\$&');
  win.HTMLElement.prototype.scrollIntoView ||= function () {};
  return dom;
}

function listenerAudit(win) {
  const proto = win.EventTarget.prototype;
  const nativeAdd = proto.addEventListener;
  const nativeRemove = proto.removeEventListener;
  const records = [];
  let phase = 'baseline';
  const capture = opts => typeof opts === 'boolean' ? opts : !!opts?.capture;
  proto.addEventListener = function(type, fn, opts) {
    const found = records.find(record => record.active && record.target === this && record.type === type && record.fn === fn && record.capture === capture(opts));
    if (!found) records.push({ target: this, type, fn, capture: capture(opts), phase, active: true });
    return nativeAdd.call(this, type, fn, opts);
  };
  proto.removeEventListener = function(type, fn, opts) {
    const found = records.find(record => record.active && record.target === this && record.type === type && record.fn === fn && record.capture === capture(opts));
    if (found) found.active = false;
    return nativeRemove.call(this, type, fn, opts);
  };
  return {
    records,
    setPhase(next) { phase = next; },
    restore() { proto.addEventListener = nativeAdd; proto.removeEventListener = nativeRemove; },
    activeGlobal() { return records.filter(record => record.active && (record.target === win || record.target === win.document)); },
    describe(recordsToDescribe) {
      return recordsToDescribe.reduce((counts, record) => {
        const owner = record.target === win ? 'window' : record.target === win.document ? 'document' : 'element';
        const key = `${owner}:${record.type}:${record.phase}`;
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});
    },
  };
}

async function exactPreviewCycle(dom, audit, cycle, selectDay) {
  const win = dom.window;
  const doc = win.document;
  const listeners = [];
  const observers = [];
  const runtimeDisposers = [];
  win.__pagecraftRegisterPreviewDispose = cleanup => {
    if (typeof cleanup === 'function') runtimeDisposers.push(cleanup);
  };
  const proto = win.EventTarget.prototype;
  const add = proto.addEventListener;
  audit.setPhase(`cycle${cycle}-initial`);
  proto.addEventListener = function(type, fn, opts) {
    listeners.push([this, type, fn, opts]);
    return add.call(this, type, fn, opts);
  };
  const nativeObserver = {};
  for (const name of ['MutationObserver', 'IntersectionObserver']) {
    const Native = win[name];
    if (typeof Native !== 'function') continue;
    nativeObserver[name] = Native;
    const Wrapped = function(...args) {
      const observer = new Native(...args);
      observers.push(observer);
      return observer;
    };
    Wrapped.prototype = Native.prototype;
    win[name] = Wrapped;
  }
  try {
    win.eval(DATE);
  } finally {
    proto.addEventListener = add;
    for (const name of Object.keys(nativeObserver)) win[name] = nativeObserver[name];
    delete win.__pagecraftRegisterPreviewDispose;
  }

  audit.setPhase(`cycle${cycle}-deferred`);
  await new Promise(resolve => win.setTimeout(resolve, 30));
  const trigger = doc.querySelector('.pc-date-trigger');
  trigger.click();
  audit.setPhase(`cycle${cycle}-open`);
  await new Promise(resolve => win.setTimeout(resolve, 50));
  if (selectDay) {
    const day = [...doc.querySelectorAll('.pc-date-day:not([data-outside-range])')]
      .find(item => item.getAttribute('aria-disabled') !== 'true');
    day.click();
    audit.setPhase(`cycle${cycle}-selected`);
    await new Promise(resolve => win.setTimeout(resolve, 3050));
  }

  const beforeCleanup = audit.activeGlobal();
  const alertBefore = doc.querySelector('[data-live-announcer]');
  const alertBeforeSnapshot = alertBefore ? {
    count: doc.querySelectorAll('[data-live-announcer]').length,
    text: alertBefore.textContent,
  } : null;
  audit.setPhase(`cycle${cycle}-cleanup`);
  for (const dispose of runtimeDisposers) dispose();
  for (const [target, type, fn, opts] of listeners) {
    try { target.removeEventListener(type, fn, opts); } catch {}
  }
  for (const observer of observers) {
    try { observer.disconnect(); } catch {}
  }
  doc.querySelectorAll('[data-pagecraft-date-popover]').forEach(node => node.remove());
  doc.getElementById('preview-root')?.remove();
  await new Promise(resolve => win.setTimeout(resolve, 50));
  const afterCleanup = audit.activeGlobal();
  const alertAfter = doc.querySelector('[data-live-announcer]');
  return {
    initiallyCapturedListeners: listeners.length,
    globalListenersBeforeCleanup: audit.describe(beforeCleanup),
    globalListenersAfterCleanup: audit.describe(afterCleanup),
    residualGlobalListenerCount: afterCleanup.length,
    residualRuntimeGlobalListenerCount: afterCleanup.filter(record => !(record.target === doc && record.type === 'load')).length,
    alertBeforeCleanup: alertBeforeSnapshot,
    alertAfterCleanup: alertAfter ? { count: doc.querySelectorAll('[data-live-announcer]').length, text: alertAfter.textContent } : null,
  };
}

(async () => {
  const dom = makeDom();
  const audit = listenerAudit(dom.window);
  const first = await exactPreviewCycle(dom, audit, 1, true);
  dom.window.document.body.insertAdjacentHTML('afterbegin', markup());
  const second = await exactPreviewCycle(dom, audit, 2, false);
  dom.window.document.body.insertAdjacentHTML('afterbegin', markup());
  const third = await exactPreviewCycle(dom, audit, 3, false);
  const result = {
    first,
    second,
    third,
    finalGlobalListeners: audit.describe(audit.activeGlobal()),
    finalGlobalListenerCount: audit.activeGlobal().length,
    finalLiveAnnouncerCount: dom.window.document.querySelectorAll('[data-live-announcer]').length,
  };
  audit.restore();
  fs.writeFileSync('/tmp/pagecraft-preview-runtime-cleanup-after-probe.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
