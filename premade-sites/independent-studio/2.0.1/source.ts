import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV200 } from '../2.0.0/source.ts';

const children = (node: Node) => node.children || [];
const classList = (node: Node) => String(node.adv?.cls || '').split(/\s+/).filter(Boolean);
const hasClass = (node: Node, cls: string) => classList(node).includes(cls);

const walk = (nodes: Node[], visit: (node: Node) => void) => {
  for (const node of nodes) {
    visit(node);
    walk(children(node), visit);
  }
};

const find = (nodes: Node[], predicate: (node: Node) => boolean) => {
  let match: Node | undefined;
  walk(nodes, node => { if (!match && predicate(node)) match = node; });
  return match;
};

const findAll = (nodes: Node[], predicate: (node: Node) => boolean) => {
  const matches: Node[] = [];
  walk(nodes, node => { if (predicate(node)) matches.push(node); });
  return matches;
};

const set = (node: Node | undefined, bp: 'd' | 't' | 'm', declarations: Record<string, string>) => {
  if (!node) return;
  node.css ||= { d: {}, t: {}, m: {} };
  node.css[bp] = { ...(node.css[bp] || {}), ...declarations };
};

const compactSection = (section: Node | undefined, desktopY: string, mobileY: string) => {
  set(section, 'd', { 'padding-top': desktopY, 'padding-bottom': desktopY });
  set(section, 't', { 'padding-top': '68px', 'padding-bottom': '68px' });
  set(section, 'm', { 'padding-top': mobileY, 'padding-bottom': mobileY });
};

const setImageHeight = (nodes: Node[], desktop: string, mobile: string) => {
  const media = find(nodes, node => node.type === 'image');
  set(media, 'd', { height: desktop });
  set(media, 'm', { height: mobile });
  if (media) media.props.lazy = 0;
};

const page = (document: Doc, slug: string) => document.pages.find(item => item.slug === slug) as Page;

function refineHome(home: Page) {
  const [hero, disciplines, timeline, loop, close] = home.tree;
  compactSection(hero, '72px', '44px');
  compactSection(disciplines, '84px', '52px');
  compactSection(timeline, '84px', '52px');
  compactSection(loop, '84px', '52px');
  compactSection(close, '84px', '60px');
  set(close, 'd', { 'min-height': '560px' });
  set(close, 'm', { 'min-height': '500px' });

  setImageHeight(children(hero), '620px', '340px');
  for (const panel of findAll(children(disciplines), node => hasClass(node, 'nl-service-panel'))) {
    const media = find(children(panel), node => node.type === 'image');
    set(media, 'd', { height: '210px' });
    set(media, 'm', { height: '190px' });
    if (media) media.props.lazy = 0;
    const body = find(children(panel), node => node.type === 'box');
    set(body, 'd', { 'min-height': '220px', padding: '24px 22px 26px' });
    set(body, 'm', { 'min-height': '0', padding: '20px' });
    const panelCopy = findAll(children(body || panel), node => node.type === 'text');
    const panelLink = panelCopy.at(-1);
    set(panelLink, 'm', { 'padding-top': '18px' });
  }

  for (const item of findAll(children(timeline), node => hasClass(node, 'nl-scrub'))) {
    set(item, 'd', { 'min-height': '240px', padding: '28px 0 44px' });
    set(item, 'm', { 'min-height': '0', padding: '20px 0 24px' });
  }
  const sticky = find(children(timeline), node => hasClass(node, 'nl-sticky'));
  set(sticky, 'd', { top: '104px' });

  for (const card of findAll(children(loop), node => hasClass(node, 'nl-loop-card'))) {
    set(card, 'd', { 'min-height': '310px', padding: '30px' });
    set(card, 'm', { 'min-height': '280px', padding: '24px' });
    const cardHeading = find(children(card), node => node.type === 'heading');
    set(cardHeading, 'd', { 'margin-top': '48px' });
    set(cardHeading, 'm', { 'margin-top': '34px' });
  }
  const slider = find(children(loop), node => node.type === 'slider');
  set(slider, 'm', { '--sl-w': '100%' });
}

function refineAbout(about: Page) {
  const [hero, story, close] = about.tree;
  compactSection(hero, '76px', '48px');
  compactSection(story, '84px', '52px');
  compactSection(close, '84px', '60px');
  set(close, 'd', { 'min-height': '560px' });
  set(close, 'm', { 'min-height': '500px' });

  const h1 = find(children(hero), node => node.type === 'heading' && node.props.level === 'h1');
  if (h1) h1.props.text = 'One studio. Better decisions.';
  set(h1, 'd', { 'font-size': 'clamp(54px,5.4vw,72px)', 'max-width': '11.5ch' });
  set(h1, 'm', { 'font-size': '42px', 'max-width': '10ch' });
  setImageHeight(children(hero), '520px', '310px');

  const storyRows = findAll(children(story), node => node.type === 'row');
  const detailRow = storyRows.at(-1);
  set(detailRow, 'd', { 'margin-top': '56px', gap: '64px' });
  set(detailRow, 'm', { 'margin-top': '38px', gap: '34px' });
  if (detailRow) setImageHeight(children(detailRow), '420px', '260px');
}

function refineServices(services: Page) {
  const [hero, identity, digital, editorial, close] = services.tree;
  compactSection(hero, '72px', '46px');
  for (const detail of [identity, digital, editorial]) {
    compactSection(detail, '68px', '48px');
    setImageHeight(children(detail), '440px', '240px');
    const row = find(children(detail), node => node.type === 'row');
    set(row, 'd', { gap: '64px' });
    set(row, 'm', { gap: '32px' });
  }
  const digitalRow = find(children(digital), node => node.type === 'row');
  set(digitalRow, 'm', { 'flex-direction': 'column-reverse' });
  compactSection(close, '84px', '60px');
  set(close, 'd', { 'min-height': '560px' });
  set(close, 'm', { 'min-height': '500px' });
}

function refineContact(contact: Page) {
  const [hero, notes] = contact.tree;
  compactSection(hero, '76px', '48px');
  compactSection(notes, '76px', '52px');
  const h1 = find(children(hero), node => node.type === 'heading' && node.props.level === 'h1');
  set(h1, 'd', { 'font-size': 'clamp(60px,6.2vw,82px)', 'max-width': '10ch' });
  set(h1, 'm', { 'font-size': '44px', 'max-width': '10ch' });
  setImageHeight(children(hero), '500px', '300px');
}

function refineFooter(document: Doc) {
  const footer = document.footer[0];
  compactSection(footer, '80px', '52px');
  const rows = findAll(children(footer), node => node.type === 'row');
  const colophon = rows.at(-1);
  set(colophon, 'd', { 'margin-top': '54px' });
  set(colophon, 'm', { 'margin-top': '38px' });
}

function normalizeType(document: Doc) {
  const regions = [document.header, ...document.pages.map(item => item.tree), document.footer];
  for (const region of regions) walk(region, node => {
    for (const breakpoint of ['d', 't', 'm'] as const) {
      const tracking = node.css?.[breakpoint]?.['letter-spacing'];
      if (tracking && /^-\.(?:0[5-9]|[1-9]\d*)em$/.test(tracking)) node.css![breakpoint]['letter-spacing'] = '-.04em';
    }
  });
}

export function buildIndependentStudioDocument(): Doc {
  const document = buildV200();
  const legacyMediaTransition = [
    '.nl-service-panel .nl-media{transition:',
    'height .55s cubic-bezier(.2,.75,.25,1)}\n',
    '.nl-service-panel:hover .nl-media,.nl-service-panel:focus-within .nl-media{height:330px!important}\n',
  ].join('');
  refineHome(page(document, 'index'));
  refineAbout(page(document, 'about'));
  refineServices(page(document, 'services'));
  refineContact(page(document, 'contact'));
  refineFooter(document);
  normalizeType(document);

  document.meta.css = document.meta.css
    .replace('.nl-service-panel{transition:flex-grow .55s cubic-bezier(.2,.75,.25,1),transform .3s ease}', '.nl-service-panel{transition:transform .3s ease}')
    .replace('.nl-service-panel:hover,.nl-service-panel:focus-within{flex-grow:2.15;transform:translateY(-8px)}', '@media(hover:hover) and (pointer:fine){.nl-service-panel:hover,.nl-service-panel:focus-within{transform:translateY(-6px)}}')
    .replace(legacyMediaTransition, '')
    .replace('@supports(animation-timeline:view()){', '@media(min-width:761px){@supports(animation-timeline:view()){')
    .replace('  @keyframes nl-reveal{to{opacity:1;transform:translateY(0)}}\n}', '  @keyframes nl-reveal{to{opacity:1;transform:translateY(0)}}\n}}')
    .replace('  .nl-service-panel:hover .nl-media,.nl-service-panel:focus-within .nl-media{height:240px!important}\n', '')
    .replace('  .nl-sticky{position:static}', '  .nl-sticky{position:static}\n  .nl-scrub{opacity:1!important;transform:none!important}')
    + '\n.nl-menu .pagecraft-nav-toggle{position:relative;z-index:71}\n';

  return document;
}
