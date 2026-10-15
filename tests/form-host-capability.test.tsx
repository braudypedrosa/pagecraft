// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;

function form(mode: 'external' | 'wordpress' = 'external') {
  const n = C.insert('form', null, 0)!;
  n.props.mode = mode;
  C.state.ui.sel = n.id;
  C.state.ui.open['form:Submission'] = true;
  r.draw(() => <Inspector />, 'right');
  return n;
}

beforeEach(() => {
  r = rig({ dynamicContentProvider: 'wordpress' });
  C.setCloudFormEndpoint('');
});

afterEach(() => {
  C.setCloudFormEndpoint('');
  act(() => r.draw(null));
  r.host.remove();
});

test('unsupported hosts offer only external HTTPS for a fresh form', () => {
  form();
  const handling = r.$('select') as HTMLSelectElement;
  expect(handling.value).toBe('external');
  expect([...handling.options].map(option => [option.value, option.textContent])).toEqual([
    ['external', 'External HTTPS endpoint']
  ]);
  expect(r.$('[role="alert"]')).toBeNull();
});

test('legacy managed forms remain stored until explicit conversion', () => {
  const n = form('wordpress');
  n.props.action = 'https://forms.example.test/inquiry';
  n.props.method = 'get';
  r.draw(() => <Inspector />, 'right');
  expect(n.props.mode).toBe('wordpress');
  expect(r.host.textContent).toContain('WordPress-managed submissions are not available in this host.');
  expect(r.$('select option[value="wordpress"]')).toBeNull();
  expect(r.host.textContent).not.toContain('Where submissions go');

  const convert = r.$$('button').find(button => button.textContent?.trim() === 'Use external HTTPS')!;
  r.click(convert);

  expect(n.props.mode).toBe('external');
  expect(n.props.action).toBe('https://forms.example.test/inquiry');
  expect(n.props.method).toBe('get');
  expect(r.$('[role="alert"]')).toBeNull();
  expect(r.host.textContent).toContain('Where submissions go');
  expect(r.host.textContent).toContain('Method');
  expect((r.$('select') as HTMLSelectElement).value).toBe('external');
});

test('an explicitly capable future host retains the managed choice', () => {
  act(() => r.draw(null));
  r.host.remove();
  r = rig({ dynamicContentProvider: 'wordpress', managedForms: true });
  form();
  expect(r.$('select option[value="wordpress"]')?.textContent).toBe('WordPress managed');
  expect(r.$('[role="alert"]')).toBeNull();
});
