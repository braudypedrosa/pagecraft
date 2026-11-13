import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';

type Style = Record<string, string>;
let serial = 0;
const token = Core.cvar;

const node = (
  name: string,
  type: string,
  props: Record<string, unknown> = {},
  desktop: Style = {},
  children: Node[] = [],
  mobile: Style = {},
  tablet: Style = {},
): Node => {
  const value = Core.N(type, props, { d: desktop, t: tablet, m: mobile }, children);
  value.id = `mossline-${name}-${++serial}`;
  if (type === 'nav' || name === 'footer-links') value.css.d.width = 'auto';
  if (type === 'image') {
    value.props.w = name.includes('logo') ? '620' : '1536';
    value.props.h = name.includes('logo') ? '132' : '1024';
  }
  return value;
};

const box = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'box', { layout: desktop.display === 'grid' ? 'grid' : desktop.display === 'flex' ? 'flex' : 'block' }, desktop, children, mobile, tablet);

const text = (copy: string, ts = 'body', level = 'p', desktop: Style = {}, mobile: Style = {}) =>
  node('text', 'heading', { text: copy, ts, level }, { margin: '0', ...desktop }, [], mobile);

const section = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'section', {}, { padding: '92px 48px', ...desktop }, children, { padding: '58px 22px', ...mobile }, { padding: '72px 32px', ...tablet });

const grid = (
  name: string,
  children: Node[],
  columns = '1fr 1fr',
  gap = '48px',
  desktop: Style = {},
  mobile: Style = {},
  tablet: Style = {},
) => box(
  name,
  children,
  { display: 'grid', 'grid-template-columns': columns, gap, ...desktop },
  { 'grid-template-columns': '1fr', gap: '30px', ...mobile },
  { 'grid-template-columns': '1fr', gap: '38px', ...tablet },
);

const image = (asset: string, alt: string, height = '500px', mobileHeight = '320px') =>
  node(asset, 'image', { src: `asset:${asset}`, alt, lazy: 0 }, { display: 'block', width: '100%', height, 'object-fit': 'cover', 'border-radius': '0' }, [], { height: mobileHeight }, { height: '420px' });

const button = (label: string, href: string, quiet = false) => {
  const value = node('button', 'button', { text: label, link: href, ts: 'btn', variant: quiet ? 'outline' : 'primary' }, {
    padding: '14px 22px',
    'min-height': '48px',
    'border-radius': '0',
    'border-width': '1px',
    'border-color': quiet ? token('cream') : token('rose'),
    'background-color': quiet ? 'transparent' : token('rose'),
    color: token('cream'),
    'align-self': 'start',
    transition: 'background-color 180ms ease,color 180ms ease',
  });
  value.st = {
    hover: { d: { 'background-color': quiet ? token('cream') : '#783342', color: quiet ? token('pine') : token('cream') }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('focus')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const link = (label: string, href: string, color = token('pine')) => {
  const value = node('link', 'button', { text: label, link: href, ts: 'btn', variant: 'link' }, {
    padding: '10px 0',
    'min-height': '44px',
    'border-width': '0',
    'background-color': 'transparent',
    color,
    'text-decoration': 'underline',
    'text-underline-offset': '6px',
    'align-self': 'start',
  });
  value.st = { focus: { d: { outline: `3px solid ${token('focus')}`, 'outline-offset': '3px' }, t: {}, m: {} } };
  return value;
};

const eyebrow = (copy: string, desktop: Style = {}) => text(copy, 'small', 'p', {
  'text-transform': 'uppercase',
  'letter-spacing': '.16em',
  'font-weight': '700',
  ...desktop,
});

const anchor = (value: Node, id: string) => { value.adv.htmlId = id; return value; };
const page = (slug: string, name: string, tree: Node[]): Page => ({
  id: `mossline-page-${slug}`,
  slug,
  name,
  title: `${name} — Mossline Gardens`,
  desc: 'A fictional landscape design studio with illustrative garden imagery and an honest sample service journey.',
  tree,
});

const intro = (label: string, heading: string, copy: string) => section('page-intro', [
  eyebrow(label),
  text(heading, 'display', 'h1', { 'margin-top': '18px', 'max-width': '980px' }),
  text(copy, 'lead', 'p', { 'margin-top': '24px', 'max-width': '60ch', color: token('text') }),
], { padding: '54px 48px 76px' }, { padding: '38px 22px 54px' });

const study = (asset: string, label: string, title: string, copy: string, alt: string) => box('study', [
  image(asset, alt, '430px', '290px'),
  box('study-copy', [
    eyebrow(label, { color: token('rose') }),
    text(title, 'subtitle', 'h3', { 'margin-top': '12px' }),
    text(copy, 'body', 'p', { 'margin-top': '14px', 'max-width': '48ch', color: token('text') }),
  ], { 'padding-top': '24px' }),
]);

const phase = (label: string, title: string, copy: string, bordered = false) => box('phase', [
  eyebrow(label, { color: token('rose') }),
  text(title, 'subtitle', 'h3', { 'margin-top': '12px' }),
  text(copy, 'body', 'p', { 'margin-top': '12px', color: token('text'), 'max-width': '52ch' }),
], { padding: '28px 0', ...(bordered ? { 'border-top': `1px solid ${token('line')}` } : {}) });

const serviceRow = (title: string, copy: string, detail: string, bordered = false) => box('service-row', [
  text(title, 'subtitle', 'h2'),
  text(copy, 'body', 'p', { color: token('text') }),
  text(detail, 'body', 'p', { color: token('muted'), 'font-size': '16px' }),
], {
  display: 'grid',
  'grid-template-columns': '.8fr 1.35fr 1fr',
  gap: '44px',
  padding: '30px 0',
  'align-items': 'start',
  ...(bordered ? { 'border-top': `1px solid ${token('line')}` } : {}),
}, { 'grid-template-columns': '1fr', gap: '14px' }, { 'grid-template-columns': '1fr', gap: '14px' });

function hero(): Node {
  const garden = image('meadow-garden', 'Illustrative layered meadow garden with a pale stone path at dawn', '690px', '360px');
  garden.css.t.height = '470px';
  const value = section('hero', [
    grid('hero-grid', [
      garden,
      box('hero-panel', [
        eyebrow('Landscape design for everyday ground.', { color: token('mist') }),
        text('Gardens shaped by the way you live.', 'display', 'h1', { color: token('cream'), 'margin-top': '20px', 'font-size': '66px' }, { 'font-size': '43px' }),
        text('From planting-led courtyards to generous family gardens, we shape outdoor spaces around how people move, gather and live.', 'lead', 'p', { color: token('mist'), 'margin-top': '24px', 'max-width': '40ch' }),
        box('hero-actions', [button('Explore services', 'services.html'), button('See garden studies', 'gardens.html', true)], { display: 'flex', 'flex-wrap': 'wrap', gap: '14px', 'margin-top': '32px' }),
      ], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', padding: '72px 58px', 'background-color': token('pine') }, { padding: '44px 24px' }, { padding: '54px 40px' }),
    ], '1.35fr .85fr', '0', {}, {}, {}),
  ], { padding: '0', 'background-color': token('pine') }, { padding: '0' }, { padding: '0' });
  value.props.width = 'full';
  return value;
}

function home(): Page {
  return page('index', 'Home', [
    hero(),
    section('home-intro', [
      box('intro-stack', [
        eyebrow('The Mossline approach'),
        text('Start with the ground. Follow the light. Make room for life.', 'title', 'h2', { 'margin-top': '18px', 'max-width': '850px' }),
        text('Soil, shade, water, movement and the moments people want to spend outside become the brief. That close reading keeps materials purposeful and planting connected to place.', 'lead', 'p', { 'margin-top': '24px', 'max-width': '62ch', color: token('text') }),
      ], { 'max-width': '980px' }),
    ]),
    section('service-preview', [
      grid('service-preview-intro', [
        text('Three ways to shape a place.', 'title', 'h2'),
        box('service-preview-copy', [
          text('Each scope begins with the site conditions and the decision that needs to become clearer.', 'body', 'p', { color: token('text') }),
          link('Read the full service guide', 'services.html'),
        ]),
      ], '.75fr 1.25fr', '72px', { 'align-items': 'end' }),
      box('service-bands', [
        serviceRow('Garden direction', 'A focused design study for layout, material character and planting intent.', 'Example outputs: site reading, concept plan and next-step brief.'),
        serviceRow('Planting design', 'A planting-led plan shaped by aspect, soil, season and maintenance capacity.', 'Example outputs: palette, planting plan and establishment notes.', true),
        serviceRow('Full garden design', 'A coordinated spatial proposal from early brief through a documented design package.', 'Example outputs: scope depends on region, site and project team.', true),
      ], { 'margin-top': '48px' }),
    ], { 'background-color': token('soft') }),
    section('garden-pair', [
      box('pair-heading', [
        eyebrow('Illustrative garden studies'),
        text('Different ground. Different answer.', 'title', 'h2', { 'margin-top': '18px' }),
        text('These generated scenes demonstrate image roles and editorial captions. They are not completed Mossline projects.', 'body', 'p', { 'margin-top': '18px', 'max-width': '58ch', color: token('text') }),
      ]),
      grid('study-pair', [
        study('courtyard-garden', 'Illustrative study · shade', 'Brick courtyard', 'A small enclosed place organized around leaf texture, rain-darkened clay and one long seat.', 'Illustrative brick courtyard with shade planting, bench and ceramic vessel after rain'),
        study('roof-terrace', 'Illustrative study · exposure', 'Roof terrace', 'Deep planters and simple timber seating make shelter without closing out the evening sky.', 'Illustrative city roof terrace with timber seating, grasses and small trees at sunset'),
      ], '1fr 1fr', '34px', { 'margin-top': '42px' }, {}, { 'grid-template-columns': '1fr 1fr', gap: '26px' }),
      box('study-link', [link('Browse all garden studies', 'gardens.html')], { 'margin-top': '30px' }),
    ]),
    section('studio-process', [
      grid('process-grid', [
        image('studio-plan', 'Illustrative landscape studio worktable with planting plan, leaves, stone and gravel samples', '570px', '330px'),
        box('process-copy', [
          eyebrow('A visible process'),
          text('From a place observed to a garden understood.', 'title', 'h2', { 'margin-top': '18px' }),
          phase('Read', 'Notice what is already working.', 'Begin with use, access, aspect, soil, water and the character worth keeping.'),
          phase('Draw', 'Give the choices a clear shape.', 'Test paths, thresholds, planting structure and practical constraints in plain language.', true),
          phase('Grow', 'Plan for change through time.', 'Explain establishment, care and how the garden can adapt as plants mature.', true),
        ]),
      ], '1.15fr .85fr', '74px', { 'align-items': 'start' }),
    ], { 'background-color': token('cream') }),
    photoCta(),
  ]);
}

function photoCta(): Node {
  const scene = image('woodland-path', 'Illustrative woodland-edge garden with gravel path, rain garden and timber gate', '520px', '420px');
  scene.css.d = { ...scene.css.d, position: 'absolute', inset: '0', height: '100%' };
  scene.css.t = { ...scene.css.t, position: 'absolute', inset: '0', height: '100%' };
  scene.css.m = { ...scene.css.m, position: 'absolute', inset: '0', height: '100%' };
  const value = section('photo-cta', [
    scene,
    box('photo-shade', [], { position: 'absolute', inset: '0', 'background-color': 'rgba(18,50,36,.78)' }),
    box('photo-cta-copy', [
      eyebrow('Have a place in mind?', { color: token('mist') }),
      text('Begin with what the garden needs to hold.', 'title', 'h2', { color: token('cream'), 'margin-top': '18px', 'max-width': '720px' }),
      text('Share the site, its current condition and the change you want the garden to make possible.', 'body', 'p', { color: token('mist'), 'margin-top': '20px', 'max-width': '54ch' }),
      button('Start a quote inquiry', 'contact.html'),
    ], { position: 'relative', 'z-index': '1', 'max-width': '900px', padding: '72px 0', display: 'flex', 'flex-direction': 'column' }, { padding: '46px 0' }),
  ], { position: 'relative', overflow: 'hidden', 'min-height': '520px', display: 'flex', 'align-items': 'center', 'background-color': token('pine') }, { 'min-height': '420px' });
  value.props.width = 'full';
  return value;
}

function services(): Page {
  const faq = node('service-faq', 'accordion', {
    open: '0', single: 1, marker: 'plus',
    items: [
      { q: 'What should a first inquiry include?', a: 'Describe the location, approximate area, current condition, who uses the space, intended timing and the decisions you need help making. Do not send sensitive documents through an unconfigured form.' },
      { q: 'Does the sample price a project?', a: 'No. The template gives no price estimate. Fees, taxes, consultant roles and construction responsibilities vary by studio, place and project.' },
      { q: 'Is build work included?', a: 'No construction or maintenance service is claimed in this demo. Design documentation, permissions, contractor appointment and site oversight are separate responsibilities.' },
      { q: 'Can the planting be low maintenance?', a: 'Every garden needs care. Maintenance depends on the site, irrigation, establishment period, plant choices and acceptable seasonal change.' },
    ],
  }, { '--ac-q-size': '19px', '--ac-a-size': '17px', '--ac-q-color': token('pine'), '--ac-a-color': token('text'), '--ac-pad': '22px', '--ac-line': token('line') });

  return page('services', 'Services', [
    intro('Services', 'A design scope should make the next decision easier.', 'From a planting plan to a complete garden, choose a scope that fits the place, the people who use it, and the decisions ahead.'),
    section('service-ledger', [
      serviceRow('Garden direction', 'A compact study for clients who need a clear spatial and material direction before committing to a larger scope.', 'Possible outputs: site reading, concept plan, mood and next-step brief.'),
      serviceRow('Planting design', 'A planting proposal responding to aspect, soil, water, season, biodiversity goals and available care.', 'Possible outputs: planting palette, plan, schedule and establishment notes.', true),
      serviceRow('Full garden design', 'A coordinated landscape proposal that can bring together layout, levels, materials, planting and specialist input.', 'Exact stages, permissions and construction roles must be agreed for each project.', true),
      serviceRow('Garden review', 'A walk-through and written priorities for an existing garden that feels unclear, underused or hard to care for.', 'Possible outputs: observations, priorities and an editable action list.', true),
    ], { 'background-color': token('soft'), padding: '42px 48px' }, { padding: '30px 22px' }),
    section('service-process', [
      grid('service-process-grid', [
        image('studio-plan', 'Illustrative hands reviewing a planting plan with stone, gravel and foliage samples', '560px', '330px'),
        box('service-process-copy', [
          eyebrow('Before a drawing'),
          text('A useful brief has edges.', 'title', 'h2', { 'margin-top': '18px' }),
          text('Bring the site, the people who use it, the practical constraints and the change you hope to make. A responsible studio should also explain exclusions, decision points and who owns each next step.', 'lead', 'p', { 'margin-top': '22px', color: token('text') }),
          link('Prepare a quote inquiry', 'contact.html'),
        ]),
      ], '1.1fr .9fr', '72px', { 'align-items': 'center' }),
    ]),
    section('service-questions', [
      grid('faq-grid', [
        box('faq-intro', [
          eyebrow('Practical questions'),
          text('Clear before work begins.', 'title', 'h2', { 'margin-top': '18px' }),
          text('Straight answers help people understand fit, responsibility and what happens next.', 'body', 'p', { 'margin-top': '18px', color: token('text') }),
        ]),
        faq,
      ], '.7fr 1.3fr', '86px', { 'align-items': 'start' }),
    ], { 'background-color': token('cream') }),
    photoCta(),
  ]);
}

function gardens(): Page {
  return page('gardens', 'Gardens', [
    intro('Illustrative garden studies', 'Gardens imagined to show a way of thinking.', 'Every image and narrative on this page is demonstration material generated for the template. Nothing here represents a completed commission, client, location or measured project outcome.'),
    section('featured-study', [
      image('meadow-garden', 'Illustrative meadow garden with stone path, layered grasses and multi-stem trees at dawn', '650px', '390px'),
      grid('featured-caption', [
        box('featured-title', [eyebrow('Illustrative study · open ground', { color: token('rose') }), text('Meadow edge', 'title', 'h2', { 'margin-top': '14px' })]),
        box('featured-copy', [text('A broad path moves through clipped evergreen structure and loose grasses. The study explores a garden that can feel generous without relying on a large lawn.', 'lead', 'p', { color: token('text') }), text('Demonstration image · not a real property, client or completed project.', 'small', 'p', { 'margin-top': '20px', color: token('muted') })]),
      ], '.75fr 1.25fr', '72px', { 'margin-top': '34px', 'align-items': 'start' }),
    ], { padding: '0 48px 92px' }, { padding: '0 22px 58px' }),
    section('paired-studies', [
      grid('garden-study-pair', [
        study('courtyard-garden', 'Illustrative study · shade', 'Brick courtyard', 'Leaf scale, old brick and one long seat make a small place feel settled after rain.', 'Illustrative enclosed brick courtyard with layered shade planting and a long timber bench'),
        study('roof-terrace', 'Illustrative study · wind', 'Evening terrace', 'Sheltered planting bands and continuous seating turn an exposed roof into a simple outdoor room.', 'Illustrative planted roof terrace with timber seating and pergola in evening light'),
      ], '1fr 1fr', '34px', {}, {}, { 'grid-template-columns': '1fr 1fr', gap: '26px' }),
    ], { 'background-color': token('soft') }),
    section('path-study', [
      grid('path-study-grid', [
        box('path-copy', [
          eyebrow('Illustrative study · water and movement', { color: token('rose') }),
          text('Woodland path', 'title', 'h2', { 'margin-top': '16px' }),
          text('A gravel route follows the edge of a small rain garden toward a timber gate. Meadow planting holds the path loosely and makes seasonal change part of the composition.', 'lead', 'p', { 'margin-top': '22px', color: token('text') }),
          text('Demonstration image · maintenance, drainage performance and plant suitability are not verified for a real site.', 'small', 'p', { 'margin-top': '22px', color: token('muted') }),
          link('Discuss your own site', 'contact.html'),
        ]),
        image('woodland-path', 'Illustrative gravel garden path beside a small rain garden at a woodland edge', '560px', '350px'),
      ], '.8fr 1.2fr', '76px', { 'align-items': 'center' }),
    ]),
    photoCta(),
  ]);
}

function contact(): Page {
  const quoteForm = node('quote-form', 'form', {
    mode: 'external', action: '', method: 'post', aria: 'Garden quote inquiry', submit: 'Send quote inquiry',
    fields: [
      { label: 'Name', name: 'name', type: 'text', required: 1, half: 1 },
      { label: 'Email', name: 'email', type: 'email', required: 1, half: 1 },
      { label: 'Project type', name: 'project-type', type: 'select', opts: 'Not sure yet,Garden direction,Planting design,Full garden design,Garden review', required: 0, half: 1 },
      { label: 'Approximate garden size', name: 'garden-size', type: 'select', opts: 'Not sure,Under 100 square metres,100–500 square metres,Over 500 square metres', required: 0, half: 1 },
      { label: 'Project location or region', name: 'region', type: 'text', required: 1 },
      { label: 'What would you like the garden to make room for?', name: 'message', type: 'textarea', required: 1 },
    ],
  }, {
    '--f-bg': token('cream'), '--f-border': token('line'), '--f-text': token('pine'), '--f-btn-bg': token('rose'), '--f-btn-fg': token('cream'), '--f-radius': '0', '--f-gap': '16px', '--f-control-height': '48px', 'font-size': '17px',
  });

  return page('contact', 'Contact', [
    intro('Quote inquiry', 'Begin with the place, not a sales pitch.', 'Share enough context to help a real studio understand the site and the decision ahead. Do not send sensitive documents until a secure process has been agreed.'),
    anchor(section('quote-area', [
      grid('quote-grid', [
        box('quote-context', [
          image('studio-plan', 'Illustrative landscape design plan surrounded by leaves, stone and soil samples', '350px', '270px'),
          text('This form is not connected.', 'subtitle', 'h2', { 'margin-top': '26px' }),
          text('Mossline Gardens is fictional. No recipient is configured, so this form cannot deliver a request.', 'body', 'p', { 'margin-top': '16px', color: token('text') }),
          text('No real email address, phone number, office address or response-time promise is shown.', 'small', 'p', { 'margin-top': '20px', color: token('muted') }),
        ]),
        quoteForm,
      ], '.75fr 1.25fr', '78px', { 'align-items': 'start' }),
    ], { padding: '0 48px 92px' }, { padding: '0 22px 58px' }), 'quote'),
    section('contact-prep', [
      grid('prep-grid', [
        text('A useful first note covers four things.', 'title', 'h2'),
        box('prep-list', [
          phase('Place', 'Where is the garden?', 'Name the region and describe access, aspect and the broad site condition.'),
          phase('Use', 'Who needs the garden to work for?', 'Include everyday routines, access needs, privacy and the moments you want outside.', true),
          phase('Change', 'What feels unresolved?', 'Explain the practical problem or opportunity rather than prescribing a finished answer.', true),
          phase('Timing', 'What is driving the next decision?', 'Share intended timing and any known permissions, contractors or related building work.', true),
        ]),
      ], '.75fr 1.25fr', '82px', { 'align-items': 'start' }),
    ], { 'background-color': token('soft') }),
  ]);
}

function normalize(nodes: Node[]): void {
  for (const value of nodes) {
    for (const breakpoint of ['d', 't', 'm'] as const) {
      const output: Style = {};
      for (const [key, raw] of Object.entries(value.css[breakpoint])) {
        if (key === 'padding' || key === 'margin') {
          const parts = String(raw).trim().split(/\s+/);
          const expanded = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]];
          ['top', 'right', 'bottom', 'left'].forEach((side, index) => { output[`${key}-${side}`] = expanded[index]; });
        } else output[key] = String(raw);
      }
      value.css[breakpoint] = output;
    }
    normalize(value.children);
  }
}

export function buildTemplateDocument(): Doc {
  Core.seed();
  serial = 0;
  const tokens = Core.defaultTokens();
  const palette: Record<string, [string, string]> = {
    bg: ['Garden mist', '#f3f6ef'],
    cream: ['Limestone', '#fffdf6'],
    pine: ['Deep pine', '#173c2c'],
    text: ['Body green', '#354b3e'],
    rose: ['Seed pink', '#9b4050'],
    soft: ['Soft leaf', '#dfe9dc'],
    mist: ['Pale moss', '#d4dfd1'],
    muted: ['Secondary text', '#515d54'],
    line: ['Garden line', '#b8c8b8'],
    focus: ['Focus gold', '#f0bd54'],
  };
  tokens.colors = Object.entries(palette).map(([id, [name, value]]) => ({ id, name, value }));
  const sizes: Record<string, [string, string, string]> = {
    display: ['78px', '58px', '43px'],
    title: ['47px', '39px', '32px'],
    subtitle: ['27px', '25px', '23px'],
    lead: ['22px', '21px', '19px'],
    body: ['18px', '18px', '17px'],
    small: ['14px', '14px', '13px'],
    btn: ['15px', '15px', '15px'],
  };
  for (const style of tokens.text) {
    if (!sizes[style.id]) continue;
    style.css = {
      d: {
        'font-family': ['display', 'title', 'subtitle'].includes(style.id) ? Core.stackFor('Outfit', 's') : 'inherit',
        'font-size': sizes[style.id][0],
        'font-weight': ['display', 'title'].includes(style.id) ? '500' : '400',
        'line-height': ['display', 'title', 'subtitle'].includes(style.id) ? '1.06' : '1.56',
        'letter-spacing': ['display', 'title'].includes(style.id) ? '-.035em' : '0',
      },
      t: { 'font-size': sizes[style.id][1] },
      m: { 'font-size': sizes[style.id][2] },
    };
  }

  Core.state.meta = {
    ...Core.state.meta,
    name: 'Mossline Gardens',
    lang: 'en',
    maxWidth: '1380px',
    size: '18px',
    font: Core.stackFor('Work Sans', 's'),
    headFont: Core.stackFor('Outfit', 's'),
    css: '',
    headHtml: '',
    baseUrl: '',
    ogImage: 'asset:meadow-garden',
    favicon: 'asset:logo',
    blocks: [],
    components: [],
    collections: [],
    selfHostFonts: 0,
    tokens,
  };

  const logo = node('logo', 'image', { src: 'asset:logo', alt: 'Mossline Gardens', link: 'index.html', lazy: 0 }, { width: '262px', height: '56px', 'object-fit': 'contain' }, [], { width: '195px', height: '42px' }, { width: '220px', height: '47px' });
  Core.state.header = [section('header', [
    box('header-row', [
      logo,
      node('navigation', 'nav', {
        collapse: '920', mobileMenu: 'fullscreen', aria: 'Main navigation', menuLocation: 'primary',
        items: [
          { id: 'mossline-menu-services', label: 'Services', href: 'services.html', objectType: 'page', objectId: 'mossline-page-services' },
          { id: 'mossline-menu-gardens', label: 'Gardens', href: 'gardens.html', objectType: 'page', objectId: 'mossline-page-gardens' },
          { id: 'mossline-menu-contact', label: 'Contact', href: 'contact.html', objectType: 'page', objectId: 'mossline-page-contact' },
        ],
      }, { color: token('pine'), 'font-size': '16px', '--nav-gap': '30px', '--nav-panel': token('bg'), '--nav-hover': token('rose') }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '26px' }),
  ], { padding: '18px 48px', 'background-color': token('bg') }, { padding: '14px 22px' }, { padding: '16px 32px' })];

  Core.state.footer = [section('footer', [
    box('footer-row', [
      node('footer-logo', 'image', { src: 'asset:logo', alt: 'Mossline Gardens', link: 'index.html', lazy: 0 }, { width: '245px', height: '52px', 'object-fit': 'contain', filter: 'brightness(0) invert(1)' }, [], { width: '198px', height: '43px' }),
      box('footer-links', [
        link('Home', 'index.html', token('cream')),
        link('Services', 'services.html', token('cream')),
        link('Gardens', 'gardens.html', token('cream')),
        link('Quote inquiry', 'contact.html', token('cream')),
      ], { display: 'flex', 'flex-wrap': 'wrap', gap: '20px' }, { gap: '10px' }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px' }, { 'flex-direction': 'column', 'align-items': 'flex-start' }),
    box('footer-note', [
      text('Fictional demonstration studio · Images are illustrative, not completed client work.', 'small', 'p', { color: token('mist') }),
      text('Mossline Gardens · Pagecraft template', 'small', 'p', { color: token('mist') }),
    ], { display: 'flex', 'justify-content': 'space-between', gap: '20px', 'margin-top': '26px', 'padding-top': '20px', 'border-top': '1px solid #587061' }, { 'flex-direction': 'column' }),
  ], { padding: '40px 48px', 'background-color': token('pine') }, { padding: '36px 22px' }, { padding: '38px 32px' })];

  Core.state.pages = [home(), services(), gardens(), contact()];
  Core.state.cur = 0;
  normalize(Core.state.header);
  normalize(Core.state.footer);
  Core.state.pages.forEach(item => normalize(item.tree));
  return structuredClone(Core.doc());
}
