// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ReviewList } from '../app/src/ui/ReviewList';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

test('Show me delegates a structured finding without parsing its display label', () => {
  const image = C.insert('image', null, 0)!;
  Object.assign(image.props, { src: 'courtyard.webp', alt: '', w: '800', h: '600' });
  const finding = C.lint().find(row => row.code === 'no-alt')!;

  act(() => r.draw(<ReviewList defaultOpen />));
  act(() => r.click(r.$('.go')));

  expect(finding.target).toBeDefined();
  expect(r.arg('showReviewTarget')).toEqual([finding.target]);
  expect(r.names()).not.toContain('select');
  expect(r.names()).not.toContain('appRender');
});

test('legacy findings without a structured target retain page render and node selection', () => {
  const first = C.N('heading', { level: 'h1', text: 'Title' });
  const skipped = C.N('heading', { level: 'h3', text: 'Details' });
  C.state.pages[0].tree = [first, skipped];
  const finding = C.lint().find(row => row.code === 'heading-skip')!;
  expect(finding.target).toBeUndefined();

  act(() => r.draw(<ReviewList defaultOpen />));
  act(() => r.click(r.$('.go')));

  expect(r.names()).toContain('closeReviewSurface');
  expect(r.names()).toContain('appRender');
  expect(r.arg('select')).toEqual([skipped.id, { scroll: true }]);
});

test('legacy Site checks findings leave Preview before selecting the editable node', () => {
  const first = C.N('heading', { level: 'h1', text: 'Title' });
  const skipped = C.N('heading', { level: 'h3', text: 'Details' });
  C.state.pages[0].tree = [first, skipped];
  document.body.classList.add('preview');

  act(() => r.draw(<ReviewList defaultOpen />));
  act(() => r.click(r.$('.go')));

  expect(document.body.classList.contains('preview')).toBe(false);
  expect(r.names()).toContain('exitPreview');
  expect(r.arg('select')).toEqual([skipped.id, { scroll: true }]);
});
