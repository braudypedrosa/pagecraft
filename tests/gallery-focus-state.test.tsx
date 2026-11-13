// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const gallery = (lightbox = 1) => C.N('gallery', {
  lightbox,
  items: [{ src: 'https://example.test/gallery.webp', alt: 'Gallery image' }]
});

const stateButton = (label: string) => r.$$('.statepick button')
  .find(button => button.textContent?.trim() === label) || null;

test('Gallery node Focus CSS follows its keyboard-focused frame at every breakpoint', () => {
  const n = gallery();
  n.st = { focus: {
    d: { 'background-color': '#bbccdd' },
    t: {},
    m: { outline: '4px solid #112233' }
  } };

  const selector = `.${C.nodeClass(n)}`;
  const css = C.treeCss([[n]], false);
  expect(css).toContain(`${selector}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible){background-color:#bbccdd;}`);
  expect(css).toContain(`${selector}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible){outline:4px solid #112233;}`);
  expect(css).not.toContain(`${selector}:focus-visible{background-color:#bbccdd;}`);
  expect(css).not.toContain(`${selector}:focus-within`);

  const html = C.renderNode(n, { edit: false });
  expect(html).toContain('class="pagecraft-gallery-frame"');
  expect(html).not.toMatch(new RegExp(`class="[^"]*${C.nodeClass(n)}[^"]*"[^>]*tabindex`));
});

test('a reusable Focus class reaches Gallery frames while its generic selector remains unchanged', () => {
  const n = gallery();
  const classId = C.classAdd('Keyboard surface', { d: {} });
  const reusable = C.findClass(classId)!;
  reusable.st = { focus: {
    d: { color: '#123456' },
    t: { 'border-color': '#abcdef' },
    m: {}
  } };
  C.classApply(n, classId);
  n.st = { hover: { d: { color: '#654321' }, t: {}, m: {} } };

  const css = C.treeCss([[n]], false);
  const classGalleryFocus = `.c-${classId}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible){color:#123456;}`;
  const nodeHover = `.${C.nodeClass(n)}:hover{color:#654321;}`;
  expect(css).toContain(`.c-${classId}:focus-visible{color:#123456;}`);
  expect(css).toContain(classGalleryFocus);
  expect(css).toContain(`.c-${classId}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible){border-color:#abcdef;}`);
  expect(css).toContain(nodeHover);
  expect(css.indexOf(classGalleryFocus)).toBeLessThan(css.indexOf(nodeHover));
  expect(css).not.toContain(`.c-${classId}:focus-within`);
});

test('Inspector removes unavailable Gallery Focus without discarding authored node or class styles', () => {
  const n = C.insert('gallery', null, 0)!;
  n.props.lightbox = 0;
  n.st = { focus: { d: { 'background-color': '#bbccdd' }, t: {}, m: {} } };
  const classId = C.classAdd('Gallery focus', { d: {} });
  C.findClass(classId)!.st = { focus: { d: { color: '#123456' }, t: {}, m: {} } };
  C.classApply(n, classId);
  C.selSet([n.id]);
  C.state.ui.stab = 'style';
  C.state.ui.st = 'focus';
  C.state.ui.target = classId;
  const authoredNodeFocus = JSON.stringify(n.st.focus);
  const authoredClassFocus = JSON.stringify(C.findClass(classId)!.st!.focus);

  r.draw(() => <Inspector />, 'right');
  expect(C.state.ui.st).toBe('');
  expect(stateButton('Focus')).toBeNull();
  expect(JSON.stringify(n.st.focus)).toBe(authoredNodeFocus);
  expect(JSON.stringify(C.findClass(classId)!.st!.focus)).toBe(authoredClassFocus);

  n.props.lightbox = 1;
  r.draw(() => <Inspector />, 'right');
  expect(stateButton('Focus')).not.toBeNull();
  expect(C.state.ui.st).toBe('');
  expect(JSON.stringify(n.st.focus)).toBe(authoredNodeFocus);
  expect(JSON.stringify(C.findClass(classId)!.st!.focus)).toBe(authoredClassFocus);

  const heading = C.insert('heading', null, 0)!;
  C.selSet([heading.id]);
  r.draw(() => <Inspector />, 'right');
  expect(stateButton('Focus')).not.toBeNull();
});
