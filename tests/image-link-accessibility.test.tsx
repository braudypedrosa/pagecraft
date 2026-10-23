// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig } from './ui.setup';
import { nestedOwnerFixture } from './fixtures/nested-component-ownership';
import type { Control, Finding, Node as PcNode } from '../app/src/core/types';

const control = () => C.DEF.image.controls.content.find(item => item.k === 'label')!;
const findings = (code: string) => C.lint().filter((finding: Finding) => finding.code === code);

function image(): PcNode {
  return C.insert('image', null, 0)!;
}

function anchor(node: PcNode) {
  const html = C.renderNode(node, { edit: false });
  return new DOMParser().parseFromString(html, 'text/html').querySelector('a');
}

function rendered(node: PcNode, edit = false) {
  return new DOMParser().parseFromString(C.renderNode(node, { edit }), 'text/html');
}

beforeEach(() => C.blankProject('Image link labels'));

describe('linked decorative Image accessibility', () => {
  test('inspector offers Link label only for an image that is both linked and decorative', () => {
    const field = control();
    const node = image();
    expect(field).toMatchObject({ t: 'text', label: 'Link label' });
    expect(C.cmsBindable(node, field)).toBe(true);
    expect(field.when!(node)).toBe(false);

    node.props.decorative = 1;
    expect(field.when!(node)).toBe(false);
    node.props.link = 'https://example.test/details';
    expect(field.when!(node)).toBe(true);
    node.props.decorative = 0;
    expect(field.when!(node)).toBe(false);
  });

  test('inspector keeps guidance in the help tooltip', () => {
    const node = image();
    node.props.decorative = 1;
    node.props.link = 'https://example.test/details';
    const r = rig();
    act(() => r.draw(<Ctl n={node} c={control() as Control} />));

    expect(r.$('.note')).toBeNull();
    const help = r.$('.pc-help-trigger')!;
    const text = document.getElementById(help.getAttribute('aria-describedby')!)!;
    expect(text.hidden).toBe(true);
    expect(text.textContent).toContain('decorative image stays hidden');
    act(() => r.draw(null));
    r.host.remove();
  });

  test('the full Inspector reveals Link label after enabling Decorative and committing a URL', () => {
    const r = rig();
    const node = image();
    C.selSet([node.id]);
    C.state.ui.stab = 'content';
    r.host.id = 'right';
    act(() => r.draw(() => <Inspector />, 'right'));

    expect(r.$('input[placeholder="What the link opens"]')).toBeNull();
    act(() => r.click(r.$('button[aria-label="Decorative image"]')));
    expect(r.$('input[placeholder="What the link opens"]')).toBeNull();
    act(() => r.pick(r.$('select[data-field-part="type"]')!, 'url'));
    const url = r.$('input[aria-label="Custom or external URL"]')!;
    act(() => { r.type(url, '#details'); url.dispatchEvent(new FocusEvent('blur', { bubbles: true })); });
    expect(r.$('input[placeholder="What the link opens"]')).not.toBeNull();
    act(() => r.click(r.$('button[aria-label="Decorative image"]')));
    expect(r.$('input[placeholder="What the link opens"]')).toBeNull();
    act(() => r.click(r.$('button[aria-label="Decorative image"]')));
    expect(r.$('input[placeholder="What the link opens"]')).not.toBeNull();

    act(() => r.draw(null));
    r.host.remove();
  });

  test('renderer names a captioned decorative link and lets the explicit field override it', () => {
    const node = image();
    Object.assign(node.props, {
      src: 'photo.jpg', alt: 'Authored description', caption: 'Visible caption',
      link: 'https://example.test/details', decorative: 1,
    });

    for (const edit of [false, true]) {
      const doc = rendered(node, edit);
      const link = doc.querySelector('a')!;
      const captionId = link.getAttribute('aria-labelledby');
      expect(link.getAttribute('aria-label')).toBeNull();
      expect(captionId).toBeTruthy();
      expect(doc.getElementById(captionId!)?.textContent).toBe('Visible caption');
      expect(link.querySelector('img')?.getAttribute('alt')).toBe('');
    }
    node.props.label = '  Open details & pricing  ';
    expect(anchor(node)?.getAttribute('aria-label')).toBe('Open details & pricing');
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeNull();
    expect(C.renderNode(node, { edit: false })).toContain('alt=""');

    node.props.decorative = 0;
    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeNull();
    expect(C.renderNode(node, { edit: false })).toContain('alt="Authored description"');
  });

  test('caption fallback IDs avoid authored anchors across nested component copies', () => {
    const fixture = nestedOwnerFixture();
    fixture.leaf.node.type = 'image';
    fixture.leaf.node.props = {
      ...C.DEF.image.make().props,
      src: 'photo.jpg', decorative: 1, caption: 'Visible caption', link: '#details'
    };
    const legacyRoot = C.domIdOf(fixture.nested);
    const authored = fixture.node('nauthoredcaption', 'text');
    authored.adv.htmlId = legacyRoot + '-caption';
    authored.props.html = '<p>Authored anchor</p>';

    const parse = (nodes: PcNode[]) => new DOMParser().parseFromString(C.renderList(nodes, { edit: false }), 'text/html');
    let doc = parse([fixture.placement, fixture.duplicate, authored]);
    let ids = [...doc.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.getElementById(authored.adv.htmlId)?.textContent).toContain('Authored anchor');
    for (const link of doc.querySelectorAll<HTMLAnchorElement>('.pagecraft-figure a')) {
      const captionId = link.getAttribute('aria-labelledby')!;
      expect(captionId).toBeTruthy();
      expect(doc.querySelectorAll(`[id="${captionId}"]`)).toHaveLength(1);
    }

    fixture.leaf.node.props.label = 'Explicit image destination';
    doc = parse([fixture.placement, authored]);
    ids = [...doc.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(doc.querySelector('.pagecraft-figure')?.id).toBe(legacyRoot);
    expect(doc.querySelector('.pagecraft-figure a')?.getAttribute('aria-label')).toBe('Explicit image destination');
    expect(doc.querySelector('.pagecraft-figure a')?.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('lint requires a label only when a sourced decorative image emits a link', () => {
    const node = image();
    Object.assign(node.props, { src: 'photo.jpg', link: 'https://example.test/details', decorative: 1, w: '800', h: '600' });
    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeNull();
    expect(findings('image-link-no-label')).toHaveLength(1);
    expect(findings('image-link-no-label')[0].msg).toContain('Add a Link label');

    node.props.caption = 'Visible destination';
    expect(findings('image-link-no-label')).toHaveLength(0);
    node.props.caption = '  ';
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeNull();
    expect(findings('image-link-no-label')).toHaveLength(1);
    node.props.caption = '';
    node.props.label = 'Open details';
    expect(findings('image-link-no-label')).toHaveLength(0);
    node.props.label = '';
    node.props.link = '';
    expect(findings('image-link-no-label')).toHaveLength(0);
    node.props.link = 'https://example.test/details';
    node.props.decorative = 0;
    node.props.alt = 'Product details';
    expect(findings('image-link-no-label')).toHaveLength(0);
  });

  test('CMS-bound source, link, decorative flag and label drive rendering and review', () => {
    const node = image();
    const collection = C.collectionAdd('Products')!;
    const photo = C.fieldAdd(collection.id, 'Photo', 'image')!;
    const destination = C.fieldAdd(collection.id, 'Destination', 'link')!;
    const decorative = C.fieldAdd(collection.id, 'Decorative', 'bool')!;
    const label = C.fieldAdd(collection.id, 'Link label', 'text')!;
    const caption = C.fieldAdd(collection.id, 'Caption', 'text')!;
    const item = C.itemAdd(collection.id)!;
    C.itemSet(collection.id, item.id, photo.id, 'product.jpg');
    C.itemSet(collection.id, item.id, destination.id, 'https://example.test/product');
    C.itemSet(collection.id, item.id, decorative.id, '1');
    C.itemSet(collection.id, item.id, label.id, 'Open CMS product');
    C.itemSet(collection.id, item.id, caption.id, 'Visible CMS caption');
    C.srcSet(node, collection.id);
    C.bindSet(node, 'src', C.bindField(photo.id));
    C.bindSet(node, 'link', C.bindField(destination.id));
    C.bindSet(node, 'decorative', C.bindField(decorative.id));
    C.bindSet(node, 'label', C.bindField(label.id));
    C.bindSet(node, 'caption', C.bindField(caption.id));

    expect(control().when!(node)).toBe(true);
    expect(anchor(node)?.getAttribute('aria-label')).toBe('Open CMS product');
    expect(findings('image-link-no-label')).toHaveLength(0);

    C.itemSet(collection.id, item.id, label.id, '  ');
    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(findings('image-link-no-label')).toHaveLength(0);
    C.itemSet(collection.id, item.id, caption.id, '  ');
    expect(anchor(node)?.getAttribute('aria-labelledby')).toBeNull();
    expect(findings('image-link-no-label')).toHaveLength(1);
  });
});
