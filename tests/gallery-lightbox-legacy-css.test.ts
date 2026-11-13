// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const doms: JSDOM[] = [];

function gallery(src: string, alt: string) {
  return C.renderNode(C.N('gallery', {
    lightbox: 1,
    captions: 1,
    items: [{ src, alt, caption: `${alt} caption` }],
  }), { edit: false });
}

function legacyRuntime() {
  const legacyCss = C.baseCss(false).replace(C.LIGHTBOX_FAILURE_CSS, '');
  expect(legacyCss).not.toContain('.pagecraft-lightbox-error');
  const dom = new JSDOM(`<!doctype html><head><style>${legacyCss}</style></head><body>${gallery('https://example.test/one.jpg', 'First image')}${gallery('https://example.test/two.jpg', 'Second image')}</body>`, {
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });
  doms.push(dom);
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const script = window.document.createElement('script');
  script.nonce = 'gallery-runtime-nonce';
  script.textContent = C.LB_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
  window.document.head.appendChild(script);
  return dom;
}

afterEach(() => {
  while (doms.length) doms.pop()!.window.close();
});

describe('Gallery lightbox compatibility with saved legacy CSS', () => {
  test('installs the canonical failure styles once, with the runtime nonce, only when opened', () => {
    const dom = legacyRuntime();
    const { document, MouseEvent, Event } = dom.window;
    const frames = [...document.querySelectorAll<HTMLElement>('.pagecraft-gallery-frame')];

    expect(document.querySelector('[data-pagecraft-lightbox-failure]')).toBeNull();
    frames[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const style = document.querySelector<HTMLStyleElement>('style[data-pagecraft-lightbox-failure]')!;
    expect(style).not.toBeNull();
    expect(style.nonce).toBe('gallery-runtime-nonce');
    expect(style.textContent).toBe(C.LIGHTBOX_FAILURE_CSS);

    const dialog = document.querySelector<HTMLDialogElement>('.pagecraft-lightbox')!;
    dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!.dispatchEvent(new Event('error'));
    const error = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-error')!;
    const retry = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-retry')!;
    expect(dom.window.getComputedStyle(error).fontSize).toBe('16px');
    expect(dom.window.getComputedStyle(error).overflowWrap).toBe('anywhere');
    expect(dom.window.getComputedStyle(retry).fontSize).toBe('16px');
    expect(C.LIGHTBOX_FAILURE_CSS).toContain('.pagecraft-lightbox .pagecraft-lightbox-retry:focus-visible{outline:2px solid #fff;outline-offset:3px}');

    dialog.close();
    frames[1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('style[data-pagecraft-lightbox-failure]')).toHaveLength(1);
  });
});
