// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

const hosts: HTMLElement[] = [];

function mount(column: PcNode) {
  const host = document.createElement('div');
  host.innerHTML = `<style>${C.treeCss([[column]], true)}</style>${C.renderNode(column, { edit: true })}`;
  document.body.appendChild(host);
  hosts.push(host);
  return host.querySelector<HTMLElement>('[data-t="column"]')!;
}

afterEach(() => {
  while (hosts.length) hosts.pop()!.remove();
});

describe('Spacer editor percentage parity', () => {
  test('keeps the editor floor only on a Column with its empty drop placeholder', () => {
    const column = C.N('column');
    const editing = C.renderNode(column, { edit: true });
    const published = C.renderNode(column, { edit: false });

    expect(editing).toContain('pagecraft-column s-column-empty');
    expect(editing).toContain('class="s-empty"');
    expect(published).not.toContain('s-column-empty');
    expect(published).not.toContain('s-empty');
    expect(C.baseCss(true)).toContain('.s-column-empty{min-height:40px}');
    expect(C.baseCss(true)).not.toContain('[data-t=column]{min-height:40px}');
    expect(getComputedStyle(mount(column)).minHeight).toBe('40px');
  });

  test('does not give a real percentage or zero-height child an editor-only parent height', () => {
    for (const height of ['25%', '0px']) {
      const spacer = C.N('spacer', {}, { d: { height }, t: {}, m: {} });
      const column = C.N('column', {}, {}, [spacer]);
      const editing = C.renderNode(column, { edit: true });
      const published = C.renderNode(column, { edit: false });
      const nodeRule = new RegExp(`\\.${C.nodeClass(spacer)}\\{[^}]*height:${height.replace('%', '\\%')};[^}]*\\}`);

      expect(editing).not.toContain('s-column-empty');
      expect(editing).toContain('data-t="column"');
      expect(published).not.toContain('s-column-empty');
      expect(C.treeCss([[column]], true)).toMatch(nodeRule);
      expect(C.treeCss([[column]], false)).toMatch(nodeRule);
      expect(getComputedStyle(mount(column)).minHeight).toBe('auto');
    }
  });

  test('lets authored Column minimums, including zero, outrank the empty scaffold', () => {
    const empty = C.N('column', {}, { d: { 'min-height': '200px' }, t: {}, m: {} });
    expect(getComputedStyle(mount(empty)).minHeight).toBe('200px');

    empty.css.d['min-height'] = '0px';
    expect(getComputedStyle(mount(empty)).minHeight).toBe('0px');

    const filled = C.N('column', {}, { d: { 'min-height': '200px' }, t: {}, m: {} }, [C.N('spacer')]);
    expect(C.renderNode(filled, { edit: true })).not.toContain('s-column-empty');
    expect(getComputedStyle(mount(filled)).minHeight).toBe('200px');
  });
});
