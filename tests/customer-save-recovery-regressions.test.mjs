import { expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('builder.html', 'utf8');
const recoveryStart = source.indexOf('function reloadDiscardingChanges() {');
const recoveryEnd = source.indexOf('\n/* A failed write must never be a whisper', recoveryStart);
const unloadStart = source.indexOf("window.addEventListener('beforeunload'");
const unloadEnd = source.indexOf('\n/* Another tab wrote this project', unloadStart);
if ([recoveryStart, recoveryEnd, unloadStart, unloadEnd].some(index => index < 0)) {
  throw new Error('save recovery helpers are missing from builder.html');
}
const recoverySource = source.slice(recoveryStart, recoveryEnd);
const unloadSource = source.slice(unloadStart, unloadEnd);

function recoveryHarness({ failed = false } = {}) {
  const listeners = {};
  const window = { listeners, addEventListener(type, listener) { listeners[type] = listener; } };
  const reload = vi.fn();
  const writeNow = vi.fn();
  const writeServer = vi.fn();
  let queued = null;
  const setTimeout = vi.fn(fn => { queued = fn; return 41; });
  const clearTimeout = vi.fn(id => { if (id === 41) queued = null; });
  const factory = new Function('window', 'location', 'writeNow', 'writeServer', 'setTimeout', 'clearTimeout', 'SRV', `
    let deliberateReload = false, saveTimer = null;
    let dirty = false, saveAgain = true, saving = false, loadBlocked = false;
    let saveState = ${JSON.stringify(failed ? 'failed' : 'ok')};
    ${recoverySource}
    ${unloadSource}
    return {
      save, reloadDiscardingChanges, listeners: window.listeners,
      state: () => ({ deliberateReload, saveTimer, dirty, saveAgain, saving, saveState })
    };
  `);
  const api = factory(window, { reload }, writeNow, writeServer, setTimeout, clearTimeout, {});
  return { ...api, reload, writeNow, writeServer, setTimeout, clearTimeout,
    runQueued() { const fn = queued; queued = null; if (fn) fn(); } };
}

function unloadEvent() {
  return { preventDefault: vi.fn(), returnValue: undefined };
}

test('ordinary navigation still warns while a debounced edit is unsaved', () => {
  const h = recoveryHarness();
  h.save();
  expect(h.state().dirty).toBe(true);
  const event = unloadEvent();
  h.listeners.beforeunload(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(event.returnValue).toBe('');
  expect(h.reload).not.toHaveBeenCalled();
});

test('explicit recovery reload discards queued writes and bypasses only that unload', () => {
  const h = recoveryHarness({ failed: true });
  h.save();
  expect(h.setTimeout).toHaveBeenCalledTimes(1);

  h.reloadDiscardingChanges();
  expect(h.reload).toHaveBeenCalledTimes(1);
  expect(h.clearTimeout).toHaveBeenCalledWith(41);
  expect(h.state()).toMatchObject({ deliberateReload: true, saveTimer: null, dirty: false, saveAgain: false });

  const event = unloadEvent();
  h.listeners.beforeunload(event);
  h.listeners.pagehide();
  h.runQueued();
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(h.writeServer).not.toHaveBeenCalled();
  expect(h.writeNow).not.toHaveBeenCalled();
});

test('stale, content-scope and expired-session recovery buttons use deliberate reload', () => {
  for (const id of ['stReload', 'coReload', 'seReload']) {
    expect(source).toContain(`$('#${id}').addEventListener('click', reloadDiscardingChanges);`);
  }
  expect(source).not.toMatch(/#(?:stReload|coReload|seReload)'\)\.addEventListener\('click', \(\) => location\.reload\(\)/);
});
