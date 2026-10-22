import { afterEach, describe, expect, test } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';

const doms: JSDOM[] = [];
const missingAlt = 'Community <workshop> table & an uninterrupted reference ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function openLightbox(itemCount = 2) {
  const gallery = C.N('gallery', {
    lightbox: 1,
    captions: 1,
    items: [
      { src: 'https://example.test/missing.jpg', alt: missingAlt, caption: 'Workshop morning' },
      { src: 'https://example.test/loaded.jpg', alt: 'Terrace gathering', caption: 'Outside in the sun' },
    ].slice(0, itemCount),
  });
  const dom = new JSDOM(`<!doctype html><head><style>${C.baseCss(false)}</style></head><body>${C.renderNode(gallery, { edit: false })}</body>`, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  doms.push(dom);
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.eval(C.LB_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));
  window.document.querySelector<HTMLElement>('.pagecraft-gallery-frame[href]')!
    .dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return { dom, dialog: window.document.querySelector<HTMLDialogElement>('.pagecraft-lightbox')! };
}

afterEach(() => {
  while (doms.length) doms.pop()!.window.close();
});

describe('Gallery lightbox failed images', () => {
  test('shows an accessible message with authored context, then clears it when another image loads', () => {
    const { dom, dialog } = openLightbox();
    const first = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    const error = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-error')!;
    const caption = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-cap')!;

    first.dispatchEvent(new dom.window.Event('error'));
    expect(first.hidden).toBe(true);
    expect(first.alt).toBe(missingAlt);
    expect(error.hidden).toBe(false);
    const status = error.querySelector<HTMLElement>('[role="status"]')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(error.querySelector('strong')!.textContent).toBe('Image unavailable');
    const detail = error.querySelector('span')!;
    expect(detail.textContent).toBe(missingAlt);
    expect(detail.children).toHaveLength(0);
    const errorStyle = dom.window.getComputedStyle(error);
    expect(errorStyle.fontSize).toBe('16px');
    expect(errorStyle.overflowWrap).toBe('anywhere');
    expect(caption.hidden).toBe(false);
    expect(caption.textContent).toBe('Workshop morning');

    dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-next')!.click();
    const second = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    expect(second).not.toBe(first);
    expect(second.hidden).toBe(true);
    second.dispatchEvent(new dom.window.Event('load'));
    expect(second.hidden).toBe(false);
    expect(second.alt).toBe('Terrace gathering');
    expect(error.hidden).toBe(true);
    expect(error.querySelector('strong')!.textContent).toBe('');
    expect(error.querySelector('span')!.textContent).toBe('');
    expect(caption.textContent).toBe('Outside in the sun');
  });

  test('handles a repeated cached failure and ignores a late event from the previous image', () => {
    const { dom, dialog } = openLightbox();
    const first = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    const error = dialog.querySelector<HTMLElement>('.pagecraft-lightbox-error')!;

    dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-next')!.click();
    const second = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    first.dispatchEvent(new dom.window.Event('error'));
    expect(error.hidden).toBe(true);
    expect(second.hidden).toBe(true);
    second.dispatchEvent(new dom.window.Event('load'));
    expect(second.hidden).toBe(false);

    dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-prev')!.click();
    const retry = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    expect(retry).not.toBe(first);
    retry.dispatchEvent(new dom.window.Event('error'));
    expect(retry.hidden).toBe(true);
    expect(error.hidden).toBe(false);
    expect(error.querySelector('strong')!.textContent).toBe('Image unavailable');
    expect(error.querySelector('span')!.textContent).toBe(missingAlt);
  });

  test('keeps retry keyboard reachable and focused while the exact source reloads', () => {
    const { dom, dialog } = openLightbox();
    const initial = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    initial.dispatchEvent(new dom.window.Event('error'));
    const retry = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-retry')!;
    const close = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-close')!;

    retry.focus();
    retry.click();
    const loading = dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!;
    expect(loading).not.toBe(initial);
    expect(loading.getAttribute('src')).toBe('https://example.test/missing.jpg');
    expect(loading.getAttribute('src')).toBe(initial.getAttribute('src'));
    expect(dom.window.document.activeElement).toBe(retry);
    expect(retry.hidden).toBe(false);
    expect(retry.getAttribute('aria-busy')).toBe('true');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    expect(retry.textContent).toBe('Trying again…');

    initial.dispatchEvent(new dom.window.Event('load'));
    expect(loading.hidden).toBe(true);
    expect(retry.hidden).toBe(false);

    loading.dispatchEvent(new dom.window.Event('load'));
    expect(loading.hidden).toBe(false);
    expect(retry.hidden).toBe(true);
    expect(dom.window.document.activeElement).toBe(close);
  });

  test('keeps Close and Try again in the keyboard loop when the only image fails', () => {
    const { dom, dialog } = openLightbox(1);
    dialog.querySelector<HTMLImageElement>('.pagecraft-lightbox-img')!
      .dispatchEvent(new dom.window.Event('error'));
    const retry = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-retry')!;
    const close = dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-close')!;

    expect(dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-prev')!.hidden).toBe(true);
    expect(dialog.querySelector<HTMLButtonElement>('.pagecraft-lightbox-next')!.hidden).toBe(true);
    retry.focus();
    const backwards = new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    retry.dispatchEvent(backwards);
    expect(backwards.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(close);

    const forwards = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    close.dispatchEvent(forwards);
    expect(forwards.defaultPrevented).toBe(true);
    expect(dom.window.document.activeElement).toBe(retry);
  });
});
