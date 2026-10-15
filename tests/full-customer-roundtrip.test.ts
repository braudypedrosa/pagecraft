import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Doc, Field, Node as PcNode, PropKind } from '../app/src/core/types';
import { renderSite } from '../server/src/render';

const jsonRoundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const reset = () => {
  C.blankProject('Full customer round trip');
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.meta.blocks = [];
  C.state.meta.components = [];
  C.state.meta.collections = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
};

const nodeTypes = (doc: Doc) => {
  const found = new Set<string>();
  const walk = (list: PcNode[]) => C.eachNode(list, node => found.add(node.type));
  walk(doc.header);
  walk(doc.footer);
  doc.pages.forEach(page => walk(page.tree));
  (doc.meta.components || []).forEach(component => walk([component.node]));
  return found;
};

function fullDocument(): { doc: Doc; componentId: string; variantId: string } {
  reset();
  const tokens = C.ensureTokens();
  tokens.colors.push({ id: 'roundtrip-accent', name: 'Roundtrip accent', value: '#7c3aed' });
  const textStyle = C.styleAdd('Roundtrip display');
  C.findStyle(textStyle)!.css = {
    d: { 'font-size': '48px', color: 'var(--c-roundtrip-accent)' },
    t: { 'font-size': '38px' },
    m: { 'font-size': '30px' },
  };
  const classId = C.classAdd('Roundtrip interactive', {
    d: { 'border-radius': '17px', opacity: '.91' },
    t: { 'border-radius': '13px' },
    m: { 'border-radius': '9px' },
  });
  C.findClass(classId)!.st = {
    hover: { d: { transform: 'translateY(-3px)' }, t: { opacity: '.88' }, m: { opacity: '.77' } },
    focus: { d: { 'outline-width': '3px' }, t: { 'outline-offset': '4px' }, m: { 'outline-offset': '6px' } },
  };

  const authors = C.collectionAdd('Authors');
  const author = C.itemAdd(authors.id)!;
  C.itemSet(authors.id, author.id, C.titleField(authors)!.id, 'Ada Roundtrip');

  const articles = C.collectionAdd('Articles');
  const fields = {
    text: C.titleField(articles)!,
    rich: C.fieldAdd(articles.id, 'Body', 'rich')!,
    image: C.fieldAdd(articles.id, 'Cover', 'image')!,
    link: C.fieldAdd(articles.id, 'Destination', 'link')!,
    number: C.fieldAdd(articles.id, 'Score', 'number')!,
    date: C.fieldAdd(articles.id, 'Published', 'date')!,
    option: C.fieldAdd(articles.id, 'Kind', 'option')!,
    bool: C.fieldAdd(articles.id, 'Featured', 'bool')!,
    ref: C.fieldAdd(articles.id, 'Author', 'ref')!,
  };
  fields.option.opts = 'Guide,News';
  fields.date.required = 1;
  fields.ref.ref = authors.id;
  const article = C.itemAdd(articles.id)!;
  const values: Record<keyof typeof fields, string> = {
    text: 'Roundtrip article',
    rich: '<p>Rich <strong>roundtrip</strong> body.</p>',
    image: 'https://example.test/roundtrip.webp',
    link: 'https://example.test/read',
    number: '42.5',
    date: '2026-10-14',
    option: 'Guide',
    bool: '1',
    ref: author.id,
  };
  for (const [kind, value] of Object.entries(values)) {
    C.itemSet(articles.id, article.id, fields[kind as keyof typeof fields].id, value);
  }

  const componentRoot = C.N('box', { layout: 'grid', tag: 'article' }, {
    d: { display: 'grid', gap: '18px' }, t: { gap: '14px' }, m: { gap: '10px' },
  }, [
    C.N('heading', { text: 'Default component title', level: 'h2' }),
    C.N('text', { html: '<p>Default component body.</p>' }),
    C.N('image', { src: 'https://example.test/default.webp', alt: 'Default component image' }),
    C.N('button', { text: 'Default component link', link: 'https://example.test/default' }),
    C.N('icon', { name: 'check', label: 'Default component icon' }),
  ]);
  const propertyKinds: Array<[string, PropKind, string]> = [
    ['title', 'text', 'Default component title'],
    ['body', 'rich', '<p>Default component body.</p>'],
    ['photo', 'img', 'https://example.test/default.webp'],
    ['destination', 'link', 'https://example.test/default'],
    ['tone', 'color', '#111111'],
    ['layout', 'select', 'quiet'],
    ['featured', 'bool', ''],
    ['glyph', 'icon', 'check'],
  ];
  const componentId = 'roundtrip-card';
  C.state.meta.components!.push({
    id: componentId,
    name: 'Roundtrip card',
    node: componentRoot,
    props: propertyKinds.map(([k, t, def]) => ({
      k, t, def, label: k[0].toUpperCase() + k.slice(1),
      ...(t === 'select' ? { opts: [['quiet', 'Quiet'], ['loud', 'Loud']] as [string, string][] } : {}),
    })),
    variants: [{
      id: 'featured-card', name: 'Featured card',
      values: { title: 'Variant title', tone: '#7c3aed', layout: 'loud', featured: '1', glyph: 'star' },
    }],
  });
  C.bindSet(componentRoot.children[0], 'text', { src: 'prop', path: 'title' });
  C.bindSet(componentRoot.children[1], 'html', { src: 'prop', path: 'body' });
  C.bindSet(componentRoot.children[2], 'src', { src: 'prop', path: 'photo' });
  C.bindSet(componentRoot.children[3], 'link', { src: 'prop', path: 'destination' });
  C.bindSet(componentRoot.children[4], 'name', { src: 'prop', path: 'glyph' });

  const componentInstance = C.N('box', { layout: 'grid' });
  componentInstance.use = componentId;
  componentInstance.variant = 'featured-card';
  componentInstance.vals = {
    title: 'Instance roundtrip title',
    body: '<p>Instance <em>roundtrip</em> body.</p>',
    photo: 'https://example.test/instance.webp',
    destination: 'https://example.test/instance',
  };

  const nav = C.N('nav', {
    aria: 'Roundtrip navigation', mobileMenu: 'fullscreen', collapse: '900px',
    items: [
      { id: 'home', label: 'Home', href: 'index.html', cls: 'top-link' },
      { id: 'about', parentId: 'home', label: 'About', href: 'about.html', target: '_blank', rel: 'nofollow' },
    ],
  });
  const mobileMenu = C.ensureMobileMenuComponent(nav);
  mobileMenu.node.adv.htmlId = 'roundtrip-mobile-menu';
  C.state.header = [C.N('section', { tag: 'header' }, {}, [C.cols(1, [[nav]])])];
  const footerInstance = C.N('box');
  footerInstance.use = componentId;
  footerInstance.vals = { title: 'Footer component title' };
  C.state.footer = [C.N('section', { tag: 'footer' }, {}, [C.cols(1, [[footerInstance]])])];

  const heading = C.N('heading', { text: 'Roundtrip heading', level: 'h1', ts: textStyle });
  heading.cls = [classId];
  heading.css = {
    d: { 'margin-top': '31px', color: '#123456' },
    t: { 'margin-top': '23px', color: '#234567' },
    m: { 'margin-top': '17px', color: '#345678' },
  };
  heading.st = {
    hover: { d: { color: '#456789' }, t: { color: '#56789a' }, m: { color: '#6789ab' } },
    focus: { d: { 'outline-color': '#789abc' }, t: { 'outline-color': '#89abcd' }, m: { 'outline-color': '#9abcde' } },
  };
  heading.adv = { htmlId: 'roundtrip-heading', cls: 'customer-class', css: '& strong{letter-spacing:.03em}' };

  const cmsHeading = C.N('heading', { text: 'CMS fallback', level: 'h2' });
  C.bindSet(cmsHeading, 'text', C.bindField(fields.text.id));
  const cmsText = C.N('text', { html: '<p>CMS body fallback.</p>' });
  C.bindSet(cmsText, 'html', C.bindField(fields.rich.id));
  const cmsImage = C.N('image', { src: '', alt: 'CMS cover' });
  C.bindSet(cmsImage, 'src', C.bindField(fields.image.id));
  const cmsButton = C.N('button', { text: 'Read CMS entry', link: '' });
  C.bindSet(cmsButton, 'link', C.bindField(fields.link.id));
  const collectionList = C.N('list', {
    collectionLayout: 'grid', sort: fields.number.id, dir: 'desc', where: fields.bool.id, op: 'is', val: '1', per: '6',
  }, { d: { display: 'grid', 'grid-template-columns': 'repeat(3,minmax(0,1fr))' }, t: { 'grid-template-columns': 'repeat(2,minmax(0,1fr))' }, m: { 'grid-template-columns': '1fr' } }, [
    C.N('column', {}, {}, [cmsHeading, cmsText, cmsImage, cmsButton]),
  ]);
  C.srcSet(collectionList, articles.id);

  const modules: PcNode[] = [
    heading,
    C.N('text', { html: '<p>Rich <strong>module</strong> text.</p>', ts: 'body' }),
    C.N('quote', { text: 'Roundtrip quote', by: 'Ada', source: 'Contract' }),
    C.N('image', { src: 'https://example.test/image.webp', alt: 'Roundtrip image', caption: 'Image caption', link: 'https://example.test/image' }),
    C.N('gallery', { items: [{ src: 'https://example.test/a.webp', alt: 'A', caption: 'Alpha' }, { src: 'https://example.test/b.webp', alt: 'B', caption: 'Beta' }], captions: 1, lightbox: 1, ratio: '4/3', fit: 'contain' }),
    C.N('video', { src: 'https://example.test/movie.mp4', poster: 'https://example.test/poster.webp', ratio: '16/9', controls: 1, muted: 1 }),
    C.N('icon', { name: 'star', label: 'Roundtrip star', link: 'https://example.test/icon' }),
    C.N('tabs', { items: [{ label: 'Roundtrip tab', panel: 'Roundtrip panel' }] }),
    C.N('table', { body: 'Name\tValue\nRoundtrip\t42', head: 1, rowhead: 1, caption: 'Roundtrip table', zebra: 1 }),
    C.N('code', { body: 'const roundtrip = true;', lang: 'js', title: 'roundtrip.js', numbers: 1, copy: 1 }),
    C.N('crumbs', { mode: 'manual', sep: 'slash', items: [{ label: 'Home', href: 'index.html' }, { label: 'Roundtrip', href: '' }] }),
    C.N('button', { text: 'Roundtrip button', link: 'https://example.test/button', variant: 'outline', icon: 'star' }),
    C.N('form', { mode: 'external', action: 'https://example.test/submit', method: 'post', submit: 'Send roundtrip', fields: [{ type: 'email', label: 'Email', name: 'email', required: 1, width: 50 }, { type: 'select', label: 'Topic', name: 'topic', opts: 'One,Two', width: 50 }] }),
    C.N('accordion', { items: [{ q: 'Roundtrip question?', a: 'Roundtrip answer.' }], open: 'first', single: 1, marker: 'plus' }),
    C.N('embed', { html: '<iframe src="https://example.test/embed" title="Roundtrip embed"></iframe>', ratio: '16/9' }),
    C.N('divider'),
    C.N('spacer'),
    componentInstance,
  ];
  const nestedRow = C.cols(2, [[C.N('heading', { text: 'Nested row left' })], [C.N('heading', { text: 'Nested row right' })]]);
  const flex = C.makeFor('flex'); flex.children.push(C.N('text', { html: '<p>Flex preset.</p>' }));
  const grid = C.makeFor('grid'); grid.children.push(C.N('text', { html: '<p>Grid preset.</p>' }));
  const linkBox = C.makeFor('linkbox'); linkBox.props.link = 'https://example.test/link-box';
  linkBox.children.push(C.N('text', { html: '<p>Link block preset.</p>' }));
  const slider = C.N('slider', { arrows: 1, controlsPosition: 'bottom', aria: 'Roundtrip slides' }, {}, [
    C.N('column', {}, {}, [C.N('text', { html: '<p>Slide one.</p>' })]),
    C.N('column', {}, {}, [C.N('text', { html: '<p>Slide two.</p>' })]),
  ]);
  const bodyColumn = C.N('column', {}, {}, [...modules, nestedRow, flex, grid, linkBox, slider]);
  C.state.pages[0].title = 'Roundtrip home';
  C.state.pages[0].desc = 'Every customer contract in one saved project.';
  C.state.pages[0].tree = [C.N('section', { tag: 'main', width: 'full' }, {}, [C.N('row', {}, {}, [bodyColumn]), collectionList])];
  C.state.pages.push({
    id: 'about-page', name: 'About', slug: 'about', title: 'About roundtrip', desc: 'About page',
    tree: [C.N('section', {}, {}, [C.cols(1, [[C.N('heading', { text: 'About roundtrip' })]])])],
  });
  C.state.pages.push({
    id: 'article-detail', name: 'Article', slug: 'article', title: 'Article fallback', desc: 'Detail fallback',
    collection: articles.id, bindTitle: fields.text.id, bindDesc: fields.rich.id,
    tree: [C.N('section', {}, {}, [C.cols(1, [[cmsHeading, cmsText]])])],
  });

  return { doc: jsonRoundTrip(C.doc()), componentId, variantId: 'featured-card' };
}

beforeEach(reset);

describe('full customer document round trip', () => {
  test('all 27 Add choices map to stable persisted module shapes', () => {
    const direct = Object.keys(C.DEF).filter(type => !['column', 'box'].includes(type));
    const choices = [
      ...direct,
      ...Object.keys(C.BASE),
    ];
    expect(choices).toHaveLength(27);
    expect(new Set(choices)).toHaveLength(27);
    for (const choice of choices) {
      const node = C.makeFor(choice);
      expect(C.DEF[node.type], `${choice} did not create a real module`).toBeTruthy();
      expect(jsonRoundTrip(node), `${choice} was not JSON-safe`).toEqual(node);
    }
    expect(C.makeFor('columns').type).toBe('row');
    expect(C.makeFor('flex').props.layout).toBe('flex');
    expect(C.makeFor('grid').props.layout).toBe('grid');
    expect(C.makeFor('linkbox').props.link).toBe('#');
  });

  test('save, migrate, reload, preview and export preserve every module and customer-owned contract', () => {
    const fixture = fullDocument();
    const adopted = C.migrate(jsonRoundTrip(fixture.doc))!;
    const stable = jsonRoundTrip(adopted);
    expect(C.migrate(jsonRoundTrip(stable))).toEqual(stable);

    C.restore(stable);
    expect(nodeTypes(C.doc())).toEqual(new Set(Object.keys(C.DEF)));
    expect(C.findComponent(fixture.componentId)?.variants?.[0]).toMatchObject({
      id: fixture.variantId,
      values: { title: 'Variant title', tone: '#7c3aed', featured: '1' },
    });
    expect(C.mobileMenuComponents()).toHaveLength(1);
    expect(C.collections().flatMap(collection => collection.fields.map(field => field.type)).sort())
      .toEqual(['bool', 'date', 'image', 'link', 'number', 'option', 'ref', 'rich', 'text', 'text'].sort());

    const preview = C.renderList(C.state.pages[0].tree, {
      edit: false, canvas: true, pg: C.state.pages[0], rel: '',
    });
    const exported = renderSite(stable);
    const home = exported.files.get('index.html')!;
    expect(preview).toContain('Instance roundtrip title');
    expect(home).toContain('Instance roundtrip title');
    expect(home).toContain('Footer component title');
    expect(home).toContain('Roundtrip article');
    expect(home).toContain('Rich <strong>roundtrip</strong> body.');
    expect(home).toContain(C.SHARED_HEADER_START);
    expect(home).toContain(C.SHARED_HEADER_END);
    expect(home).toContain(C.SHARED_FOOTER_START);
    expect(home).toContain(C.SHARED_FOOTER_END);
    expect(home).toContain('data-mobile-menu="fullscreen"');
    expect(home).toContain('data-nav-content');
    expect(exported.files.has('articles/roundtrip-article.html')).toBe(true);
    expect(exported.files.get('content.json')).toBeUndefined();
    expect(C.sitePlan().some(item => item.path === 'content.json')).toBe(true);

    const css = C.treeCss([
      C.state.header, C.state.footer, ...C.state.pages.map(page => page.tree),
      ...C.components().map(component => [component.node]),
    ], false);
    for (const sentinel of [
      'margin-top:31px', 'margin-top:23px', 'margin-top:17px',
      'color:#456789', 'color:#56789a', 'color:#6789ab',
      'outline-color:#789abc', 'outline-color:#89abcd', 'outline-color:#9abcde',
      'translateY(-3px)', 'outline-width:3px', 'border-radius:17px', 'border-radius:13px', 'border-radius:9px',
    ]) expect(css, `missing compiled style ${sentinel}`).toContain(sentinel);

    expect(jsonRoundTrip(C.doc())).toEqual(stable);
  });

  test('undo, redo and recovery snapshots restore the full serialized document', () => {
    const fixture = fullDocument();
    C.restore(C.migrate(jsonRoundTrip(fixture.doc))!);
    const before = jsonRoundTrip(C.doc());
    C.edit(() => {
      C.state.pages[0].title = 'Edited roundtrip title';
      C.findComponent(fixture.componentId)!.variants![0].values.title = 'Edited variant title';
      C.collections()[1].items[0].values[C.collections()[1].fields[0].id] = 'Edited CMS title';
    }, 'Edit full customer fixture');
    const after = jsonRoundTrip(C.doc());
    expect(after).not.toEqual(before);
    C.undo();
    expect(jsonRoundTrip(C.doc())).toEqual(before);
    C.redo();
    expect(jsonRoundTrip(C.doc())).toEqual(after);
    C.restore(jsonRoundTrip(before));
    expect(jsonRoundTrip(C.doc())).toEqual(before);
  });

  test('content export and import preserve typed field settings and reference identity', () => {
    fullDocument();
    const exported = JSON.parse(C.contentJson());
    const exportedArticles = exported.collections.find((collection: { name: string }) => collection.name === 'Articles');
    expect(exportedArticles.fields.find((field: { name: string }) => field.name === 'Kind'))
      .toMatchObject({ type: 'option', opts: 'Guide,News' });
    expect(exportedArticles.fields.find((field: { name: string }) => field.name === 'Author'))
      .toMatchObject({ type: 'ref', ref: expect.any(String) });

    reset();
    const report = C.contentImport(exported)!;
    expect(report.notes).toEqual([]);
    const authors = C.collections().find(collection => collection.name === 'Authors')!;
    const articles = C.collections().find(collection => collection.name === 'Articles')!;
    const option = articles.fields.find(field => field.name === 'Kind')!;
    const date = articles.fields.find(field => field.name === 'Published')!;
    const reference = articles.fields.find(field => field.name === 'Author')!;
    expect(option).toMatchObject({ type: 'option', opts: 'Guide,News' });
    expect(date).toMatchObject({ type: 'date', required: 1 });
    expect(reference).toMatchObject({ type: 'ref', ref: authors.id });
    const imported = articles.items[0];
    expect(Object.fromEntries(articles.fields.map(field => [field.name, imported.values[field.id] || ''])))
      .toMatchObject({
        Title: 'Roundtrip article', Body: '<p>Rich <strong>roundtrip</strong> body.</p>',
        Cover: 'https://example.test/roundtrip.webp', Destination: 'https://example.test/read',
        Score: '42.5', Published: '2026-10-14', Kind: 'Guide', Featured: '1',
      });
    expect(C.fieldValue(articles, articles.items[0], `${reference.id}.${C.titleField(authors)!.id}`))
      .toBe('Ada Roundtrip');
  });

  test('content image resolution restores exact exported media paths without rewriting other values', () => {
    const media = C.collectionAdd('Media roundtrip');
    const photo = C.fieldAdd(media.id, 'Photo', 'image')!;
    const note = C.fieldAdd(media.id, 'Path note', 'text')!;
    const item = C.itemAdd(media.id)!;
    C.itemSet(media.id, item.id, C.titleField(media)!.id, 'Known image');
    C.itemSet(media.id, item.id, photo.id, 'asset:a53e0e21cc7a4');
    C.itemSet(media.id, item.id, note.id, 'assets/table-a53e0e21cc7a4.webp');

    const exported = JSON.parse(C.contentJson(value => {
      const text = String(value == null ? '' : value);
      return text === 'asset:a53e0e21cc7a4' ? 'assets/table-a53e0e21cc7a4.webp' : text;
    }));
    C.itemSet(media.id, item.id, photo.id, '');
    C.itemSet(media.id, item.id, note.id, 'changed');
    const seen: string[] = [];
    C.contentImport(exported, { resolveImage: value => {
      seen.push(value);
      return value === 'assets/table-a53e0e21cc7a4.webp' ? 'asset:a53e0e21cc7a4' : value;
    } });

    expect(item.values[photo.id]).toBe('asset:a53e0e21cc7a4');
    expect(item.values[note.id]).toBe('assets/table-a53e0e21cc7a4.webp');
    expect(seen).toEqual(['assets/table-a53e0e21cc7a4.webp']);

    for (const value of [
      'assets/unknown.webp',
      'https://cdn.example.test/photo.webp',
      'asset:already-owned',
    ]) {
      C.contentImport({
        collections: [{
          id: media.id, name: media.name, slug: media.slug,
          fields: media.fields.map((field: Field) => ({ id: field.id, name: field.name, type: field.type })),
          items: [{ id: item.id, slug: item.slug, values: { [photo.id]: value } }],
        }],
      }, { resolveImage: candidate => candidate === 'assets/table-a53e0e21cc7a4.webp'
        ? 'asset:a53e0e21cc7a4'
        : candidate });
      expect(item.values[photo.id]).toBe(value);
    }
  });

  test('content metadata clears only when the file explicitly supplies false or empty values', () => {
    const targets = C.collectionAdd('Targets');
    const content = C.collectionAdd('Metadata');
    const title = C.titleField(content)!;
    const option = C.fieldAdd(content.id, 'Choice', 'option')!;
    const reference = C.fieldAdd(content.id, 'Target', 'ref')!;
    title.required = 1;
    option.opts = 'Old,Choices';
    reference.ref = targets.id;

    const report = C.contentImport({
      collections: [{
        id: content.id,
        name: content.name,
        slug: content.slug,
        fields: [
          { id: title.id, name: title.name, type: title.type, required: false },
          { id: option.id, name: option.name, type: option.type, required: false, opts: '' },
          { id: reference.id, name: reference.name, type: reference.type, required: false, ref: '' },
        ],
        items: [],
      }],
    })!;
    expect(report.notes).toEqual([]);
    expect(title.required).toBe(0);
    expect(option.opts).toBe('');
    expect(reference.ref).toBeUndefined();

    const exported = JSON.parse(C.contentJson());
    const fields = exported.collections.find((collection: { id: string }) => collection.id === content.id).fields;
    expect(fields.find((field: { id: string }) => field.id === option.id))
      .toMatchObject({ required: false, opts: '' });
    expect(fields.find((field: { id: string }) => field.id === reference.id))
      .toMatchObject({ required: false, ref: '' });

    title.required = 1;
    option.opts = 'Legacy,Options';
    reference.ref = targets.id;
    C.contentImport({
      collections: [{
        id: content.id,
        name: content.name,
        slug: content.slug,
        fields: [
          { id: title.id, name: title.name, type: title.type },
          { id: option.id, name: option.name, type: option.type },
          { id: reference.id, name: reference.name, type: reference.type },
        ],
        items: [],
      }],
    });
    expect(title.required).toBe(1);
    expect(option.opts).toBe('Legacy,Options');
    expect(reference.ref).toBe(targets.id);
  });

  test('slug matches defeat local id collisions and reference values use the remapped item', () => {
    const authors = C.collectionAdd('Authors');
    const authorTitle = C.titleField(authors)!;
    const wrongAuthor = C.itemAdd(authors.id)!;
    wrongAuthor.id = 'source-author';
    wrongAuthor.slug = 'wrong-author';
    wrongAuthor.values[authorTitle.id] = 'Wrong local author';
    const ada = C.itemAdd(authors.id)!;
    ada.slug = 'ada';
    ada.values[authorTitle.id] = 'Existing Ada';
    const grace = C.itemAdd(authors.id)!;
    grace.slug = 'grace';
    grace.values[authorTitle.id] = 'Existing Grace';

    const posts = C.collectionAdd('Posts');
    const postTitle = C.titleField(posts)!;
    const authorRef = C.fieldAdd(posts.id, 'Author', 'ref')!;
    authorRef.ref = authors.id;
    const wrongField = C.fieldAdd(posts.id, 'Unrelated choice', 'option')!;
    wrongField.id = 'source-author-field';
    wrongField.opts = 'Keep,This';
    const occupiedField = C.fieldAdd(posts.id, 'Occupied local field', 'text')!;
    occupiedField.id = 'source-fresh-field';

    const idCollision = C.collectionAdd('Unrelated local collection');
    idCollision.id = 'source-authors';
    const collisionTitle = C.titleField(idCollision)!;
    const collisionItem = C.itemAdd(idCollision.id)!;
    collisionItem.values[collisionTitle.id] = 'Do not update';

    const report = C.contentImport({
      collections: [
        {
          id: 'source-posts', name: 'Posts', slug: posts.slug,
          fields: [
            { id: postTitle.id, name: postTitle.name, type: 'text', required: false },
            { id: 'source-author-field', name: authorRef.name, type: 'ref', required: false, ref: 'source-authors' },
            { id: 'source-author-field', name: 'Duplicate ignored field', type: 'text', required: false },
            { id: 'source-fresh-field', name: 'Fresh imported field', type: 'text', required: false },
          ],
          items: [{
            id: 'source-post', slug: 'first-post',
            values: {
              [postTitle.id]: 'First post', 'source-author-field': 'source-author',
              'source-fresh-field': 'Fresh imported value',
            },
          }],
        },
        {
          id: 'source-authors', name: 'Authors', slug: authors.slug,
          fields: [{ id: authorTitle.id, name: authorTitle.name, type: 'text', required: false }],
          items: [
            { id: 'source-author', slug: 'ada', values: { [authorTitle.id]: 'Imported Ada' } },
            { id: 'source-author', slug: 'grace', values: { [authorTitle.id]: 'Imported Grace' } },
          ],
        },
        {
          id: 'source-posts', name: 'Duplicate Posts', slug: posts.slug,
          fields: [], items: [],
        },
      ],
    })!;

    expect(report.notes.filter(note => note.includes('ambiguous')).length).toBeGreaterThanOrEqual(3);
    expect(report.notes.some(note => /duplicate.*source-author/i.test(note))).toBe(true);
    expect(report.notes.some(note => /duplicate collection id.*source-posts/i.test(note))).toBe(true);
    expect(report.notes.some(note => /field id.*source-author-field.*matched by name/i.test(note))).toBe(true);
    expect(report.notes.some(note => /duplicate field id.*source-author-field/i.test(note))).toBe(true);
    expect(report.notes.some(note => /field id.*source-fresh-field.*distinct field/i.test(note))).toBe(true);
    expect(wrongAuthor.values[authorTitle.id]).toBe('Wrong local author');
    expect(ada.values[authorTitle.id]).toBe('Imported Ada');
    expect(grace.values[authorTitle.id]).toBe('Imported Grace');
    expect(collisionItem.values[collisionTitle.id]).toBe('Do not update');
    expect(wrongField).toMatchObject({ type: 'option', opts: 'Keep,This' });
    expect(posts.items[0].values[occupiedField.id]).toBeUndefined();
    const freshField = posts.fields.find((field: Field) => field.name === 'Fresh imported field')!;
    expect(freshField.id).not.toBe(occupiedField.id);
    expect(posts.items[0].values[freshField.id]).toBe('Fresh imported value');
    expect(authorRef.ref).toBe(authors.id);
    expect(posts.items[0].values[authorRef.id]).toBe(ada.id);
  });

  test('reserved object keys remain field, collection, item and reference identities', () => {
    const report = C.contentImport({
      collections: [
        {
          id: 'constructor', name: 'Reserved posts', slug: 'reserved-posts',
          fields: [
            { id: 'constructor', name: 'Title', type: 'text', required: true },
            { id: 'prototype', name: 'Author', type: 'ref', required: false, ref: '__proto__' },
          ],
          items: [{
            id: 'prototype', slug: 'reserved-post',
            values: JSON.parse('{"constructor":"Reserved post","prototype":"constructor"}'),
          }],
        },
        {
          id: '__proto__', name: 'Reserved authors', slug: 'reserved-authors',
          fields: [{ id: '__proto__', name: 'Title', type: 'text', required: true }],
          items: [{
            id: 'constructor', slug: 'reserved-author',
            values: JSON.parse('{"__proto__":"Reserved author"}'),
          }],
        },
      ],
    })!;

    expect(report.notes.filter(note => /not a field/.test(note))).toEqual([]);
    const posts = C.collections().find(collection => collection.slug === 'reserved-posts')!;
    const authors = C.collections().find(collection => collection.slug === 'reserved-authors')!;
    const postTitle = posts.fields.find(field => field.name === 'Title')!;
    const authorRef = posts.fields.find(field => field.name === 'Author')!;
    const authorTitle = authors.fields.find(field => field.name === 'Title')!;
    expect(posts.items[0].values[postTitle.id]).toBe('Reserved post');
    expect(authors.items[0].values[authorTitle.id]).toBe('Reserved author');
    expect(posts.items[0].values[authorRef.id]).toBe(authors.items[0].id);
    expect(C.fieldValue(posts, posts.items[0], `${authorRef.id}.${authorTitle.id}`)).toBe('Reserved author');
    expect(Object.getPrototypeOf(posts.items[0].values)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('legacy destination fields named like object internals write and export as own values', () => {
    const collection = C.collectionAdd('Legacy reserved fields');
    const proto = C.titleField(collection)!;
    proto.id = '__proto__';
    const constructor = C.fieldAdd(collection.id, 'Constructor', 'text')!;
    constructor.id = 'constructor';
    const prototype = C.fieldAdd(collection.id, 'Prototype', 'text')!;
    prototype.id = 'prototype';
    const item = C.itemAdd(collection.id)!;
    item.slug = 'legacy-reserved-item';

    const report = C.contentImport({
      collections: [{
        id: collection.id, name: collection.name, slug: collection.slug,
        fields: [
          { id: '__proto__', name: proto.name, type: 'text', required: true },
          { id: 'constructor', name: constructor.name, type: 'text', required: false },
          { id: 'prototype', name: prototype.name, type: 'text', required: false },
        ],
        items: [{
          id: item.id, slug: item.slug,
          values: JSON.parse('{"__proto__":"Proto value","constructor":"Constructor value","prototype":"Prototype value"}'),
        }],
      }],
    })!;

    expect(report.notes).toEqual([]);
    expect(Object.prototype.hasOwnProperty.call(item.values, '__proto__')).toBe(true);
    expect(item.values['__proto__']).toBe('Proto value');
    expect(item.values.constructor).toBe('Constructor value');
    expect(item.values.prototype).toBe('Prototype value');
    const exported = JSON.parse(C.contentJson());
    const values = exported.collections[0].items[0].values;
    expect(Object.keys(values)).toEqual(['__proto__', 'constructor', 'prototype']);
    expect(values['__proto__']).toBe('Proto value');
    expect(values.constructor).toBe('Constructor value');
    expect(values.prototype).toBe('Prototype value');
    expect(Object.getPrototypeOf(item.values)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('conditional CMS and component variants retain empty-string semantics through save and render', () => {
    const articles = C.collectionAdd('Conditional articles');
    const destination = C.fieldAdd(articles.id, 'Destination', 'link')!;
    const blank = C.itemAdd(articles.id)!;
    const linked = C.itemAdd(articles.id)!;
    C.itemSet(articles.id, blank.id, C.titleField(articles)!.id, 'Blank destination');
    C.itemSet(articles.id, blank.id, destination.id, '   ');
    C.itemSet(articles.id, linked.id, C.titleField(articles)!.id, 'Linked destination');
    C.itemSet(articles.id, linked.id, destination.id, 'https://example.test/conditional');

    const cmsButton = C.N('button', { text: 'Conditional CMS link' });
    C.bindSet(cmsButton, 'link', C.bindField(destination.id));
    C.condSet(cmsButton, { bind: C.bindField(destination.id)!, op: 'set' });
    const list = C.N('list', {}, {}, [C.N('column', {}, {}, [cmsButton])]);
    C.srcSet(list, articles.id);

    const title = C.N('heading', { text: 'Default conditional title' });
    const badge = C.N('text', { html: '<p>Default badge</p>' });
    const equal = C.N('text', { html: '<p>Equal branch</p>' });
    const different = C.N('text', { html: '<p>Not equal branch</p>' });
    C.bindSet(title, 'text', { src: 'prop', path: 'title' });
    C.bindSet(badge, 'html', { src: 'prop', path: 'badge' });
    C.condSet(badge, { bind: { src: 'prop', path: 'badge' }, op: 'set' });
    C.condSet(equal, { bind: { src: 'prop', path: 'badge' }, op: 'eq', value: ' <p> New </p> ' });
    C.condSet(different, { bind: { src: 'prop', path: 'badge' }, op: 'ne', value: '<p> New </p>' });
    const componentId = 'conditional-card';
    C.state.meta.components!.push({
      id: componentId, name: 'Conditional card',
      node: C.N('box', {}, {}, [title, badge, equal, different]),
      props: [
        { k: 'title', label: 'Title', t: 'text', def: 'Default conditional title' },
        { k: 'badge', label: 'Badge', t: 'rich', def: '' },
      ],
      variants: [
        { id: 'empty', name: 'Empty', values: { title: 'Empty card', badge: '' } },
        { id: 'live', name: 'Live', values: { title: 'Live card', badge: '<p> New </p>' } },
      ],
    });
    const instance = (variant: string, badgeOverride?: string) => {
      const node = C.N('box');
      node.use = componentId;
      node.variant = variant;
      if (badgeOverride !== undefined) node.vals = { badge: badgeOverride };
      return node;
    };
    const emptyInstance = instance('empty');
    const liveInstance = instance('live');
    const clearedInstance = instance('live', '');
    C.state.pages[0].tree = [C.N('section', {}, {}, [
      C.N('row', {}, {}, [C.N('column', {}, {}, [emptyInstance, liveInstance, clearedInstance, list])]),
    ])];

    const stable = C.migrate(jsonRoundTrip(C.doc()))!;
    C.restore(stable);
    const html = renderSite(C.doc()).files.get('index.html')!;
    expect((html.match(/Conditional CMS link/g) || [])).toHaveLength(1);
    expect((html.match(/Equal branch/g) || [])).toHaveLength(1);
    expect((html.match(/Not equal branch/g) || [])).toHaveLength(2);
    expect((html.match(/<p> New <\/p>/g) || [])).toHaveLength(1);

    expect(C.variantDelete(componentId, 'live')).toBe(2);
    const afterDelete = renderSite(C.doc()).files.get('index.html')!;
    expect((afterDelete.match(/Equal branch/g) || [])).toHaveLength(1);
    expect((afterDelete.match(/Not equal branch/g) || [])).toHaveLength(2);
    expect(jsonRoundTrip(C.migrate(jsonRoundTrip(C.doc()))!)).toEqual(jsonRoundTrip(C.doc()));
  });

  test('responsive state resets and fractional raw ranges survive serialization and stylesheet compilation', () => {
    const heading = C.N('heading', { text: 'Responsive range contract' });
    heading.css = {
      d: { 'font-size': '48px' }, t: { 'font-size': '36px' }, m: { 'font-size': '28px' },
    };
    heading.st = {
      hover: { d: { opacity: '.4' }, t: { opacity: '.6' }, m: { opacity: '.8' } },
      focus: { d: { 'outline-width': '2px' }, t: { 'outline-width': '3px' }, m: { 'outline-width': '4px' } },
    };
    const image = C.N('image', { src: 'https://example.test/range.webp', alt: 'Range' });
    const icon = C.N('icon', { name: 'star' });
    const column = C.N('column', {}, {}, [heading, image, icon]);
    const section = C.N('section', {}, {}, [C.N('row', {}, {}, [column])]);
    C.state.pages[0].tree = [section];

    C.state.ui.dev = 'mobile';
    C.state.ui.st = 'hover';
    C.setCss(heading, 'opacity', '', true);
    expect(C.cssVal(heading, 'opacity', true)).toEqual({ v: '.6', own: false });

    const classId = C.classAdd('Responsive focus', { d: {} });
    C.classApply(heading, classId);
    C.findClass(classId)!.st = {
      focus: { d: { 'outline-width': '2px' }, t: { 'outline-width': '3px' }, m: { 'outline-width': '4px' } },
    };
    C.state.ui.target = classId;
    C.state.ui.st = 'focus';
    C.applyOne(heading, { c: 'outline-width', r: 1 }, '');
    expect(C.cssVal(C.findClass(classId)!, 'outline-width', true)).toEqual({ v: '3px', own: false });

    C.state.ui.target = '';
    C.state.ui.st = '';
    const slider = (controls: readonly any[], property: string) =>
      controls.find(control => control.t === 'slider' && control.c === property)!;
    C.applyOne(image, slider(C.DEF.image.controls.style, 'opacity'), '0');
    C.applyOne(icon, slider(C.DEF.icon.controls.style, '--icon-stroke'), '1.05');
    C.applyOne(column, slider(C.DEF.column.controls.content, 'flex-grow'), '5.01');
    C.applyOne(section, slider(C.COMMON_STYLE.flatMap(group => group.items), 'opacity'), '.01');

    const stable = jsonRoundTrip(C.migrate(jsonRoundTrip(C.doc()))!);
    C.restore(stable);
    expect(jsonRoundTrip(C.doc())).toEqual(stable);
    const restoredHeading = C.locateAny(heading.id)!.node;
    expect(restoredHeading.st!.hover!.m).not.toHaveProperty('opacity');
    expect(C.findClass(classId)!.st!.focus!.m).not.toHaveProperty('outline-width');
    const css = C.treeCss([C.state.pages[0].tree], false);
    for (const value of ['opacity:0', '--icon-stroke:1.05', 'flex-grow:5.01', 'opacity:.01']) {
      expect(css).toContain(value);
    }
  });

  test('all native form field types and widths survive save and export as usable controls', () => {
    const fields = [
      { type: 'text', label: 'Name', name: 'name', ph: 'Your name', required: 1 as const, width: 50 as const },
      { type: 'email', label: 'Email', name: 'email', required: 1 as const, width: 50 as const },
      { type: 'tel', label: 'Phone', name: 'phone', width: 33 as const },
      { type: 'url', label: 'Website', name: 'website', width: 33 as const },
      { type: 'number', label: 'Guests', name: 'guests', width: 33 as const },
      { type: 'date', label: 'Date', name: 'date', required: 1 as const, width: 25 as const },
      { type: 'textarea', label: 'Message', name: 'message', ph: 'Details', width: 25 as const },
      { type: 'select', label: 'Topic', name: 'topic', opts: 'One, Two', width: 20 as const },
      { type: 'checkbox', label: 'Consent', name: 'consent', required: 1 as const, width: 20 as const },
    ];
    const form = C.N('form', {
      mode: 'external', action: 'https://example.test/forms', method: 'post',
      submit: 'Send all fields', aria: 'All field types', fields,
    });
    C.state.pages[0].tree = [C.N('section', {}, {}, [C.cols(1, [[form]])])];
    const stable = C.migrate(jsonRoundTrip(C.doc()))!;
    C.restore(stable);
    const html = renderSite(C.doc()).files.get('index.html')!;
    expect(html).toContain('action="https://example.test/forms" method="post"');
    expect(html).toContain('pagecraft-form pagecraft-form-percent');
    for (const type of ['text', 'email', 'tel', 'url', 'number', 'date', 'checkbox']) {
      expect(html).toContain(`type="${type}"`);
    }
    expect(html).toContain('<textarea');
    expect(html).toContain('<select');
    expect(html).toContain('<option value="One">One</option><option value="Two">Two</option>');
    for (const width of [50, 33, 25, 20]) expect(html).toContain(`field-width-${width}`);
    expect((html.match(/ required/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(jsonRoundTrip(C.doc())).toEqual(jsonRoundTrip(stable));
  });
});
