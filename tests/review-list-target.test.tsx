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

test('snapshot findings group by page with problem priority and retain their own targets', () => {
  const image = C.insert('image', null, 0)!;
  Object.assign(image.props, { src: 'courtyard.webp', alt: '', w: '800', h: '600' });
  const target = C.lint().find(finding => finding.code === 'no-alt')!.target!;
  const source = C.lint();
  const findings = [
    { level: 'warn', code: 'title', msg: 'Add a browser title.', where: { page: 'Workshop', slug: 'workshop' }, target },
    { level: 'warn', code: 'description', msg: 'Add a description.', where: { page: 'Workshop', slug: 'workshop' } },
    { level: 'error', code: 'missing', msg: 'Choose a destination.', where: { page: 'Contact', slug: 'contact' }, target }
  ] as any;
  act(() => r.draw(<ReviewList defaultOpen findings={findings} />));
  const groups = r.$$('.review-group') as HTMLDetailsElement[];
  expect(groups.length).toBe(2);
  expect(groups[0].querySelector('summary')!.textContent).toBe('Contact1 problem');
  expect(groups[0].open).toBe(true);
  expect(groups[1].querySelector('summary')!.textContent).toBe('Workshop2 suggestions');
  expect(groups[1].open).toBe(false);
  expect(r.$$('.review-level').map(e => e.textContent)).toEqual(['Problem', 'Suggestion', 'Suggestion']);
  act(() => r.click(groups[1].querySelector('.go')));
  expect(r.arg('showReviewTarget')).toEqual([target]);
  expect(C.lint()).toEqual(source);
});

test('review disclosure announces expanded state and controls the actual grouped content', () => {
  act(() => r.draw(<ReviewList findings={[{ level: 'warn', code: 'title', msg: 'Add a title.', where: { page: 'Workshop' } }]} />));
  const button = r.$('.rh button')!;
  expect(button.getAttribute('aria-expanded')).toBe('false');
  const target = button.ownerDocument.getElementById(button.getAttribute('aria-controls')!)!;
  expect(target).not.toBeNull();
  expect(target.querySelector('.review-group')).toBeNull();
  act(() => r.click(button));
  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(target.querySelector('.review-group')?.textContent).toContain('Workshop');
});


test.each(['header', 'footer'] as const)('static lint Show me opens the actual page-owned %s', kind => {
  const node = C.N('button', { text: 'Workshop destination', link: 'missing-workshop.html' });
  C.page()[kind] = [node];
  const finding = C.lint().find(row => row.code === 'dead-link' && row.nodeId === node.id)!;
  expect(finding.target).toBeUndefined();
  expect(finding.where.region).toBe('page ' + kind);
  act(() => r.draw(<ReviewList defaultOpen findings={[finding]} />));
  act(() => r.click(r.$('.go')));
  expect(C.state.ui.mode).toBe(kind);
  expect(C.locate(node.id)?.node).toBe(node);
  expect(r.arg('select')).toEqual([node.id, { scroll: true }]);
  expect(r.names()).not.toContain('toast');
});

test('stale static lint cannot enter a now-hidden region or select its non-rendered node', () => {
  const node = C.N('button', { text: 'Workshop destination', link: 'missing-workshop.html' });
  C.page().header = [node];
  const finding = C.lint().find(row => row.code === 'dead-link' && row.nodeId === node.id)!;
  C.page().header = null;
  act(() => r.draw(<ReviewList defaultOpen findings={[finding]} />));
  act(() => r.click(r.$('.go')));
  expect(C.state.ui.mode).toBe('page');
  expect(r.names()).not.toContain('select');
  expect(r.arg('toast')).toEqual(['That element is no longer shown on this page']);
});
