import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function findModal() {'), source.indexOf('\nfunction clientReviewModal()'));
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));

test('Find fields use their visible labels and Match case exposes both persistent states', () => {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' }); windows.push(dom);
  const w = dom.window, d = w.document;
  const searchAll = vi.fn(() => []);
  Object.assign(w, {
    editing: { on: false }, findState: { q: 'Workshop', to: '', ci: true },
    $: selector => d.querySelector(selector), $$: (selector, root = d) => [...root.querySelectorAll(selector)],
    esc: value => String(value ?? ''), searchAll, searchCount: () => 0, dbounce: fn => fn,
    openModal: (_title, content, footer) => { d.body.innerHTML = content + footer; }, closeModal: vi.fn()
  });
  w.eval(code); w.findModal();
  expect([...d.querySelector('#fdQ').labels].map(label => label.textContent)).toEqual(['Find']);
  expect([...d.querySelector('#fdTo').labels].map(label => label.textContent)).toEqual(['Replace with']);
  const button = d.querySelector('#fdCase');
  expect(d.getElementById(button.getAttribute('aria-labelledby')).textContent).toBe('Match case');
  expect(button.type).toBe('button');
  expect(button.getAttribute('aria-pressed')).toBe('false');
  button.click();
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(searchAll).toHaveBeenLastCalledWith('Workshop', { caseSensitive: true });
  button.click();
  expect(button.getAttribute('aria-pressed')).toBe('false');
  expect(searchAll).toHaveBeenLastCalledWith('Workshop', { caseSensitive: false });
});
