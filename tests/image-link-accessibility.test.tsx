// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig } from './ui.setup';
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

  test('renderer labels only a linked decorative image from the explicit field', () => {
    const node = image();
    Object.assign(node.props, {
      src: 'photo.jpg', alt: 'Authored description', caption: 'Visible caption',
      link: 'https://example.test/details', decorative: 1,
    });

    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    node.props.label = '  Open details & pricing  ';
    expect(anchor(node)?.getAttribute('aria-label')).toBe('Open details & pricing');
    expect(C.renderNode(node, { edit: false })).toContain('alt=""');

    node.props.decorative = 0;
    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    expect(C.renderNode(node, { edit: false })).toContain('alt="Authored description"');
  });

  test('lint requires a label only when a sourced decorative image emits a link', () => {
    const node = image();
    Object.assign(node.props, { src: 'photo.jpg', link: 'https://example.test/details', decorative: 1, w: '800', h: '600' });
    expect(findings('image-link-no-label')).toHaveLength(1);
    expect(findings('image-link-no-label')[0].msg).toContain('Add a Link label');

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
    const item = C.itemAdd(collection.id)!;
    C.itemSet(collection.id, item.id, photo.id, 'product.jpg');
    C.itemSet(collection.id, item.id, destination.id, 'https://example.test/product');
    C.itemSet(collection.id, item.id, decorative.id, '1');
    C.itemSet(collection.id, item.id, label.id, 'Open CMS product');
    C.srcSet(node, collection.id);
    C.bindSet(node, 'src', C.bindField(photo.id));
    C.bindSet(node, 'link', C.bindField(destination.id));
    C.bindSet(node, 'decorative', C.bindField(decorative.id));
    C.bindSet(node, 'label', C.bindField(label.id));

    expect(control().when!(node)).toBe(true);
    expect(anchor(node)?.getAttribute('aria-label')).toBe('Open CMS product');
    expect(findings('image-link-no-label')).toHaveLength(0);

    C.itemSet(collection.id, item.id, label.id, '  ');
    expect(anchor(node)?.getAttribute('aria-label')).toBeNull();
    expect(findings('image-link-no-label')).toHaveLength(1);
  });
});
