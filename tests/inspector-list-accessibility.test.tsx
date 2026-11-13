// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ImgsCtl, ItemsCtl, QaCtl } from '../app/src/ui/inspector/Lists';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

test('navigation item controls expose their purpose and unique item context', () => {
  const n = C.insert('nav', null, 0)!;
  const c = C.DEF.nav.controls.content.find(control => control.t === 'items')!;
  const items = n.props.items as Array<Record<string, any>>;
  items[1].label = 'Work';
  const draw = () => r.draw(<ItemsCtl n={n} c={c} />);
  draw();

  const first = () => r.$$('.navitem')[0];
  expect(first().querySelector('input[aria-label="Navigation label for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('select[aria-label="Destination for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('select[aria-label="Destination page for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('select[aria-label="Destination section/anchor for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('input[aria-label="CSS classes for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('select[aria-label="Parent item for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('input[aria-label="Link relationship for Work, item 1"]')).not.toBeNull();
  expect(first().querySelector('[role="switch"][aria-label="Open Work, item 1 in a new tab"]')).not.toBeNull();
  expect(first().querySelectorAll('[aria-label="Menu links"]')).toHaveLength(0);

  const cssClasses = first().querySelector('input[aria-label^="CSS classes"]')!;
  r.type(cssClasses, 'featured-link');
  expect(items[0].cls).toBe('featured-link');

  act(() => r.click(r.$$('.navitem-main')[1]));
  expect(r.$$('.navitem')[1].querySelector('input[aria-label="Navigation label for Work, item 2"]')).not.toBeNull();
  expect(r.$$('.navitem-main').map(button => button.getAttribute('aria-label'))).toEqual([
    'Edit Work, item 1', 'Edit Work, item 2', 'Edit Contact, item 3'
  ]);
});

test('custom navigation and other repeater inputs keep explicit contextual names', () => {
  const nav = C.insert('nav', null, 0)!;
  const navControl = C.DEF.nav.controls.content.find(control => control.t === 'items')!;
  (nav.props.items as Array<Record<string, any>>)[0].href = '';
  r.draw(<ItemsCtl n={nav} c={navControl} />);
  expect(r.$('input[aria-label="Custom URL or section for Work, item 1"]')).not.toBeNull();

  const accordion = C.N('accordion');
  const questions = C.DEF.accordion.controls.content.find(control => control.t === 'qa')!;
  r.draw(<QaCtl n={accordion} c={questions} />);
  act(() => r.click(r.$('.repeater-toggle')));
  expect(r.$('input[aria-label="Question for What do I get?, item 1"]')).not.toBeNull();
  expect(r.$('textarea[aria-label="Answer for What do I get?, item 1"]')).not.toBeNull();
  expect(r.$('button[aria-label="Duplicate What do I get?, item 1"]')).not.toBeNull();

  const gallery = C.N('gallery');
  gallery.props.items = [
    { src: 'asset:first', alt: '', caption: '' },
    { src: 'asset:second', alt: '', caption: '' }
  ];
  const images = C.DEF.gallery.controls.content.find(control => control.t === 'imgs')!;
  r.draw(<ImgsCtl n={gallery} c={images} />);
  expect(r.$$('input').map(input => input.getAttribute('aria-label'))).toEqual([
    'Alt text for image 1', 'Caption for image 1',
    'Alt text for image 2', 'Caption for image 2'
  ]);
  expect(r.$('button[aria-label="Remove image 2"]')).not.toBeNull();
});
