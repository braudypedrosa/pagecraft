// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { ItemsCtl } from '../app/src/ui/inspector/Lists';
import type { NavItem } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

/* A detail template exports one file per item and nothing at its own slug. */
function detailTemplate() {
  const col = C.collectionAdd('Journal')!;
  C.itemSet(col.id, C.itemAdd(col.id)!.id, 'title', 'First post');
  const template = C.pageDup(0)!;
  template.name = 'Post';
  C.pageSlugSet(C.state.pages.indexOf(template), 'post');
  template.collection = col.id;
  return template;
}
const options = (select: Element | null) =>
  [...(select as HTMLSelectElement).options].map(o => ({ value: o.value, disabled: o.disabled }));

describe('page link pickers and detail templates', () => {
  test('the inspector link picker never offers a detail template, and starts at the front page on one', () => {
    const template = detailTemplate();
    C.state.cur = C.state.pages.indexOf(template);
    const button = C.N('button', { text: 'Back', link: '' });
    template.tree = [button];
    const link = C.DEF.button.controls.content.find(control => control.k === 'link')!;
    const draw = () => r.draw(<Ctl n={button} c={link} />);
    draw();

    act(() => r.pick(r.$('select[data-field-part="type"]')!, 'page'));
    draw();
    expect(button.props.link).toBe('index.html');
    const pages = options(r.$('select[data-field-part="page"]'));
    expect(pages.map(o => o.value)).not.toContain('post');
    expect(pages.map(o => o.value)).toContain('index');

    /* A link saved before this rule names the template: shown, but not choosable again. */
    button.props.link = 'post.html';
    draw();
    expect(options(r.$('select[data-field-part="page"]'))[0]).toEqual({ value: 'post', disabled: true });
  });

  test('the menu destination picker never offers a detail template, and starts at the front page on one', () => {
    const template = detailTemplate();
    C.state.cur = C.state.pages.indexOf(template);
    const menu = C.N('nav', { items: [{ id: 'posts', label: 'Posts', href: 'https://example.com/' }] });
    template.tree = [menu];
    const items = C.DEF.nav.controls.content.find(control => control.t === 'items')!;
    const draw = () => r.draw(<ItemsCtl n={menu} c={items} />);
    draw();

    act(() => r.pick(r.$('select[aria-label^="Destination for"]')!, 'page'));
    draw();
    const row = (menu.props.items as NavItem[])[0];
    expect(row).toMatchObject({ href: 'index.html', pageId: C.state.pages[0].id });
    const pages = options(r.$('select[aria-label^="Destination page for"]'));
    expect(pages.map(o => o.value)).not.toContain(template.id);

    row.href = 'post.html';
    row.pageId = template.id;
    draw();
    expect(options(r.$('select[aria-label^="Destination page for"]'))[0])
      .toEqual({ value: template.id, disabled: true });
  });
});
