/** Stillwood CMS acceptance fixture. Never rewrites the released package. */
import type { Doc, Collection, Node } from '../app/src/core/types.ts';
import * as C from '../app/src/core/index.ts';
export function cmsPilot(source: Doc): Doc {
  const doc = structuredClone(source);
  C.restore(doc);
  const instances: Node[] = [];
  C.eachNode(doc.pages[0].tree, (n) => {
    if (n.use === 'stillwood-cabin') instances.push(n);
  });
  if (instances.length !== 3)
    throw new Error('Expected the three released Stillwood cabin instances');
  const styles: Collection = {
    id: 'stay-types',
    name: 'Stay types',
    slug: 'stay-types',
    detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text', required: 1 }],
    items: instances.map((n, i) => ({
      id: 'style-' + i,
      slug: 'style-' + i,
      slugLocked: 1,
      values: { title: String(n.vals?.kicker || '') },
    })),
  };
  const cabins: Collection = {
    id: 'cabins',
    name: 'Cabins',
    slug: 'cabins',
    detail: '',
    fields: [
      { id: 'title', name: 'Name', type: 'text', required: 1 },
      { id: 'description', name: 'Description', type: 'rich', required: 1 },
      { id: 'cover', name: 'Cover image', type: 'image', required: 1 },
      { id: 'guests', name: 'Guests', type: 'number', required: 1 },
      { id: 'bedrooms', name: 'Bedrooms', type: 'number', required: 1 },
      { id: 'amenities', name: 'Amenities', type: 'text' },
      { id: 'stay-type', name: 'Stay type', type: 'ref', ref: 'stay-types' },
    ],
    items: instances.map((n, i) => {
      const v = n.vals!;
      const facts = String(v.facts).split(' · ');
      return {
        id: 'cabin-' + i,
        slug: String(v.destination).replace('.html', ''),
        slugLocked: 1,
        values: {
          title: String(v.name),
          description: `<p>${C.esc(String(v.description))}</p>`,
          cover: String(v.image),
          guests: facts[0].split(' ')[0],
          bedrooms: facts[1].split(' ')[0],
          amenities: facts.slice(2).join(' · '),
          'stay-type': 'style-' + i,
        },
      };
    }),
  };
  doc.meta.collections = [styles, cabins];
  doc.meta.name = 'Stillwood CMS QA';
  const def = doc.meta.components!.find((c) => c.id === 'stillwood-cabin')!;
  const mapped: Record<string, string> = {
    image: 'cover',
    alt: 'title',
    kicker: 'stay-type.title',
    name: 'title',
    facts: 'amenities',
    description: 'description',
  };
  const makeCard = () => {
    const node = C.reid(structuredClone(def.node));
    C.eachNode([node], (n) => {
      for (const [key, b] of Object.entries(n.bind || {})) {
        if (b.src !== 'prop') continue;
        if (b.path === 'destination') {
          delete n.bind![key];
          n.props.link = 'cms:item';
        } else if (b.path === 'description') {
          delete n.bind![key];
          n.type = 'text';
          n.props = { html: '' };
          n.bind!.html = { src: 'field', path: 'description' };
        } else if (mapped[b.path])
          n.bind![key] = { src: 'field', path: mapped[b.path] };
      }
    });
    return node;
  };
  const convert = (nodes: Node[]) =>
    nodes.forEach((n) => {
      if (n.children?.some((c) => c.use === 'stillwood-cabin')) {
        const slider = n.type === 'slider';
        n.type = 'list';
        n.src = 'cabins';
        n.props = { collectionLayout: slider ? 'slider' : 'grid' };
        n.children = [makeCard()];
        if (!slider)
          n.css.d = {
            ...n.css.d,
            display: 'grid',
            'grid-template-columns': 'repeat(3,minmax(0,1fr))',
          };
        n.css.m = { ...n.css.m, 'grid-template-columns': '1fr' };
      } else convert(n.children || []);
    });
  doc.pages.forEach((p) => convert(p.tree));
  // A dedicated detail template demonstrates all data fields, with the existing brand.
  const section = C.N('section');
  const box = makeCard();
  C.eachNode([box], (n) => {
    if (n.type === 'heading' && n.bind?.text?.path === 'title')
      n.props.level = 'h1';
    if (n.props.link === 'cms:item') n.props.link = 'cabins.html';
  });
  section.children.push(box);
  for (const field of ['guests', 'bedrooms']) {
    const heading = C.N('heading');
    heading.props.level = 'h2';
    heading.props.text = field === 'guests' ? 'Guests' : 'Bedrooms';
    const value = C.N('heading');
    value.props.level = 'p';
    value.bind = { text: { src: 'field', path: field } };
    section.children.push(heading, value);
  }
  doc.pages = doc.pages.filter(
    (p) => !cabins.items.some((i) => p.slug === i.slug),
  );
  doc.pages.push({
    id: C.uid(),
    name: 'Cabin detail',
    slug: 'cabin-detail',
    collection: 'cabins',
    title: '',
    desc: '',
    bindTitle: 'title',
    tree: [section],
  });
  let encoded = JSON.stringify(doc);
  for (const item of cabins.items)
    encoded = encoded.replaceAll(
      `${item.slug}.html`,
      `cabins/${item.slug}.html`,
    );
  return JSON.parse(encoded);
}
