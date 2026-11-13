// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { install } from '../app/src/ui/ctx';
import { FieldsCtl, ItemsCtl, QaCtl } from '../app/src/ui/inspector/Lists';
import { rig, stubLegacy, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function blurInto(from: HTMLInputElement, to: HTMLElement) {
  act(() => {
    from.blur();
    to.focus();
  });
}

function installHistory() {
  let transaction = '';
  const legacy = stubLegacy(r.calls);
  install(C, {
    ...legacy,
    tx(key: string) {
      r.calls.push(['tx', key]);
      if (transaction === key) return;
      transaction = key;
      C.checkpoint();
    },
    endTx() {
      r.calls.push(['endTx']);
      transaction = '';
    }
  });
}

test('accordion labels refresh after commit without interrupting typing or replacing the item', () => {
  const accordion = C.N('accordion');
  const control = C.DEF.accordion.controls.content.find(candidate => candidate.t === 'qa')!;
  const item = (accordion.props.items as Array<Record<string, any>>)[0];
  const original = item.q;
  const next = 'Can I bring my dog? <sample> & café';
  C.state.pages[0].tree = [accordion];
  const before = JSON.stringify(C.doc());
  installHistory();
  r.draw(<QaCtl n={accordion} c={control} />);
  act(() => r.click(r.$('.repeater-toggle')));
  const endTxBeforeTyping = r.names().filter(name => name === 'endTx').length;

  const question = r.$('input[aria-label^="Question for"]') as HTMLInputElement;
  const answer = r.$('textarea[aria-label^="Answer for"]') as HTMLTextAreaElement;
  question.focus();
  r.type(question, 'Can I bring my dog?');
  r.type(question, next);

  expect(document.activeElement).toBe(question);
  expect(question.value).toBe(next);
  expect(r.$('.repeater-toggle span')?.textContent).toBe(original);
  expect(question.getAttribute('aria-label')).toBe(`Question for ${original}, item 1`);
  expect((accordion.props.items as Array<Record<string, any>>)[0]).toBe(item);

  blurInto(question, answer);

  expect(document.activeElement).toBe(answer);
  expect(r.$('.repeater-toggle span')?.textContent).toBe(next);
  expect(r.$('.repeater-toggle')?.getAttribute('aria-label')).toBe(`Edit ${next}, item 1`);
  expect(r.$('input[aria-label^="Question for"]')?.getAttribute('aria-label')).toBe(`Question for ${next}, item 1`);
  expect(r.$('textarea[aria-label^="Answer for"]')?.getAttribute('aria-label')).toBe(`Answer for ${next}, item 1`);
  expect(r.$('button[title="Duplicate"]')?.getAttribute('aria-label')).toBe(`Duplicate ${next}, item 1`);
  expect((accordion.props.items as Array<Record<string, any>>)[0]).toBe(item);
  expect(r.names().filter(name => name === 'tx')).toHaveLength(2);
  expect(r.names().filter(name => name === 'endTx')).toHaveLength(endTxBeforeTyping + 1);
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  expect(JSON.stringify(C.doc())).toBe(before);
});

test('tab labels and aria names refresh after the tab label commits', () => {
  const tabs = C.N('tabs');
  const control = C.DEF.tabs.controls.content.find(candidate => candidate.t === 'qa')!;
  const item = (tabs.props.items as Array<Record<string, any>>)[0];
  const original = item.label;
  const next = 'Travel details & café';
  r.draw(<QaCtl n={tabs} c={control} />);
  act(() => r.click(r.$('.repeater-toggle')));

  const label = r.$('input[aria-label^="Tab label for"]') as HTMLInputElement;
  const panel = r.$('textarea[aria-label^="Content for"]') as HTMLTextAreaElement;
  label.focus();
  r.type(label, next);

  expect(r.$('.repeater-toggle span')?.textContent).toBe(original);
  expect(label.getAttribute('aria-label')).toBe(`Tab label for ${original}, item 1`);
  expect((tabs.props.items as Array<Record<string, any>>)[0]).toBe(item);

  blurInto(label, panel);

  expect(document.activeElement).toBe(panel);
  expect(r.$('.repeater-toggle span')?.textContent).toBe(next);
  expect(r.$('.repeater-toggle')?.getAttribute('aria-label')).toBe(`Edit ${next}, item 1`);
  expect(r.$('input[aria-label^="Tab label for"]')?.getAttribute('aria-label')).toBe(`Tab label for ${next}, item 1`);
  expect(r.$('textarea[aria-label^="Content for"]')?.getAttribute('aria-label')).toBe(`Content for ${next}, item 1`);
  expect(r.$('button[title="Duplicate"]')?.getAttribute('aria-label')).toBe(`Duplicate ${next}, item 1`);
  expect((tabs.props.items as Array<Record<string, any>>)[0]).toBe(item);
});

test('navigation and form row names refresh only after their label commits', () => {
  const nav = C.insert('nav', null, 0)!;
  const navControl = C.DEF.nav.controls.content.find(candidate => candidate.t === 'items')!;
  const navItem = (nav.props.items as Array<Record<string, any>>)[0];
  r.draw(<ItemsCtl n={nav} c={navControl} />);
  const navLabel = r.$('input[aria-label^="Navigation label for"]') as HTMLInputElement;
  navLabel.focus();
  r.type(navLabel, 'Visit us');
  expect(r.$('.navitem-main b')?.textContent).not.toBe('Visit us');
  act(() => navLabel.blur());
  expect(r.$('.navitem-main b')?.textContent).toBe('Visit us');
  expect(r.$('.navitem-main')?.getAttribute('aria-label')).toBe('Edit Visit us, item 1');
  expect((nav.props.items as Array<Record<string, any>>)[0]).toBe(navItem);

  const form = C.N('form');
  const fields = C.DEF.form.controls.content.find(candidate => candidate.t === 'fields')!;
  const field = (form.props.fields as Array<Record<string, any>>)[0];
  r.draw(<FieldsCtl n={form} c={fields} />);
  act(() => r.click(r.$('.repeater-toggle')));
  const fieldLabel = r.$('input[placeholder="Label"]') as HTMLInputElement;
  fieldLabel.focus();
  r.type(fieldLabel, 'Best contact email');
  expect(r.$('.repeater-toggle span')?.textContent).not.toBe('Best contact email');
  act(() => fieldLabel.blur());
  expect(r.$('.repeater-toggle span')?.textContent).toBe('Best contact email');
  expect(r.$('.repeater-toggle')?.getAttribute('aria-label')).toBe('Edit Best contact email, item 1');
  expect((form.props.fields as Array<Record<string, any>>)[0]).toBe(field);
});

test('view-only focus and blur do not mutate list data or create history', () => {
  const accordion = C.N('accordion');
  const control = C.DEF.accordion.controls.content.find(candidate => candidate.t === 'qa')!;
  const before = JSON.stringify(accordion.props.items);
  r.draw(<QaCtl n={accordion} c={control} />);
  act(() => r.click(r.$('.repeater-toggle')));
  const question = r.$('input[aria-label^="Question for"]') as HTMLInputElement;
  act(() => { question.focus(); question.blur(); });

  expect(JSON.stringify(accordion.props.items)).toBe(before);
  expect(C.hist.u).toHaveLength(0);
  expect(r.names().filter(name => name === 'tx')).toHaveLength(0);
});
