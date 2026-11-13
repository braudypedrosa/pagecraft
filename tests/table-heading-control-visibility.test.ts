import { describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Control, Node as PcNode } from '../app/src/core/types';

const headingStyleControls = C.DEF.table.controls.style.filter(
  (control: Control) => control.c === '--tbl-head-bg' || control.c === '--tbl-head-text',
);

const table = (head: 0 | 1, rowhead: 0 | 1) => C.N('table', {
  body: 'Plan|Cost\nFree|0',
  head,
  rowhead,
});

const controlsVisible = (node: PcNode) => headingStyleControls.every(
  (control: Control) => !control.when || control.when(node),
);

describe('Table heading style controls', () => {
  test.each([
    { head: 0, rowhead: 0, visible: false },
    { head: 1, rowhead: 0, visible: true },
    { head: 0, rowhead: 1, visible: true },
    { head: 1, rowhead: 1, visible: true },
  ] as const)('head=$head rowhead=$rowhead => visible=$visible', ({ head, rowhead, visible }) => {
    expect(headingStyleControls).toHaveLength(2);
    expect(controlsVisible(table(head, rowhead))).toBe(visible);
  });

  test.each([
    { head: 0, rowhead: 0, colHeaders: 0, rowHeaders: 0 },
    { head: 1, rowhead: 0, colHeaders: 2, rowHeaders: 0 },
    { head: 0, rowhead: 1, colHeaders: 0, rowHeaders: 2 },
    { head: 1, rowhead: 1, colHeaders: 2, rowHeaders: 1 },
  ] as const)('head=$head rowhead=$rowhead renders expected headers', ({ head, rowhead, colHeaders, rowHeaders }) => {
    const html = C.renderNode(table(head, rowhead), { edit: false });
    expect(html.match(/<th scope="col">/g) ?? []).toHaveLength(colHeaders);
    expect(html.match(/<th scope="row">/g) ?? []).toHaveLength(rowHeaders);
  });

  test('hiding and restoring heading controls preserves stored heading styles', () => {
    const node = table(1, 1);
    node.css.d['--tbl-head-bg'] = '#123456';
    node.css.d['--tbl-head-text'] = '#abcdef';

    node.props.head = 0;
    node.props.rowhead = 0;
    expect(controlsVisible(node)).toBe(false);
    expect(node.css.d['--tbl-head-bg']).toBe('#123456');
    expect(node.css.d['--tbl-head-text']).toBe('#abcdef');
    expect(C.renderNode(node, { edit: false })).not.toContain('<th');

    node.props.rowhead = 1;
    expect(controlsVisible(node)).toBe(true);
    expect(node.css.d['--tbl-head-bg']).toBe('#123456');
    expect(node.css.d['--tbl-head-text']).toBe('#abcdef');
    expect(C.renderNode(node, { edit: false })).toContain('<th scope="row">');

    node.props.rowhead = 0;
    node.props.head = 1;
    expect(C.renderNode(node, { edit: false })).toContain('<th scope="col">');
  });
});
