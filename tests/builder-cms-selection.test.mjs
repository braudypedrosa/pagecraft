import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const builder = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });

const between = (start, end) => builder.slice(builder.indexOf(start), builder.indexOf(end, builder.indexOf(start)));

function harness() {
  const dom = new JSDOM('<body><iframe id="canvas"></iframe></body>', {
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  windows.push(dom);
  const w = dom.window;
  const d = w.document;
  const frame = d.querySelector('iframe');
  const cd = frame.contentDocument;
  cd.body.innerHTML = `<div id="s-root">
    <div id="card" data-id="card" data-t="column" data-cms-col="places" data-cms-item="courtyard">
      <h2 id="heading" data-id="heading" data-t="heading" data-cms-col="places" data-cms-item="courtyard">Courtyard</h2>
    </div>
    <div id="card-community" data-id="card" data-t="column" data-cms-col="places" data-cms-item="community">
      <h2 id="heading-community" data-id="heading" data-t="heading" data-cms-col="places" data-cms-item="community">Community Garden</h2>
    </div>
  </div><div id="s-hud"></div>`;
  const courtyard = cd.querySelector('h2[data-cms-item="courtyard"]');
  const community = cd.querySelector('h2[data-cms-item="community"]');
  courtyard.getBoundingClientRect = () => ({ left: 10, top: 20, right: 110, bottom: 50, width: 100, height: 30 });
  community.getBoundingClientRect = () => ({ left: 10, top: 120, right: 110, bottom: 150, width: 100, height: 30 });
  courtyard.parentElement.getBoundingClientRect = () => ({ left: 5, top: 10, right: 115, bottom: 60, width: 110, height: 50 });
  community.parentElement.getBoundingClientRect = () => ({ left: 5, top: 110, right: 115, bottom: 160, width: 110, height: 50 });

  // Raw order differs from the filtered/sorted canvas: item zero is the second visible row,
  // and the omitted middle row proves a rendered position cannot be used as the source index.
  const collection = {
    id: 'places',
    items: [
      { id: 'community', values: { title: 'Community Garden' } },
      { id: 'hidden', values: { title: 'Hidden draft' } },
      { id: 'courtyard', values: { title: 'Courtyard' } },
    ],
  };
  const selected = [];
  const card = { id: 'card', type: 'column', children: [] };
  const node = { id: 'heading', type: 'heading' };
  card.children.push(node);
  const locations = {
    heading: { node, parent: card },
    card: { node: card, parent: null },
  };
  Object.assign(w, {
    cdoc: cd,
    cwin: frame.contentWindow,
    state: { ui: { item: {}, sel: 'heading' }, pages: [{ tree: [card] }], meta: {} },
    findCollection: id => id === collection.id ? collection : null,
    $: selector => d.querySelector(selector),
    $$: (selector, root = d) => Array.from(root.querySelectorAll(selector)),
    closeCtx: () => {},
    escCtx: () => {},
    editing: { on: false },
    exitEdit: () => {},
    startColResize: () => {},
    setMode: () => {},
    select: (id, options) => selected.push({ id, options, index: w.state.ui.item.places }),
    zoomK: 1,
    locate: id => locations[id] || null,
    DEF: { heading: { label: 'Heading' }, column: { label: 'Column' } },
    selIds: () => w.state.ui.sel ? [w.state.ui.sel] : [],
    tree: () => [node],
    kindOf: () => 'Heading',
    nameOf: () => 'Heading',
    esc: String,
    svg: () => '',
    gripsHtml: () => '',
    PC_UI: { selectionToolbarTop: rect => rect.top },
  });

  w.eval(between('let canvasSelectionContext = null;', 'function activateHudButton'));
  w.eval(between('function bindCanvas()', '/* =============================================================== drag/drop */'));
  w.bindCanvas();
  return { w, d, cd, collection, courtyard, community, selected, node, card, locations };
}

test('canvas pointer selection keeps the clicked filtered and sorted CMS item as UI-only context', () => {
  const { w, cd, collection, courtyard, community, selected } = harness();
  const sourceBefore = JSON.stringify({ pages: w.state.pages, meta: w.state.meta, collection });

  courtyard.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(selected.at(-1)).toEqual({ id: 'heading', options: { add: false, keepCanvasContext: true }, index: 2 });
  expect(w.selectedCanvasElement('heading')).toBe(courtyard);

  community.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(selected.at(-1)).toEqual({ id: 'heading', options: { add: false, keepCanvasContext: true }, index: 0 });
  expect(w.selectedCanvasElement('heading')).toBe(community);
  expect(JSON.stringify({ pages: w.state.pages, meta: w.state.meta, collection })).toBe(sourceBefore);
  expect(cd.querySelector('[data-cms-item="hidden"]')).toBeNull();
});

test('outline, HUD and reveal stay on the clicked copy and stale items fall back safely', () => {
  const { w, cd, collection, courtyard, community } = harness();
  community.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));

  w.eval(between('function positionHud()', '/* A grip per gutter'));
  Object.assign(w, {
    selSet: ids => { w.state.ui.sel = ids[0] || null; },
    selToggle: () => {},
    selRange: () => [],
    renderRight: () => {},
    renderModebar: () => {},
    renderLayers: () => {},
    drawBlocks: () => {},
  });
  w.eval(between('function revealSelection(force = false)', '/* cheap selection repaint'));
  w.eval(between('function paintSel()', '/* ---- element clipboard identity'));
  w.eval(between('function selectsCanvasAncestor(id)', '// Panel changes can reflow the canvas.'));
  const communityScroll = vi.fn();
  const courtyardScroll = vi.fn();
  community.parentElement.scrollIntoView = communityScroll;
  courtyard.parentElement.scrollIntoView = courtyardScroll;

  w.select('card');
  expect(w.state.ui.sel).toBe('card');
  w.paintSel();
  expect(community.parentElement.hasAttribute('data-sel')).toBe(true);
  expect(courtyard.parentElement.hasAttribute('data-sel')).toBe(false);
  expect(cd.querySelector('#s-hud .frame').style.top).toBe('110px');
  w.revealSelection(true);
  expect(communityScroll).toHaveBeenCalledOnce();
  expect(courtyardScroll).not.toHaveBeenCalled();

  collection.items = collection.items.filter(item => item.id !== 'community');
  expect(() => w.selectedCanvasElement('card')).not.toThrow();
  expect(w.selectedCanvasElement('card')).toBe(courtyard.parentElement);
  expect(w.state.ui.item.places).toBe(collection.items.indexOf(collection.items.find(item => item.id === 'courtyard')));
});

test('source change Undo and Redo reconcile stale item context to the selected visible copy', () => {
  const { w, cd, collection, courtyard, node } = harness();
  const scalar = {
    id: 'scalar',
    items: [
      { id: 'first-scalar', values: { photo: 'Fallback image' } },
      { id: 'second-scalar', values: { photo: 'Second image' } },
    ],
  };
  w.findCollection = id => id === collection.id ? collection : id === scalar.id ? scalar : null;
  w.state.ui.item.scalar = 1;
  node.props = { source: collection.id, image: 'photo' };
  const history = { undo: ['before source change'], redo: [] };

  const rows = (col, ids) => {
    cd.querySelector('#s-root').innerHTML = ids.map((itemId, index) =>
      `<div id="card${index ? '-' + index : ''}" data-id="card" data-t="column" data-cms-col="${col.id}" data-cms-item="${itemId}">`
      + `<h2 id="heading${index ? '-' + index : ''}" data-id="heading" data-t="heading" data-cms-col="${col.id}" data-cms-item="${itemId}">${itemId}</h2></div>`
    ).join('');
  };
  const unchangedByReconcile = () => JSON.stringify({
    pages: w.state.pages,
    meta: w.state.meta,
    collections: [collection, scalar],
    history,
    props: node.props,
  });

  courtyard.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(w.state.ui.item.places).toBe(2);

  // Source change and click on its first fallback establish a valid context in another
  // collection while retaining the previous collection's old preview index.
  node.props = { source: scalar.id, image: 'photo' };
  rows(scalar, ['first-scalar', 'second-scalar']);
  cd.querySelector('[data-id="heading"]').dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(w.state.ui.item).toMatchObject({ places: 2, scalar: 0 });

  // Undo restores the original source/bindings. The scalar identity still exists, but it no
  // longer applies to this branch; reconciliation must adopt the first visible Places copy.
  node.props = { source: collection.id, image: 'photo' };
  rows(collection, ['community', 'courtyard']);
  const beforeUndoReconcile = unchangedByReconcile();
  const undoVisible = w.reconcileCanvasSelectionContext('heading');
  expect(undoVisible.dataset.cmsItem).toBe('community');
  expect(w.state.ui.item.places).toBe(0);
  expect(unchangedByReconcile()).toBe(beforeUndoReconcile);

  // Redo paints Scalar again. Its former context was replaced during Undo, so the same rule
  // chooses a visible Scalar copy and updates its bound-control index without adding history.
  node.props = { source: scalar.id, image: 'photo' };
  rows(scalar, ['first-scalar', 'second-scalar']);
  const beforeRedoReconcile = unchangedByReconcile();
  const redoVisible = w.reconcileCanvasSelectionContext('heading');
  expect(redoVisible.dataset.cmsItem).toBe('first-scalar');
  expect(w.state.ui.item.scalar).toBe(0);
  expect(unchangedByReconcile()).toBe(beforeRedoReconcile);
});

test('a nested repeated click validates and records every collection context in its ancestor chain', () => {
  const { w, cd, collection, locations } = harness();
  const outerSecond = { id: 'outer-second', values: {} };
  collection.items.push(outerSecond);
  const inner = { id: 'details', items: [{ id: 'inner-zero', values: {} }, { id: 'inner-one', values: {} }] };
  w.findCollection = id => id === collection.id ? collection : id === inner.id ? inner : null;
  const outerNode = { id: 'outer-card', type: 'column', children: [] };
  const innerNode = { id: 'inner-heading', type: 'heading' };
  outerNode.children.push(innerNode);
  locations['outer-card'] = { node: outerNode, parent: null };
  locations['inner-heading'] = { node: innerNode, parent: outerNode };

  const outer = cd.createElement('div');
  outer.dataset.id = 'outer-card';
  outer.dataset.t = 'column';
  outer.dataset.cmsCol = collection.id;
  outer.dataset.cmsItem = outerSecond.id;
  const hit = cd.createElement('h2');
  hit.dataset.id = 'inner-heading';
  hit.dataset.t = 'heading';
  hit.dataset.cmsCol = inner.id;
  hit.dataset.cmsItem = inner.items[0].id;
  outer.append(hit);
  cd.querySelector('#s-root').append(outer);

  hit.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(w.state.ui.item).toMatchObject({
    [collection.id]: collection.items.indexOf(outerSecond),
    [inner.id]: 0,
  });
  expect(w.selectedCanvasElement('inner-heading')).toBe(hit);
  expect(w.selectedCanvasElement('outer-card')).toBe(outer);

  const sameOuter = cd.createElement('div');
  sameOuter.dataset.id = 'same-outer';
  sameOuter.dataset.t = 'column';
  sameOuter.dataset.cmsCol = collection.id;
  sameOuter.dataset.cmsItem = outerSecond.id;
  const sameHit = cd.createElement('h2');
  sameHit.dataset.id = 'same-inner';
  sameHit.dataset.t = 'heading';
  sameHit.dataset.cmsCol = collection.id;
  sameHit.dataset.cmsItem = collection.items[0].id;
  sameOuter.append(sameHit);
  cd.querySelector('#s-root').append(sameOuter);
  locations['same-outer'] = { node: { id: 'same-outer', type: 'column' }, parent: null };
  locations['same-inner'] = { node: { id: 'same-inner', type: 'heading' }, parent: locations['same-outer'].node };
  sameHit.dispatchEvent(new w.cwin.MouseEvent('pointerdown', { bubbles: true }));
  expect(w.state.ui.item[collection.id]).toBe(0, 'the nearest row wins when nested contexts share a collection');
});
