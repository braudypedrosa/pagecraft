import { test, expect } from 'vitest';
import { blankDoc, renderSite } from '../src/render';
import { cmsDocumentErrors } from '../src/cms-document';
import {
  validateCmsEntry,
  cmsBoolean,
} from '../../app/src/core/cms-validation';
import { contentOnly } from '../src/content';
import * as C from '../../app/src/core/index';
const fixture = () => {
  const doc = blankDoc('CMS QA');
  doc.meta.collections = [
    {
      id: 'cabins',
      name: 'Cabins',
      slug: 'cabins',
      detail: '',
      fields: [
        { id: 'title', name: 'Title', type: 'text', required: 1 },
        { id: 'enabled', name: 'Enabled', type: 'bool' },
        { id: 'photo', name: 'Cover', type: 'image' },
        { id: 'body', name: 'Body', type: 'rich' },
        { id: 'kind', name: 'Kind', type: 'option', opts: 'Forest,Lake' },
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'capacity', name: 'Capacity', type: 'number' },
        { id: 'link', name: 'Link', type: 'link' },
        { id: 'related', name: 'Related', type: 'ref', ref: 'cabins' },
      ],
      items: [{ id: 'a', slug: 'a', values: { title: 'A' } }],
    },
  ];
  return doc;
};
test('typed CMS validation covers safe values, false booleans and owned media', () => {
  const doc = fixture(),
    col = doc.meta.collections![0],
    item = {
      id: 'b',
      slug: 'b',
      values: {
        title: 'B',
        enabled: '0',
        photo: 'asset:owned',
        body: '<p>Hello <strong>world</strong></p>',
        kind: 'Lake',
        date: '2026-09-09',
        capacity: '2',
        link: '/cabins/a',
        related: 'a',
      },
    };
  expect(validateCmsEntry(doc, col, item, new Set(['owned']))).toEqual({});
  expect(cmsBoolean('0')).toBe(false);
  for (const [key, value] of Object.entries({
    enabled: 'maybe',
    photo: 'asset:foreign',
    body: '<img src=x onerror=alert(1)>',
    kind: 'Other',
    date: '2026-02-30',
    capacity: 'NaN',
    link: 'javascript:alert(1)',
    related: 'missing',
  }))
    expect(
      validateCmsEntry(
        doc,
        col,
        { ...item, values: { ...item.values, [key]: value } },
        new Set(['owned']),
      )[key],
    ).toBeTruthy();
});
test('changed CMS entries validate without blocking untouched legacy entries', () => {
  const before = fixture();
  before.meta.collections![0].items[0].values.kind = 'Legacy';
  const after = structuredClone(before);
  after.meta.collections![0].items.push({
    id: 'b',
    slug: 'b',
    draft: 1,
    values: { title: 'B' },
  });
  expect(cmsDocumentErrors(before, after, new Set())).toEqual([]);
  expect(contentOnly(before, after).ok).toBe(true);
  after.meta.collections![0].items[1].values.body = '<script>alert(1)</script>';
  expect(cmsDocumentErrors(before, after, new Set()).length).toBeGreaterThan(0);
});
test('schema and path constraints reject unsafe changes', () => {
  const before = fixture(),
    after = structuredClone(before);
  after.meta.collections![0].fields[0].type = 'number';
  expect(cmsDocumentErrors(before, after, new Set())).toContain(
    'Title: populated fields cannot change type.',
  );
  expect(contentOnly(before, after).ok).toBe(false);
  const col = before.meta.collections![0];
  expect(
    validateCmsEntry(
      before,
      col,
      { id: 'b', slug: 'a', values: { title: 'B' } },
      new Set(),
    )._slug,
  ).toBeTruthy();
  expect(
    validateCmsEntry(
      before,
      col,
      { id: 'b', slug: 'admin', values: { title: 'B' } },
      new Set(),
    )._slug,
  ).toBeTruthy();
});
test('CMS sliders render bound entries and detail pages, excluding drafts', () => {
  const doc = fixture(),
    col = doc.meta.collections![0];
  col.items.push({
    id: 'hidden',
    slug: 'hidden',
    draft: 1,
    values: { title: 'Secret cabin' },
  });
  C.restore(doc);
  const list = C.N('list');
  list.src = col.id;
  list.props.collectionLayout = 'slider';
  const heading = C.N('heading');
  heading.bind = { text: { src: 'field', path: 'title' } };
  list.children.push(heading);
  doc.pages[0].tree = [list];
  doc.pages.push({
    id: 'detail',
    name: 'Cabin detail',
    slug: 'detail',
    collection: col.id,
    title: '',
    desc: '',
    tree: [heading],
  });
  const out = renderSite(doc);
  expect(out.files.has('cabins/a.html')).toBe(true);
  expect(out.files.has('cabins/hidden.html')).toBe(false);
  expect(out.files.get('index.html')).toContain('data-slider');
  expect(out.files.get('index.html')).not.toContain('Secret cabin');
});

test('native CMS document round-trip retains bindings; portable v1 rejects rather than flattening', async () => {
  const { createSitePackage } = await import('../src/portable-packages');
  const doc = fixture();
  C.restore(doc);
  expect(C.migrate(JSON.parse(JSON.stringify(doc)))?.meta.collections).toEqual(
    doc.meta.collections,
  );
  expect(() =>
    createSitePackage({
      document: doc,
      assets: [],
      provenance: {
        format: 'pagecraft.provenance.v1',
        origin: 'pagecraft-cloud',
        sourceId: 'cms-qa',
        sourceVersion: 1,
        exportedBy: 'owner',
      },
    }),
  ).toThrow(/CMS/);
});

test('publication review recognizes generated detail URLs and excludes drafts', () => {
 const doc = fixture();
 doc.pages.push({...structuredClone(doc.pages[0]), id:'detail', slug:'detail', collection:'cabins', tree:[]});
 const link = C.N('button'); link.props.link = 'cabins/a.html';
 doc.pages[0].tree = [link]; C.restore(doc);
 expect(C.lint().filter(f=>f.code==='dead-link')).toHaveLength(0);
 doc.meta.collections![0].items[0].draft = 1; C.restore(doc);
 expect(C.lint().filter(f=>f.code==='dead-link')).toHaveLength(1);
});
