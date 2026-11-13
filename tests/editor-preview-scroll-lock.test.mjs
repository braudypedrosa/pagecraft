import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { NAV_JS, N, renderNode } from '../app/src/core/index';

const builder = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

test('repainting Preview after a mobile menu opens restores canvas scrolling', () => {
  const html = renderNode(N('nav', {
    aria: 'Primary', collapse: 'mobile', mobileMenu: 'fullscreen',
    items: [{ id: 'work', label: 'Work', href: '#work' }]
  }), { edit: false });
  const dom = new JSDOM(`<html style="overflow:clip"><body>${html}</body></html>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/'
  });
  windows.push(dom);
  const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const append = d.body.appendChild.bind(d.body);
  d.body.appendChild = node => {
    const added = append(node);
    if (node.tagName === 'SCRIPT') w.eval(node.textContent);
    return added;
  };
  Object.assign(w, {
    cwin: w, cdoc: d, canvasNonce: 'test', NAV_JS,
    SLIDE_JS: '', CODE_JS: '', TABS_JS: '', FACADE_JS: '', LB_JS: '',
    PUBLIC_SELECT_JS: '', PUBLIC_DATE_JS: '', ANIM_JS: '', ANIM_CSS: '', ANIM_CALM: '',
    $$: (selector, root = d) => [...root.querySelectorAll(selector)]
  });
  const runtime = builder.slice(builder.indexOf('let previewDispose = () => {};'), builder.indexOf('\nlet canvasReadyCleanup'));
  w.eval(runtime.replace('let previewDispose', 'var previewDispose'));

  w.runPreviewRuntime(html);
  d.querySelector('[data-nav-t]').click();
  expect(d.documentElement.style.overflow).toBe('hidden');

  w.runPreviewRuntime('<main>Desktop preview</main>');
  expect(d.documentElement.style.overflow).toBe('clip');
});
