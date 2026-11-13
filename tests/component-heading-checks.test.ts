import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.blankProject('Component heading checks');
  C.state.header = [];
  C.state.footer = [];
  C.state.pages[0].tree = [];
  C.state.meta.components = [];
});

function headingComponent(nested = false) {
  const heading = C.N('heading', { level: 'h1', text: 'One page subject' });
  const root = nested ? C.N('box', {}, {}, [heading]) : heading;
  C.page().tree.push(root);
  const id = C.componentFromNode(root.id, 'Page title')!;
  return { root, id };
}
const renderedH1s = () => (C.buildPage(C.page()).match(/<h1\b/g) || []).length;
const h1Warnings = () => C.lint().filter(f => ['many-h1', 'no-h1'].includes(f.code));

for (const nested of [false, true]) {
  test(`one ${nested ? 'nested' : 'root'} component heading is counted once`, () => {
    headingComponent(nested);
    expect(renderedH1s()).toBe(1);
    expect(h1Warnings()).toEqual([]);
  });
}

test('separate component instances remain separate rendered headings', () => {
  const { id } = headingComponent();
  const instance = C.N('heading');
  instance.use = id;
  C.page().tree.push(instance);
  expect(renderedH1s()).toBe(2);
  expect(h1Warnings()).toHaveLength(1);
  expect(h1Warnings()[0].msg).toContain('2 H1 headings');
});

test('changing the component tag does not leave its old instance tag in heading checks', () => {
  const { id } = headingComponent();
  C.findComponent(id)!.node.props.level = 'h2';
  expect(renderedH1s()).toBe(0);
  expect(h1Warnings().map(f => f.code)).toEqual(['no-h1']);
});
