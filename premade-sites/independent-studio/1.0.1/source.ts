import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';

const C = Core.cvar;
const N = Core.N as (type: string, props?: Record<string, unknown>, css?: Record<string, Record<string, string>>, children?: Node[]) => Node;
const BOX = Core.BOX as (top: string, right: string, bottom: string, left: string) => Record<string, string>;

const heading = (text: string, style: 'display' | 'title' | 'subtitle', level: 'h1' | 'h2' | 'h3', css: Record<string, Record<string, string>> = {}) =>
  N('heading', { text, ts: style, level }, css);

const text = (html: string, style: 'lead' | 'body' | 'small' = 'body', css: Record<string, Record<string, string>> = {}) =>
  N('text', { html, ts: style }, css);

const button = (label: string, link: string, solid = true) => N('button', {
  text: label, link, ts: 'btn', variant: solid ? 'solid' : 'outline', icon: solid ? 'arrow' : 'none'
}, {
  d: solid
    ? { 'background-color': C('brand'), color: C('paper'), padding: '14px 22px', 'border-radius': '0px' }
    : { 'background-color': 'transparent', color: C('ink'), padding: '13px 21px', 'border-radius': '0px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('ink') },
  t: {}, m: { width: '100%' }
});

const column = (grow: number, children: Node[], css: Record<string, string> = {}) => N('column', {}, {
  d: { 'flex-grow': String(grow), ...(grow === 0 ? { 'flex-basis': 'auto', 'flex-shrink': '0' } : {}), ...css },
  t: {}, m: { 'flex-basis': '100%', ...(grow === 0 ? { 'flex-shrink': '1' } : {}) }
}, children);

const row = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}) =>
  N('row', {}, { d: { gap: '32px', ...css }, t: {}, m: { gap: '24px', ...mobile } }, children);

const section = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}, tag = 'section') =>
  N('section', { tag }, {
    d: { ...BOX('112px', '40px', '112px', '40px'), ...css },
    t: { ...BOX('84px', '28px', '84px', '28px') },
    m: { ...BOX('64px', '20px', '64px', '20px'), ...mobile }
  }, children);

const image = (src: string, alt: string, width: number, height: number, css: Record<string, string>, mobile: Record<string, string> = {}, lazy = true) =>
  N('image', { src, alt, w: String(width), h: String(height), lazy: lazy ? 1 : 0 }, {
    d: { width: '100%', 'border-radius': '0px', 'object-fit': 'cover', ...css }, t: {}, m: mobile
  });

const intro = (label: string, title: string, copy: string) => N('box', { layout: 'block' }, { d: { 'max-width': '820px' }, t: {}, m: {} }, [
  text(`<p>${label}</p>`, 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '12px' }, t: {}, m: {} }),
  heading(title, 'title', 'h2', { d: { 'max-width': '22ch' }, t: {}, m: {} }),
  text(`<p>${copy}</p>`, 'lead', { d: { 'max-width': '52ch', 'margin-top': '24px' }, t: {}, m: { 'margin-top': '20px' } })
]);

const serviceLedger = (items: Array<[string, string, string]>) => N('box', { layout: 'block' }, { d: { 'margin-top': '52px' }, t: {}, m: { 'margin-top': '36px' } }, items.map(([number, name, copy], index) =>
  row([
    column(12, [text(`<p>${number}</p>`, 'small', { d: { color: C('brand'), 'font-weight': '700' }, t: {}, m: {} })]),
    column(30, [heading(name, 'subtitle', 'h3')]),
    column(58, [text(`<p>${copy}</p>`, 'body', { d: { 'max-width': '52ch' }, t: {}, m: {} })])
  ], {
    'align-items': 'flex-start', gap: '24px', padding: '28px 0',
    ...(index ? { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line') } : {})
  })
));

const processPath = () => row([
  ['01', 'Listen closely', 'We begin with the offer, the audience, and the decisions the work must support.'],
  ['02', 'Find the system', 'Language, hierarchy, and visual references become one clear creative direction.'],
  ['03', 'Make it real', 'We design the complete experience, then test it against real content and constraints.'],
  ['04', 'Hand it over', 'You receive a coherent system that is useful after launch, not a fragile presentation.']
].map(([n, title, copy]) => column(25, [
  text(`<p>${n}</p>`, 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '32px' }, t: {}, m: { 'margin-bottom': '18px' } }),
  heading(title, 'subtitle', 'h3', { d: { 'margin-bottom': '12px' }, t: {}, m: {} }),
  text(`<p>${copy}</p>`)
], { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line'), 'padding-top': '22px' })), { gap: '28px' });

const header = () => [N('section', { tag: 'header' }, {
  d: { ...BOX('18px', '40px', '18px', '40px'), 'background-color': C('paper'), 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': C('line'), position: 'sticky', top: '0', 'z-index': '50' },
  t: { ...BOX('16px', '28px', '16px', '28px') }, m: { ...BOX('14px', '20px', '14px', '20px') }
}, [row([
  column(28, [N('heading', { text: 'Northline Studio', level: 'div', ts: '' }, { d: { 'font-family': Core.state.meta.headFont, 'font-size': '19px', 'line-height': '1', 'letter-spacing': '-.02em', 'font-weight': '600', color: C('ink') }, t: {}, m: { 'font-size': '17px' } })]),
  column(72, [N('nav', { collapse: '760', aria: 'Main navigation', items: [
    { label: 'About', href: 'about.html' }, { label: 'Services', href: 'services.html' }, { label: 'Contact', href: 'contact.html' }
  ] }, { d: { 'font-size': '14px', color: C('ink'), '--nav-hover': C('brand'), '--nav-gap': '30px', '--nav-panel': C('paper'), 'align-self': 'flex-end' }, t: {}, m: {} })])
], { 'align-items': 'center', 'flex-wrap': 'nowrap', gap: '20px' })])];

const footer = () => [section([
  row([
    column(64, [heading('Good work starts with a clear conversation.', 'title', 'h2', { d: { color: C('paper'), 'max-width': '18ch' }, t: {}, m: {} }), N('row', {}, { d: { 'margin-top': '30px' }, t: {}, m: {} }, [column(0, [button('Start a project', 'contact.html')])])]),
    column(18, [text('<p><a href="index.html">Home</a><br><a href="about.html">About</a><br><a href="services.html">Services</a><br><a href="contact.html">Contact</a></p>', 'small', { d: { color: C('paper-muted'), '--link': C('paper'), 'line-height': '2.1' }, t: {}, m: {} })]),
    column(18, [text('<p>Available for identity, digital, and editorial projects.<br><br><a href="mailto:hello@northline.studio">hello@northline.studio</a></p>', 'small', { d: { color: C('paper-muted'), '--link': C('paper'), 'line-height': '1.8' }, t: {}, m: {} })])
  ], { 'align-items': 'flex-start', gap: '44px' }),
  heading('Northline', 'display', 'h2', { d: { color: C('paper'), 'font-size': 'clamp(52px, 8vw, 104px)', 'line-height': '.84', 'letter-spacing': '-.06em', 'margin-top': '72px' }, t: {}, m: { 'font-size': 'clamp(48px, 15vw, 72px)', 'margin-top': '44px' } }),
  row([column(50, [text('<p>Independent studio / thoughtful systems</p>', 'small', { d: { color: C('paper-muted') }, t: {}, m: {} })]), column(50, [text('<p>© 2026 Northline Studio</p>', 'small', { d: { color: C('paper-muted'), 'text-align': 'right' }, t: {}, m: { 'text-align': 'left' } })])], { 'margin-top': '36px', 'padding-top': '22px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': '#373937' })
], { 'background-color': C('ink') }, {}, 'footer')];

const home = (): Page => ({
  id: 'page-home', name: 'Home', slug: 'index', title: 'Northline Studio — Clear ideas, carefully made',
  desc: 'An independent creative studio shaping identities, digital experiences, and useful visual systems.',
  ogImage: 'asset:northline-hero', tree: [
    section([row([
      column(54, [text('<p>Independent creative studio</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '18px' }, t: {}, m: {} }), heading('Clear ideas, carefully made.', 'display', 'h1', { d: { 'font-size': 'clamp(48px, 7vw, 92px)', 'max-width': '11ch', 'margin-bottom': '30px' }, t: {}, m: { 'font-size': '45px' } }), text('<p>Northline turns complex offers into identities and digital experiences people can understand, trust, and use.</p>', 'lead', { d: { 'max-width': '40ch', 'margin-bottom': '34px' }, t: {}, m: {} }), row([column(0, [button('See our approach', 'about.html')]), column(0, [button('View services', 'services.html', false)])], { gap: '12px' })]),
      column(46, [image('asset:northline-hero', 'A studio worktable with sketches, material samples, and an architectural paper model', 1800, 1152, { height: '610px' }, { height: '360px' }, false)])
    ], { 'align-items': 'flex-end', gap: '56px' })], { 'background-color': C('paper') }),
    section([intro('What we do', 'A small studio for work that needs a point of view.', 'We bring strategy, writing, and design into the same room. The result is not a collection of deliverables, but a system that feels unmistakably yours and stays useful as you grow.'), serviceLedger([
      ['01', 'Identity systems', 'Positioning, verbal direction, visual identity, and practical brand tools built around the decisions your team actually makes.'],
      ['02', 'Digital experiences', 'Websites and product surfaces with clear journeys, expressive typography, and an implementation-ready design system.'],
      ['03', 'Editorial direction', 'Campaigns, publications, and launch materials shaped around one strong narrative instead of disconnected content.']
    ])], { 'background-color': C('surface') }),
    section([text('<p>How the work moves</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '14px' }, t: {}, m: {} }), heading('From first question to a system you can use.', 'title', 'h2', { d: { 'max-width': '20ch', 'margin-bottom': '54px' }, t: {}, m: {} }), processPath()], { 'background-color': C('paper') }),
    section([row([
      column(44, [heading('Have a project that needs more clarity?', 'title', 'h2', { d: { 'max-width': '18ch' }, t: {}, m: {} })]),
      column(56, [text('<p>Tell us what is changing, what feels unresolved, and where you need the work to lead. We will reply with the right next conversation.</p>', 'lead', { d: { 'max-width': '42ch', 'margin-bottom': '28px' }, t: {}, m: {} }), button('Start a conversation', 'contact.html')])
    ], { 'align-items': 'flex-start', gap: '64px' })], { 'background-color': C('mist') })
  ]
});

const about = (): Page => ({
  id: 'page-about', name: 'About', slug: 'about', title: 'About — Northline Studio',
  desc: 'Why Northline works across strategy, language, and visual design as one connected practice.',
  ogImage: 'asset:northline-about', tree: [
    section([row([
      column(48, [text('<p>About Northline</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '18px' }, t: {}, m: {} }), heading('We make the complicated feel inevitable.', 'display', 'h1', { d: { 'max-width': '12ch', 'margin-bottom': '28px' }, t: {}, m: {} }), text('<p>The studio is built around a simple belief: the strongest visual work begins before the visuals. We listen for what matters, name it clearly, and give it a form that can last.</p>', 'lead', { d: { 'max-width': '42ch' }, t: {}, m: {} })]),
      column(52, [image('asset:northline-about', 'Hands arranging paper studies and material samples on a studio wall', 1100, 1375, { height: '700px' }, { height: '470px' }, false)])
    ], { 'align-items': 'center', gap: '64px' })]),
    section([intro('Our point of view', 'Strategy should be visible in the finished work.', 'A good idea should shape every choice: the words, the proportions, the way a page moves, and what is left out. That is why we do not divide discovery from design or identity from implementation.'), N('box', { layout: 'block' }, { d: { 'margin-top': '64px', 'max-width': '780px', 'margin-left': 'auto' }, t: {}, m: { 'margin-top': '40px', 'margin-left': '0' } }, [
      heading('The studio stays deliberately small.', 'subtitle', 'h3', { d: { 'margin-bottom': '14px' }, t: {}, m: {} }),
      text('<p>You work directly with the people making the work. When a specialist is useful, we bring in trusted collaborators for photography, development, motion, or production—without building layers between the question and the answer.</p>'),
      heading('Clarity is part of the craft.', 'subtitle', 'h3', { d: { 'margin-top': '38px', 'margin-bottom': '14px' }, t: {}, m: {} }),
      text('<p>We explain the reasoning, keep decisions visible, and leave you with tools your team can actually use. The handover matters as much as the reveal.</p>')
    ])], { 'background-color': C('surface') }),
    section([text('<p>Principles</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '14px' }, t: {}, m: {} }), heading('A few things we protect in every project.', 'title', 'h2', { d: { 'max-width': '22ch', 'margin-bottom': '48px' }, t: {}, m: {} }), serviceLedger([
      ['01', 'Meaning before styling', 'A visual direction earns its place by making the idea clearer, not by borrowing whatever is fashionable.'],
      ['02', 'Restraint with character', 'We edit until the work is calm enough to use and distinctive enough to remember.'],
      ['03', 'Systems that stay human', 'Consistency should make a team faster without flattening the judgment that gives the work life.']
    ])], { 'background-color': C('paper') })
  ]
});

const services = (): Page => ({
  id: 'page-services', name: 'Services', slug: 'services', title: 'Services — Northline Studio',
  desc: 'Identity, digital, and editorial engagements designed as connected systems.',
  ogImage: 'asset:northline-services', tree: [
    section([text('<p>Services</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '18px' }, t: {}, m: {} }), heading('The right shape for the problem.', 'display', 'h1', { d: { 'max-width': '15ch', 'margin-bottom': '26px' }, t: {}, m: {} }), text('<p>Each engagement is assembled around the decisions you need to make—not a predetermined list of outputs.</p>', 'lead', { d: { 'max-width': '48ch', 'margin-bottom': '52px' }, t: {}, m: {} }), image('asset:northline-services', 'A studio workbench showing drawings, material samples, measuring tools, and a paper model', 1600, 1067, { height: '650px' }, { height: '330px' }, false)]),
    section([intro('Ways to work together', 'One connected practice, three useful entry points.', 'Some projects begin with a name. Others begin with a website that no longer fits, or a launch that needs a coherent story. Wherever we enter, we look for the system beneath the request.'), serviceLedger([
      ['01', 'Identity', 'Positioning and creative direction / naming and verbal principles / visual identity / guidelines and launch tools'],
      ['02', 'Digital', 'Experience strategy / information architecture / copy direction / interface design / responsive design system / developer handoff'],
      ['03', 'Editorial', 'Campaign narrative / publication systems / art direction / launch stories / presentation and sales materials']
    ])], { 'background-color': C('surface') }),
    section([row([
      column(36, [text('<p>How we scope</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '14px' }, t: {}, m: {} }), heading('Enough structure to move. Enough room to discover.', 'title', 'h2')]),
      column(64, [text('<p>After a short conversation, we propose a focused engagement with a clear outcome, working rhythm, and decision points. Most projects move through discovery, direction, design, and handover—but the depth of each stage follows the actual problem.</p>', 'lead', { d: { 'max-width': '50ch' }, t: {}, m: {} }), N('divider', {}, { d: { 'border-top-color': C('line'), 'margin': '34px 0' }, t: {}, m: {} }), text('<p>Need only one piece of the process? Tell us. A useful scope is more important than a large one.</p>', 'body', { d: { 'max-width': '52ch', 'margin-bottom': '28px' }, t: {}, m: {} }), button('Discuss your project', 'contact.html')])
    ], { 'align-items': 'flex-start', gap: '72px' })], { 'background-color': C('paper') })
  ]
});

const contact = (): Page => ({
  id: 'page-contact', name: 'Contact', slug: 'contact', title: 'Contact — Northline Studio',
  desc: 'Start a thoughtful conversation with Northline Studio about your next identity, digital, or editorial project.',
  ogImage: 'asset:northline-contact', tree: [
    section([row([
      column(52, [text('<p>Contact</p>', 'small', { d: { color: C('brand'), 'font-weight': '700', 'margin-bottom': '18px' }, t: {}, m: {} }), heading('Tell us what needs to become clearer.', 'display', 'h1', { d: { 'max-width': '12ch', 'margin-bottom': '28px' }, t: {}, m: {} }), text('<p>A useful first note includes what you are making, why now, and where the work feels unresolved. We will reply within two working days.</p>', 'lead', { d: { 'max-width': '42ch', 'margin-bottom': '34px' }, t: {}, m: {} }), button('Email the studio', 'mailto:hello@northline.studio?subject=Project%20inquiry')]),
      column(48, [N('box', { layout: 'block' }, { d: { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('ink'), padding: '26px 0' }, t: {}, m: {} }, [heading('New projects', 'subtitle', 'h2', { d: { 'margin-bottom': '12px' }, t: {}, m: {} }), text('<p>Identity, digital, editorial, or a connected engagement.</p><p><a href="mailto:hello@northline.studio">hello@northline.studio</a></p>', 'body', { d: { '--link': C('brand') }, t: {}, m: {} })]), N('box', { layout: 'block' }, { d: { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line'), padding: '26px 0' }, t: {}, m: {} }, [heading('Collaborations', 'subtitle', 'h2', { d: { 'margin-bottom': '12px' }, t: {}, m: {} }), text('<p>Photography, development, motion, production, or an unusual brief.</p><p><a href="mailto:collaborate@northline.studio">collaborate@northline.studio</a></p>', 'body', { d: { '--link': C('brand') }, t: {}, m: {} })])])
    ], { 'align-items': 'flex-start', gap: '72px' })]),
    section([image('asset:northline-contact', 'A quiet studio meeting table in warm late-afternoon light with a sketchbook and blue glass sample', 1800, 1013, { height: '620px' }, { height: '320px' })], { 'background-color': C('ink') }),
    section([N('box', { layout: 'block' }, { d: { 'max-width': '760px' }, t: {}, m: {} }, [
      heading('Before you write', 'title', 'h2'),
      text('<p>There is no formal brief required. A few honest sentences are enough. If another studio or specialist is a better fit, we will say so.</p>', 'lead', { d: { 'max-width': '44ch', 'margin-top': '24px' }, t: {}, m: { 'margin-top': '20px' } })
    ])], { 'background-color': C('surface') })
  ]
});

export function buildIndependentStudioDocument(): Doc {
  Core.seed();
  const tokens = Core.defaultTokens();
  const palette: Record<string, string> = {
    bg: '#f1ede3', paper: '#f1ede3', text: '#1c211f', ink: '#151917', brand: '#1e4ed8',
    muted: '#626862', 'muted-i': '#b8beb7', slate: '#626862', line: '#d4d0c5',
    surface: '#fbfaf6', mist: '#e2e7e2', 'paper-muted': '#aeb5ae'
  };
  for (const color of tokens.colors) if (palette[color.id]) color.value = palette[color.id];
  for (const [id, name, value] of [['paper', 'Warm paper', palette.paper], ['mist', 'Soft mineral', palette.mist], ['paper-muted', 'Muted on ink', palette['paper-muted']]]) {
    if (!tokens.colors.some(color => color.id === id)) tokens.colors.push({ id, name, value });
  }
  const eyebrow = tokens.text.find(style => style.id === 'eyebrow');
  if (eyebrow) eyebrow.css.d['font-size'] = '14px';
  const body = tokens.text.find(style => style.id === 'body');
  if (body) { body.css.d['font-size'] = '17px'; body.css.m['font-size'] = '16px'; }
  const lead = tokens.text.find(style => style.id === 'lead');
  if (lead) { lead.css.d['font-size'] = '19px'; lead.css.m['font-size'] = '17px'; }
  Core.state.meta = {
    ...Core.state.meta,
    name: 'Northline Studio', maxWidth: '1200px', size: '17px', lang: 'en',
    font: '"Avenir Next",Avenir,"Helvetica Neue",Arial,sans-serif',
    headFont: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
    css: '::selection{background:#1e4ed8;color:#f1ede3}', headHtml: '', baseUrl: '',
    ogImage: 'asset:northline-hero', favicon: '', blocks: [], components: [], collections: [],
    selfHostFonts: 0, tokens
  };
  Core.state.header = header();
  Core.state.footer = footer();
  Core.state.pages = [home(), about(), services(), contact()];
  Core.state.cur = 0;
  const document = structuredClone(Core.doc());
  let nodeIndex = 0;
  const assignStableIds = (nodes: Node[]) => {
    for (const node of nodes) {
      node.id = `northline-node-${String(++nodeIndex).padStart(4, '0')}`;
      if (node.children?.length) assignStableIds(node.children);
    }
  };
  assignStableIds(document.header);
  for (const page of document.pages) assignStableIds(page.tree);
  assignStableIds(document.footer);
  return document;
}
