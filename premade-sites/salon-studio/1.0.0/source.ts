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
  value.id = `morrow-muse-${name}-${++serial}`;
  if (type === 'nav' || name === 'footer-links') value.css.d.width = 'auto';
  if (type === 'image') {
    const dimensions: Record<string, [number, number]> = {
      logo: [720, 180],
      'footer-logo': [720, 180],
      'studio-interior': [1672, 941],
      'texture-craft': [1024, 1536],
      'studio-team': [1536, 1024],
    };
    const [width, height] = dimensions[name] || [1536, 1024];
    value.props.w = width;
    value.props.h = height;
  }
  return value;
};

const box = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'box', { layout: desktop.display === 'grid' ? 'grid' : desktop.display === 'flex' ? 'flex' : 'block' }, desktop, children, mobile, tablet);

const text = (copy: string, textStyle = 'body', level = 'p', desktop: Style = {}, mobile: Style = {}) =>
  node('text', 'heading', { text: copy, ts: textStyle, level }, { margin: '0', ...desktop }, [], mobile);

const section = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'section', {}, { padding: '94px 48px', ...desktop }, children, { padding: '58px 22px', ...mobile }, { padding: '74px 32px', ...tablet });

const grid = (name: string, children: Node[], columns = '1fr 1fr', gap = '48px', desktop: Style = {}, mobile: Style = {}) =>
  box(name, children, { display: 'grid', 'grid-template-columns': columns, gap, ...desktop }, { 'grid-template-columns': '1fr', gap: '30px', ...mobile });

const image = (asset: string, alt: string, height = '520px', mobileHeight = '340px') =>
  node(asset, 'image', { src: `asset:${asset}`, alt, lazy: 0 }, { display: 'block', width: '100%', height, 'object-fit': 'cover', 'border-radius': '0' }, [], { height: mobileHeight });

const button = (label: string, href: string, quiet = false) => {
  const value = node('button', 'button', { text: label, link: href, ts: 'btn', variant: quiet ? 'outline' : 'primary' }, {
    padding: '14px 23px',
    'min-height': '48px',
    'border-radius': '0',
    'border-width': '1px',
    'border-color': token('plum'),
    'background-color': quiet ? 'transparent' : token('plum'),
    color: quiet ? token('plum') : token('paper'),
    'align-self': 'start',
    transition: 'background-color 180ms ease,color 180ms ease,border-color 180ms ease',
  });
  value.st = {
    hover: { d: { 'background-color': quiet ? token('rose') : token('berry'), 'border-color': token('berry') }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('berry')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const link = (label: string, href: string, color = token('ink')) => {
  const value = node('link', 'button', { text: label, link: href, ts: 'btn', variant: 'link' }, {
    padding: '11px 0',
    'min-height': '44px',
    'border-width': '0',
    'background-color': 'transparent',
    color,
    'text-decoration': 'underline',
    'text-underline-offset': '6px',
    'align-self': 'start',
  });
  value.st = { focus: { d: { outline: `3px solid ${token('rose')}`, 'outline-offset': '3px' }, t: {}, m: {} } };
  return value;
};

const lightButton = (label: string, href: string) => {
  const value = button(label, href);
  value.css.d['background-color'] = token('rose');
  value.css.d['border-color'] = token('rose');
  value.css.d.color = token('ink');
  value.st = {
    hover: { d: { 'background-color': token('paper'), 'border-color': token('paper') }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('paper')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const anchor = (value: Node, htmlId: string) => {
  value.adv.htmlId = htmlId;
  return value;
};

const eyebrow = (copy: string, desktop: Style = {}) =>
  text(copy, 'small', 'p', { 'text-transform': 'uppercase', 'letter-spacing': '.17em', 'font-weight': '600', color: token('berry'), ...desktop });

const page = (slug: string, name: string, tree: Node[]): Page => ({
  id: `morrow-muse-page-${slug}`,
  slug,
  name,
  title: `${name} — Morrow & Muse`,
  desc: 'A fictional editorial hair salon demonstration site with editable native Pagecraft content.',
  tree,
});

const intro = (label: string, heading: string, copy: string) => section('page-intro', [
  eyebrow(label),
  text(heading, 'display', 'h1', { 'margin-top': '18px', 'max-width': '920px' }),
  text(copy, 'lead', 'p', { 'margin-top': '24px', 'max-width': '58ch' }),
], { padding: '54px 48px 82px', 'background-color': token('blush') });

const serviceRow = (title: string, scope: string, detail: string, index: number, level = 'h3') => box('service-row', [
  text(title, 'subtitle', level),
  text(scope, 'body', 'p'),
  text(detail, 'small', 'p', { color: token('muted') }),
], {
  display: 'grid',
  'grid-template-columns': '.72fr 1.25fr .8fr',
  gap: '44px',
  padding: '30px 0',
  ...(index ? { 'border-top': `1px solid ${token('line')}` } : {}),
}, { 'grid-template-columns': '1fr', gap: '12px' });

const principle = (title: string, copy: string) => box('principle', [
  text(title, 'subtitle', 'h3'),
  text(copy, 'body', 'p', { 'margin-top': '13px', 'max-width': '44ch' }),
], { 'padding-bottom': '27px', 'border-bottom': `1px solid ${token('line')}` });

function homeHero() {
  const scene = image('studio-interior', 'Editorial view through the warm plaster and plum interior of a fictional hair salon', '660px', '360px');
  const copy = box('hero-copy', [
    eyebrow('Independent hair studio', { color: token('rose') }),
    text('Hair, considered.', 'display', 'h1', { color: token('paper'), 'margin-top': '16px', 'max-width': '650px' }),
    text('Cuts, colour and texture work shaped around how you want to look, move and live.', 'lead', 'p', { color: '#f8edf1', 'margin-top': '22px', 'max-width': '38ch' }),
    box('hero-actions', [lightButton('Explore services', 'services.html'), link('Meet the studio', 'studio.html', token('paper'))], { display: 'flex', 'flex-wrap': 'wrap', gap: '22px', 'align-items': 'center', 'margin-top': '29px' }),
  ], {
    position: 'absolute', left: '0', bottom: '-46px', width: '56%', padding: '48px', 'background-color': token('plum'),
  }, {
    position: 'relative', left: 'auto', bottom: 'auto', width: '100%', padding: '34px 24px',
  }, {
    width: '68%', padding: '40px',
  });
  const value = section('hero', [box('hero-stage', [scene, copy], { position: 'relative', 'max-width': '1400px', margin: '0 auto' })], {
    padding: '30px 48px 112px', 'background-color': token('blush'),
  }, { padding: '0 0 58px' }, { padding: '26px 32px 106px' });
  value.props.width = 'full';
  return value;
}

function home(): Page {
  return page('index', 'Home', [
    homeHero(),
    section('salon-thesis', [grid('thesis-layout', [
      box('thesis-title', [eyebrow('The Morrow & Muse approach'), text('A studio for thoughtful change.', 'title', 'h2', { 'margin-top': '18px' })]),
      box('thesis-copy', [text('Start with how your hair behaves. Add the shape, tone and ritual that make it feel like yours.', 'lead', 'p'), text('Every appointment begins with a conversation, then becomes a plan you can understand and maintain.', 'body', 'p', { 'margin-top': '24px', 'max-width': '49ch' })]),
    ], '.8fr 1.2fr', '88px', { 'align-items': 'start' })]),
    section('services-preview', [
      grid('services-heading', [text('Ways to work with your hair.', 'title', 'h2'), text('A concise service menu with space for consultation, craft and care.', 'body', 'p', { 'max-width': '48ch' })], '1fr 1fr', '64px', { 'align-items': 'end' }),
      box('service-lines', [
        serviceRow('Cut', 'Shape and movement developed for your texture, routine and preferred finish.', 'Consultation · cut · finish', 0),
        serviceRow('Colour', 'Dimensional colour, gloss and considered change with maintenance discussed first.', 'Consultation required for new colour', 1),
        serviceRow('Texture & care', 'Styling, treatment and practical guidance chosen for the hair in front of us.', 'Scope set after consultation', 2),
      ], { 'margin-top': '42px' }),
      link('Read the full service menu', 'services.html'),
    ], { 'background-color': token('paper') }),
    section('texture-story', [grid('texture-layout', [
      box('texture-copy', [eyebrow('Texture is the starting point'), text('Work with what your hair already knows.', 'title', 'h2', { 'margin-top': '18px' }), text('The best result is not a borrowed look. It is a shape and routine built around density, pattern, growth and the time you actually want to spend.', 'lead', 'p', { 'margin-top': '22px' }), link('How consultations work', 'services.html#consultation')]),
      image('texture-craft', 'Stylist hands carefully sectioning natural textured hair in a fictional salon', '650px', '480px'),
    ], '.9fr 1.1fr', '84px', { 'align-items': 'center' })], { 'background-color': token('rose') }),
    section('visit-rhythm', [grid('rhythm-layout', [
      text('What the appointment makes room for.', 'title', 'h2'),
      box('rhythm-notes', [
        principle('A clear conversation', 'Bring references if they help. We talk through shape, colour history, upkeep and any part you are unsure about.'),
        principle('A shared plan', 'Your stylist explains the approach before the work begins, including any maintenance or future sessions.'),
        principle('A useful finish', 'Leave knowing what was used, how the result was styled and what you can repeat at home.'),
      ]),
    ], '.72fr 1.28fr', '92px', { 'align-items': 'start' })]),
    section('team-window', [
      image('studio-team', 'Three fictional salon creatives preparing brushes, chairs and towels together', '520px', '330px'),
      grid('team-window-copy', [box('team-window-title', [eyebrow('Inside the studio', { color: token('rose') }), text('Different eyes. One careful standard.', 'title', 'h2', { color: token('paper'), 'margin-top': '17px' })]), box('team-window-action', [text('Meet the people and creative perspectives behind a thoughtful salon visit.', 'body', 'p', { color: '#f3e8ec' }), link('Meet the team', 'team.html', token('paper'))])], '1fr 1fr', '72px', { 'align-items': 'end', 'margin-top': '34px' }),
    ], { 'background-color': token('plum') }),
    section('home-cta', [grid('cta-layout', [text('Ready for a new conversation about your hair?', 'title', 'h2'), box('cta-action', [text('Send an appointment inquiry with the service you are considering. Availability is confirmed separately.', 'body', 'p', { 'max-width': '46ch' }), button('Start an inquiry', 'contact.html')], { display: 'flex', 'flex-direction': 'column', gap: '22px' })], '.95fr 1.05fr', '78px', { 'align-items': 'center' })], { 'background-color': token('blush') }),
  ]);
}

function services(): Page {
  const consultation = node('consultation-faq', 'accordion', {
    open: 'none', single: 1, marker: 'plus',
    items: [
      { q: 'When is a consultation useful?', a: 'Use one before a significant cut, first colour visit, corrective work, or whenever you need time to decide on direction and upkeep.' },
      { q: 'Does an inquiry reserve an appointment?', a: 'No. The inquiry shares your preferences only. The salon must reply separately with options and confirm any appointment.' },
      { q: 'What should I mention?', a: 'Share your current hair, relevant colour history, access needs, reference images, preferred upkeep and anything you want to avoid.' },
      { q: 'Where should pricing go?', a: 'Replace these examples with the salon’s current pricing structure, deposits, timing, cancellation terms and any consultation fees before launch.' },
    ],
  }, { '--ac-q-size': '21px', '--ac-a-size': '17px', '--ac-q-color': token('ink'), '--ac-a-color': token('text'), '--ac-pad': '23px', '--ac-line': token('line') }, [], { '--ac-q-size': '18px', '--ac-a-size': '16px' });

  return page('services', 'Services', [
    intro('Services', 'Shape, tone and care with a plan behind them.', 'Choose a starting point, then refine the scope in consultation. This sample menu intentionally omits prices and appointment promises.'),
    section('service-ledger', [
      serviceRow('Signature cut', 'Consultation-led shape, cut and finish for your texture and preferred routine.', 'Suitable for maintenance or a considered change', 0, 'h2'),
      serviceRow('Restyle', 'Extra time for a meaningful shift in shape, length or everyday styling.', 'Consultation recommended', 1, 'h2'),
      serviceRow('Dimensional colour', 'Placement and tone planned around your starting point, finish and maintenance rhythm.', 'New colour clients begin with consultation', 2, 'h2'),
      serviceRow('Gloss & tone', 'Refresh tone and shine between larger colour appointments.', 'Final suitability depends on current hair', 3, 'h2'),
      serviceRow('Texture session', 'Cutting, styling or care guidance centered on curl, coil, wave or density.', 'Scope agreed before work begins', 4, 'h2'),
      serviceRow('Event styling', 'A polished finish developed for the occasion, references and desired hold.', 'Trials and group requests need separate planning', 5, 'h2'),
    ], { padding: '36px 48px 78px' }),
    section('craft-panel', [grid('craft-panel-layout', [
      image('texture-craft', 'Close editorial detail of natural textured hair being sectioned by a stylist', '610px', '460px'),
      box('craft-panel-copy', [eyebrow('Before the service', { color: token('rose') }), text('The consultation is part of the craft.', 'title', 'h2', { color: token('paper'), 'margin-top': '18px' }), text('A useful plan accounts for condition, history, timing, maintenance and the result you want to recognize as your own.', 'lead', 'p', { color: '#f3e8ec', 'margin-top': '22px' }), link('Send a consultation inquiry', 'contact.html', token('paper'))]),
    ], '1.15fr .85fr', '74px', { 'align-items': 'center' })], { 'background-color': token('plum') }),
    anchor(section('consultation', [grid('consultation-layout', [box('consultation-intro', [eyebrow('Consultation'), text('Know what happens before you commit.', 'title', 'h2', { 'margin-top': '18px' }), text('Replace the sample answers with the studio’s current policy and service details.', 'body', 'p', { 'margin-top': '22px' })]), consultation], '.72fr 1.28fr', '86px', { 'align-items': 'start' })], { 'background-color': token('blush') }), 'consultation'),
  ]);
}

function studio(): Page {
  return page('studio', 'Studio', [
    intro('The studio', 'A room designed for attention.', 'Warm materials, generous light and unhurried conversation. A setting that gives your hair and your ideas room to be considered.'),
    section('studio-scene', [
      image('studio-interior', 'Warm plaster salon interior with plum cabinetry and stainless steel styling stations', '650px', '390px'),
      box('scene-caption', [text('Warm light. Useful space. No unnecessary theatre.', 'lead', 'p'), text('Demonstration interior — replace with current studio photography.', 'small', 'p', { color: token('muted') })], { display: 'flex', 'justify-content': 'space-between', gap: '24px', 'padding-top': '22px', 'border-bottom': `1px solid ${token('line')}`, 'padding-bottom': '22px' }, { 'flex-direction': 'column' }),
    ], { padding: '0 48px 86px' }),
    section('studio-story', [grid('studio-story-layout', [
      box('studio-story-title', [eyebrow('What the room supports'), text('Comfort without losing the edge.', 'title', 'h2', { 'margin-top': '18px' })]),
      box('studio-story-copy', [text('The studio balances quiet concentration with the energy of people making things well. Materials feel tactile, stations stay purposeful, and the conversation remains yours.', 'lead', 'p'), text('A live salon can use this page to explain access, sensory considerations, product choices, parking, transport and the details that help a first visit feel straightforward.', 'body', 'p', { 'margin-top': '24px' })]),
    ], '.78fr 1.22fr', '90px', { 'align-items': 'start' })], { 'background-color': token('rose') }),
    section('studio-details', [
      text('Details worth making visible.', 'title', 'h2'),
      grid('details-layout', [principle('Access', 'Publish verified entrance, seating, restroom, parking and public transport information.'), principle('Comfort', 'Explain quiet appointments, consultation preferences or other accommodations the studio can reliably offer.'), principle('Products', 'Name only current brands, ingredients, sustainability practices and retail policies the studio can support.')], '1fr 1fr 1fr', '44px', { 'margin-top': '38px' }),
    ]),
    section('studio-close', [grid('studio-close-layout', [text('See the people who bring the room to life.', 'title', 'h2', { color: token('paper') }), lightButton('Meet the team', 'team.html')], '1fr auto', '48px', { 'align-items': 'center' })], { 'background-color': token('plum') }),
  ]);
}

function team(): Page {
  return page('team', 'Team', [
    intro('The team', 'A small studio with a shared point of view.', 'Meet the creative perspectives that shape the studio. Profiles and images below are fictional demonstration content.'),
    section('team-scene', [image('studio-team', 'Fictional diverse salon team preparing their studio together before opening', '650px', '390px')], { padding: '0 48px 82px' }),
    section('profiles', [
      serviceRow('Mara Vale', 'Cutting focused on movement, natural texture and shapes that grow out with intention.', 'Fictional stylist profile · no qualifications claimed', 0, 'h2'),
      serviceRow('Ellis Rowe', 'Dimensional colour and tonal changes planned around condition and maintenance.', 'Fictional colourist profile · no qualifications claimed', 1, 'h2'),
      serviceRow('Noa Mercer', 'Texture-led cutting, finishing and practical home-care guidance.', 'Fictional stylist profile · no qualifications claimed', 2, 'h2'),
    ], { padding: '36px 48px 80px' }),
    section('working-values', [grid('values-layout', [box('values-heading', [eyebrow('How the team works', { color: token('rose') }), text('Individual eye. Shared care.', 'title', 'h2', { color: token('paper'), 'margin-top': '18px' })]), box('values-copy', [text('Consult together when a service benefits from another perspective.', 'lead', 'p', { color: '#f7edf1' }), text('Be direct about upkeep, limits and what should happen over more than one visit.', 'lead', 'p', { color: '#f7edf1', 'margin-top': '24px' }), text('Leave room for questions, changes of mind and the person in the chair.', 'lead', 'p', { color: '#f7edf1', 'margin-top': '24px' })])], '.78fr 1.22fr', '88px', { 'align-items': 'start' })], { 'background-color': token('plum') }),
    section('team-cta', [grid('team-cta-layout', [text('Not sure who to ask for?', 'title', 'h2'), box('team-cta-copy', [text('Describe the service and result you are considering. A real studio can route your inquiry after reviewing current availability.', 'body', 'p'), button('Start an inquiry', 'contact.html')], { display: 'flex', 'flex-direction': 'column', gap: '22px' })], '.8fr 1.2fr', '78px', { 'align-items': 'center' })], { 'background-color': token('blush') }),
  ]);
}

function contact(): Page {
  const form = node('appointment-inquiry-form', 'form', {
    mode: 'external', action: '', method: 'post', aria: 'Appointment inquiry', submit: 'Send appointment inquiry',
    fields: [
      { label: 'Name', name: 'name', type: 'text', required: 1, half: 1 },
      { label: 'Email', name: 'email', type: 'email', required: 1, half: 1 },
      { label: 'Service interest', name: 'service', type: 'select', opts: 'Not sure yet,Cut or restyle,Colour,Texture session,Event styling,Consultation', required: 0, half: 1 },
      { label: 'Preferred stylist', name: 'stylist', type: 'select', opts: 'No preference,Mara Vale,Ellis Rowe,Noa Mercer', required: 0, half: 1 },
      { label: 'Tell us about your hair and what you are considering', name: 'message', type: 'textarea', required: 1 },
      { label: 'Preferred timing', name: 'timing', type: 'text', required: 0 },
    ],
  }, { '--f-bg': token('paper'), '--f-border': token('line'), '--f-text': token('ink'), '--f-btn-bg': token('plum'), '--f-btn-fg': token('paper'), '--f-radius': '0', '--f-gap': '16px', 'font-size': '17px' });

  return page('contact', 'Contact', [
    intro('Appointment inquiry', 'Begin with the hair you have and the change you are considering.', 'Share a little context so the studio can suggest the right next conversation. Avoid sending sensitive personal information.'),
    anchor(section('contact-layout', [grid('contact-columns', [
      box('contact-context', [eyebrow('Before you send'), text('This form is not connected yet.', 'title', 'h2', { 'margin-top': '18px' }), text('It does not show live availability, deliver a message or confirm an appointment. The site owner must configure and test a recipient or booking provider before publishing.', 'body', 'p', { 'margin-top': '22px', 'max-width': '41ch' }), text('Once connected, explain expected reply time, deposits, cancellation terms, privacy handling and how appointments are confirmed.', 'small', 'p', { 'margin-top': '24px', color: token('muted'), 'max-width': '48ch' })]),
      form,
    ], '.72fr 1.28fr', '82px', { 'align-items': 'start' })], { padding: '74px 48px 96px' }), 'inquiry'),
    section('contact-next', [grid('next-layout', [text('What a real studio should confirm next.', 'title', 'h2', { color: token('paper') }), box('next-notes', [text('Whether a consultation is needed before the service.', 'lead', 'p', { color: '#f5eaf0' }), text('A specific time, duration and stylist.', 'lead', 'p', { color: '#f5eaf0', 'margin-top': '20px' }), text('Current pricing, deposit and cancellation terms.', 'lead', 'p', { color: '#f5eaf0', 'margin-top': '20px' })])], '.85fr 1.15fr', '82px', { 'align-items': 'start' })], { 'background-color': token('plum') }),
  ]);
}

function normalize(nodes: Node[]) {
  for (const value of nodes) {
    for (const breakpoint of ['d', 't', 'm'] as const) {
      const normalized: Style = {};
      for (const [key, raw] of Object.entries(value.css[breakpoint])) {
        if (key === 'padding' || key === 'margin') {
          const parts = String(raw).trim().split(/\s+/);
          const expanded = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]];
          ['top', 'right', 'bottom', 'left'].forEach((side, index) => { normalized[`${key}-${side}`] = expanded[index]; });
        } else normalized[key] = String(raw);
      }
      value.css[breakpoint] = normalized;
    }
    normalize(value.children);
  }
}

export function buildTemplateDocument(): Doc {
  Core.seed();
  serial = 0;
  const tokens = Core.defaultTokens();
  tokens.colors = Object.entries({ bg: '#f7f0ed', paper: '#fffaf7', ink: '#21181e', text: '#463a41', plum: '#51213f', berry: '#75375c', rose: '#ead0d8', blush: '#f3e5e7', muted: '#685d63', line: '#d5c3c9' }).map(([id, value]) => ({ id, name: id, value }));
  const sizes: Record<string, string[]> = { display: ['80px', '60px', '43px'], title: ['48px', '40px', '33px'], subtitle: ['27px', '25px', '23px'], lead: ['22px', '21px', '19px'], body: ['18px', '18px', '17px'], small: ['14px', '14px', '13px'], btn: ['15px', '15px', '15px'] };
  for (const style of tokens.text) {
    if (!sizes[style.id]) continue;
    const heading = ['display', 'title', 'subtitle'].includes(style.id);
    style.css = { d: { 'font-family': heading ? Core.stackFor('Cormorant Garamond', 'f') : 'inherit', 'font-size': sizes[style.id][0], 'font-weight': heading ? '500' : '400', 'line-height': heading ? '1.02' : '1.58', 'letter-spacing': ['display', 'title'].includes(style.id) ? '-.025em' : '0' }, t: { 'font-size': sizes[style.id][1] }, m: { 'font-size': sizes[style.id][2] } };
  }
  Core.state.meta = { ...Core.state.meta, name: 'Morrow & Muse', lang: 'en', maxWidth: '1380px', size: '18px', font: Core.stackFor('Work Sans', 's'), headFont: Core.stackFor('Cormorant Garamond', 'f'), css: '', headHtml: '', baseUrl: '', ogImage: 'asset:studio-interior', favicon: 'asset:logo', blocks: [], components: [], collections: [], selfHostFonts: 0, tokens };
  const logo = node('logo', 'image', { src: 'asset:logo', alt: 'Morrow & Muse hair studio', link: 'index.html', lazy: 0 }, { width: '275px', height: '68px', 'object-fit': 'contain' }, [], { width: '205px', height: '51px' }, { width: '235px', height: '58px' });
  Core.state.header = [section('header', [box('header-row', [logo, node('navigation', 'nav', { collapse: '960', mobileMenu: 'fullscreen', aria: 'Main navigation', items: [{ id: 'nav-services', label: 'Services', href: 'services.html' }, { id: 'nav-studio', label: 'Studio', href: 'studio.html' }, { id: 'nav-team', label: 'Team', href: 'team.html' }, { id: 'nav-contact', label: 'Appointment inquiry', href: 'contact.html#inquiry' }] }, { color: token('ink'), 'font-size': '15px', '--nav-gap': '28px', '--nav-panel': token('paper'), '--nav-hover': token('berry') })], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px' })], { padding: '16px 48px', 'background-color': token('paper'), 'border-bottom': `1px solid ${token('line')}` }, { padding: '12px 22px' }, { padding: '14px 32px' })];
  Core.state.footer = [section('footer', [box('footer-row', [node('footer-logo', 'image', { src: 'asset:logo', alt: 'Morrow & Muse hair studio', link: 'index.html', lazy: 0 }, { width: '265px', height: '66px', 'object-fit': 'contain' }, [], { width: '205px', height: '51px' }), box('footer-links', [link('Services', 'services.html', token('paper')), link('Studio', 'studio.html', token('paper')), link('Team', 'team.html', token('paper')), link('Appointment inquiry', 'contact.html#inquiry', token('paper'))], { display: 'flex', 'flex-wrap': 'wrap', gap: '22px' }, { 'flex-direction': 'column', gap: '7px' })], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px' }, { 'flex-direction': 'column', 'align-items': 'flex-start' }), box('footer-note', [text('Fictional demo salon. Replace studio details and configure inquiry delivery before publishing.', 'small', 'p', { color: '#eadde3' }), text('Morrow & Muse · Pagecraft template', 'small', 'p', { color: '#eadde3' })], { display: 'flex', 'justify-content': 'space-between', gap: '20px', 'margin-top': '28px', 'padding-top': '20px', 'border-top': '1px solid #80546c' }, { 'flex-direction': 'column' })], { padding: '40px 48px', 'background-color': token('plum') }, { padding: '36px 22px' })];
  Core.state.pages = [home(), services(), studio(), team(), contact()];
  Core.state.cur = 0;
  normalize(Core.state.header);
  normalize(Core.state.footer);
  Core.state.pages.forEach(item => normalize(item.tree));
  return structuredClone(Core.doc());
}
