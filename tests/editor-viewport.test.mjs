import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

test('enlarged desktop layouts preserve editing, focused values, and dialog ownership', async () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: console,
    beforeParse(window) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    }
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const window = dom.window, document = window.document;
    const resize = width => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      window.dispatchEvent(new window.Event('resize'));
    };
    window.__CORE.state.meta.name = 'Keep the enlarged-view draft';
    window.openModal('Enlarged view QA', '<label for="zoomValue">Draft name</label><input id="zoomValue" value="Unsaved draft name">', '');
    const input = document.querySelector('#zoomValue');
    input.focus(); input.setSelectionRange(3, 7);
    // 720 and 640 CSS pixels are layout space for 1440/1280 desktop windows at 200%.
    for (const width of [720, 640, 768]) {
      resize(width);
      expect(document.querySelector('#zoomValue')).toBe(input);
      expect(input.value).toBe('Unsaved draft name');
      expect(input.selectionStart).toBe(3);
      expect(document.activeElement).toBe(input);
      expect(document.querySelector('#modal').hidden).toBe(false);
      expect(document.querySelector('#modal').hasAttribute('inert')).toBe(false);
      expect(document.querySelector('#app').hasAttribute('inert')).toBe(true); // The dialog owns focus.
      expect(window.__CORE.state.meta.name).toBe('Keep the enlarged-view draft');
    }
    document.querySelector('#mClose').click();
    await new Promise(resolve => setTimeout(resolve, 300));
    resize(720);
    expect(document.querySelector('#app').hasAttribute('inert')).toBe(false);
    let received = 0;
    document.addEventListener('keydown', () => received++, { once: true });
    document.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, key: 'F6' }));
    expect(received).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    dom.window.close();
  }
});
