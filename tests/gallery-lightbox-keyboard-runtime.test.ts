import { afterEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const doms: JSDOM[] = [];

function runLightboxRuntime(itemCount: number) {
  const gallery = C.N('gallery', {
    lightbox: 1,
    items: Array.from({ length: itemCount }, (_, index) => ({
      src: `https://example.test/image-${index + 1}.jpg`,
      alt: `Image ${index + 1}`,
      caption: `Caption ${index + 1}`,
    })),
  });
  const dom = new JSDOM(`<!doctype html><body>${C.renderNode(gallery, { edit: false })}</body>`, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  doms.push(dom);
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.eval(C.LB_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
  const opener = window.document.querySelector<HTMLElement>('.pagecraft-gallery-frame[href]')!;
  opener.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return { dom, dialog: window.document.querySelector<HTMLDialogElement>('.pagecraft-lightbox')! };
}

function tab(dom: JSDOM, target: HTMLElement, shiftKey = false) {
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  while (doms.length) doms.pop()!.window.close();
});

describe('Gallery lightbox keyboard runtime', () => {
  test('Tab wraps only at the visible control boundaries', () => {
    const { dom, dialog } = runLightboxRuntime(2);
    const previous = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-prev')!;
    const next = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-next')!;
    const close = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-close')!;

    previous.focus();
    const backward = tab(dom, previous, true);
    expect(backward.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(close);

    close.focus();
    const forward = tab(dom, close);
    expect(forward.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(previous);

    next.focus();
    const within = tab(dom, next);
    expect(within.defaultPrevented).toBe(false);
    expect(dom.window.document.activeElement).toBe(next);
  });

  test('a single-image lightbox skips hidden controls and keeps Tab on Close', () => {
    const { dom, dialog } = runLightboxRuntime(1);
    const previous = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-prev')!;
    const next = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-next')!;
    const close = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-close')!;

    expect(previous.hidden).toBe(true);
    expect(next.hidden).toBe(true);

    close.focus();
    const forward = tab(dom, close);
    expect(forward.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(close);

    const backward = tab(dom, close, true);
    expect(backward.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(close);
  });
});
