import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

const style = () => C.findStyle('body')!;
const make = (type: 'heading' | 'text' | 'button', css: PcNode['css']) => {
  const node = C.N(type, { text: 'Responsive type', html: 'Responsive type', ts: 'body' });
  node.css = css;
  return node;
};

beforeEach(() => {
  C.blankProject('Responsive typography transfer');
  C.ensureTokens();
  style().css = {
    d: { 'font-size': '17px', 'font-weight': '400', 'line-height': '1.6', color: '#223344' },
    t: { 'font-weight': '500', 'letter-spacing': '.01em' },
    m: { 'font-size': '15px', 'font-weight': '600', 'line-height': '1.4' },
  };
});

test.each(['heading', 'text', 'button'] as const)(
  'updating %s typography keeps an inherited mobile value from the source', type => {
    const source = make(type, {
      d: { 'font-size': '18px', 'background-color': '#f5f1e8' },
      t: { 'font-size': '16px', 'padding-left': '12px' },
      m: { 'padding-left': '8px' },
    });
    const peer = make(type, {
      d: { 'font-size': '20px', 'border-radius': '4px' }, t: {}, m: {},
    });

    expect(C.tsUpdateFrom(source)).toBe(true);

    expect(style().css.d['font-size']).toBe('18px');
    expect(style().css.t['font-size']).toBe('16px');
    expect(style().css.m['font-size']).toBeUndefined();
    expect(source.css).toEqual({
      d: { 'background-color': '#f5f1e8' },
      t: { 'padding-left': '12px' },
      m: { 'padding-left': '8px' },
    });
    expect(peer.css.d['font-size']).toBe('20px');
    expect(peer.css.d['border-radius']).toBe('4px');
  },
);

test('base, tablet and mobile ownership clear only the affected responsive tail', () => {
  const base = make('text', { d: { 'font-size': '18px' }, t: {}, m: {} });
  expect(C.tsUpdateFrom(base)).toBe(true);
  expect(style().css.d['font-size']).toBe('18px');
  expect(style().css.t['font-size']).toBeUndefined();
  expect(style().css.m['font-size']).toBeUndefined();

  style().css.d['font-size'] = '17px';
  style().css.t['font-size'] = '16.5px';
  style().css.m['font-size'] = '15px';
  const tablet = make('text', { d: {}, t: { 'font-size': '16px' }, m: {} });
  expect(C.tsUpdateFrom(tablet)).toBe(true);
  expect(style().css.d['font-size']).toBe('17px');
  expect(style().css.t['font-size']).toBe('16px');
  expect(style().css.m['font-size']).toBeUndefined();

  style().css.m['font-size'] = '15px';
  const mobile = make('text', { d: {}, t: {}, m: { 'font-size': '14px' } });
  expect(C.tsUpdateFrom(mobile)).toBe(true);
  expect(style().css.d['font-size']).toBe('17px');
  expect(style().css.t['font-size']).toBe('16px');
  expect(style().css.m['font-size']).toBe('14px');
});

test('zero and CSS-wide values transfer while untouched typography stays intact', () => {
  const source = make('heading', {
    d: { 'letter-spacing': '0', 'font-style': 'inherit', 'text-transform': 'initial' },
    t: { 'line-height': 'unset', opacity: '.8' },
    m: {},
  });
  const beforeFamily = structuredClone(style().css);

  expect(C.tsUpdateFrom(source)).toBe(true);

  expect(style().css.d['letter-spacing']).toBe('0');
  expect(style().css.d['font-style']).toBe('inherit');
  expect(style().css.d['text-transform']).toBe('initial');
  expect(style().css.t['line-height']).toBe('unset');
  expect(style().css.m['line-height']).toBeUndefined();
  expect(style().css.d['font-weight']).toBe(beforeFamily.d['font-weight']);
  expect(style().css.t['font-weight']).toBe(beforeFamily.t['font-weight']);
  expect(style().css.m['font-weight']).toBe(beforeFamily.m['font-weight']);
  expect(source.css.t.opacity).toBe('.8');
});

test('unlink bakes the same responsive appearance when a local ancestor override wins', () => {
  const node = make('text', {
    d: { 'font-size': '18px', 'background-color': '#fff' },
    t: { 'font-size': '16px' },
    m: {},
  });

  expect(C.tsUnlink(node)).toBe(true);

  expect(node.props.ts).toBe('');
  expect(node.css.d['font-size']).toBe('18px');
  expect(node.css.t['font-size']).toBe('16px');
  expect(node.css.m['font-size']).toBeUndefined();
  expect(node.css.d['font-weight']).toBe('400');
  expect(node.css.t['font-weight']).toBe('500');
  expect(node.css.m['font-weight']).toBe('600');
  expect(node.css.d['background-color']).toBe('#fff');
});
