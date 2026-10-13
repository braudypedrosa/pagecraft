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
  value.id = `commonwell-${name}-${++serial}`;
  if (type === 'nav' || name === 'footer-links') value.css.d.width = 'auto';
  if (type === 'image') {
    const src = String(props.src || '');
    if (src.includes('mark')) {
      value.props.w = '128';
      value.props.h = '128';
    } else if (src.includes('logo')) {
      value.props.w = '620';
      value.props.h = '132';
    } else {
      value.props.w = '1800';
      value.props.h = '1200';
    }
  }
  return value;
};

const box = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'box', { layout: desktop.display === 'grid' ? 'grid' : desktop.display === 'flex' ? 'flex' : 'block' }, desktop, children, mobile, tablet);

const text = (copy: string, ts = 'body', level = 'p', desktop: Style = {}, mobile: Style = {}) =>
  node('text', 'heading', { text: copy, ts, level }, { margin: '0', ...desktop }, [], mobile);

const section = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'section', {}, { padding: '92px 48px', ...desktop }, children, { padding: '60px 22px', ...mobile }, { padding: '72px 32px', ...tablet });

const grid = (name: string, children: Node[], columns = '1fr 1fr', gap = '52px', desktop: Style = {}, mobile: Style = {}) =>
  box(name, children, { display: 'grid', 'grid-template-columns': columns, gap, ...desktop }, { 'grid-template-columns': '1fr', gap: '30px', ...mobile });

const image = (asset: string, alt: string, height = '520px', mobile = '330px', position = 'center') =>
  node(asset, 'image', { src: `asset:${asset}`, alt, lazy: 0 }, { display: 'block', width: '100%', height, 'object-fit': 'cover', 'object-position': position, 'border-radius': '0' }, [], { height: mobile });

const icon = (name: string, color = token('leaf')) =>
  node('icon', 'icon', { name, label: '' }, { '--icon-size': '28px', '--icon-stroke': '1.6', color, padding: '0', 'background-color': 'transparent', 'align-self': 'flex-start' });

const button = (label: string, href: string, quiet = false, onDark = false) => {
  const value = node('button', 'button', { text: label, link: href, ts: 'btn', variant: quiet ? 'outline' : 'primary', icon: 'arrow' }, {
    padding: '14px 22px',
    'min-height': '48px',
    'border-radius': '999px',
    'border-width': quiet ? '1px' : '0',
    'border-color': onDark ? token('paper') : token('ink'),
    'background-color': quiet ? 'transparent' : (onDark ? token('sun') : token('ink')),
    color: quiet ? (onDark ? token('paper') : token('ink')) : (onDark ? token('ink') : token('paper')),
    'align-self': 'start',
    transition: 'background-color 180ms ease, color 180ms ease, outline-color 180ms ease',
  });
  value.st = {
    hover: { d: { 'background-color': quiet ? (onDark ? '#ffffff1f' : token('moss')) : (onDark ? '#f0c76e' : token('leaf')) }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('coral')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const link = (label: string, href: string, color = token('ink')) => {
  const value = node('link', 'button', { text: label, link: href, ts: 'btn', variant: 'outline', icon: 'arrow' }, {
    padding: '11px 0',
    'min-height': '44px',
    'border-width': '0',
    'background-color': 'transparent',
    color,
    'text-decoration': 'underline',
    'text-underline-offset': '6px',
    'align-self': 'start',
  });
  value.st = {
    hover: { d: { color: token('coral') }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('coral')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const eyebrow = (copy: string, desktop: Style = {}) =>
  text(copy, 'small', 'p', { 'text-transform': 'uppercase', 'letter-spacing': '.14em', 'font-weight': '750', color: token('leaf'), ...desktop });

const page = (slug: string, name: string, tree: Node[]): Page => ({
  id: `commonwell-page-${slug}`,
  slug,
  name,
  title: `${name} — Commonwell Homekeeping`,
  desc: 'A fictional residential cleaning demonstration site with editable native Pagecraft content.',
  ogImage: slug === 'approach' ? 'asset:bedroom' : slug === 'services' ? 'asset:kitchen' : 'asset:hero-cleaning',
  tree,
});

const intro = (label: string, heading: string, copy: string) => section('page-intro', [
  eyebrow(label),
  text(heading, 'display', 'h1', { 'margin-top': '18px', 'max-width': '980px' }),
  text(copy, 'lead', 'p', { 'margin-top': '24px', 'max-width': '60ch', color: token('text') }),
], { padding: '54px 48px 80px' }, { padding: '42px 22px 58px' });

const checkLine = (copy: string, color = token('ink')) => box('check-line', [
  icon('check-circle', token('coral')),
  text(copy, 'body', 'p', { color }),
], { display: 'grid', 'grid-template-columns': '28px 1fr', gap: '14px', 'align-items': 'start', padding: '14px 0', 'border-bottom': `1px solid ${token('line')}` }, { 'grid-template-columns': '26px 1fr' });

const serviceBand = (name: string, fit: string, scope: string, href = 'contact.html') => box('service-band', [
  text(name, 'title', 'h2'),
  box('service-fit', [eyebrow('Best for'), text(fit, 'body', 'p', { 'margin-top': '10px', color: token('text') })]),
  box('service-scope', [text(scope, 'body', 'p', { color: token('text') }), link('Ask about this service', href)], { display: 'flex', 'flex-direction': 'column', gap: '18px' }),
], {
  display: 'grid',
  'grid-template-columns': '.85fr .75fr 1.2fr',
  gap: '46px',
  'align-items': 'start',
  padding: '34px 0',
  'border-top': `1px solid ${token('line')}`,
}, { 'grid-template-columns': '1fr', gap: '18px', padding: '28px 0' });

const quoteCta = (photo = false) => {
  if (!photo) return section('quote-cta', [grid('quote-cta-layout', [
    box('quote-cta-copy', [eyebrow('Start with the home', { color: token('ink') }), text('Tell us what needs care.', 'title', 'h2', { 'margin-top': '16px', 'max-width': '620px' })]),
    box('quote-cta-action', [text('Share the rooms, timing, and priorities. A clear quote begins with the home rather than a one-size-fits-all list.', 'body', 'p', { 'max-width': '48ch' }), button('Request a quote', 'contact.html')], { display: 'flex', 'flex-direction': 'column', gap: '22px', 'align-items': 'flex-start' }),
  ], '1fr 1fr', '70px', { 'align-items': 'center' })], { 'background-color': token('sun') });

  const scene = image('bedroom', 'Sunlit bedroom with warm wood walls and sheer curtains', '470px', '430px', 'center');
  scene.css.d = { ...scene.css.d, position: 'absolute', inset: '0', height: '100%' };
  scene.css.t.height = '100%';
  scene.css.m.height = '100%';
  const value = section('photo-quote-cta', [
    scene,
    box('cta-shade', [], { position: 'absolute', inset: '0', 'background-image': 'linear-gradient(90deg,rgba(22,55,44,.94) 0%,rgba(22,55,44,.72) 55%,rgba(22,55,44,.18) 100%)' }),
    box('cta-copy', [eyebrow('A calmer return home', { color: token('sun') }), text('Make room for the rest of the week.', 'title', 'h2', { color: token('paper'), 'margin-top': '16px', 'max-width': '620px' }), text('Describe the home and the kind of reset you need. A quote inquiry starts the conversation; it does not book a visit.', 'body', 'p', { color: token('paper'), 'margin-top': '20px', 'max-width': '50ch' }), box('cta-actions', [button('Request a quote', 'contact.html', false, true), button('Compare services', 'services.html', true, true)], { display: 'flex', 'flex-wrap': 'wrap', gap: '14px', 'margin-top': '28px' })], { position: 'relative', 'z-index': '1', 'max-width': '760px', 'min-height': '470px', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }, { 'min-height': '430px' }),
  ], { position: 'relative', overflow: 'hidden', padding: '0 48px', 'background-color': token('ink') }, { padding: '0 22px' });
  value.props.width = 'full';
  return value;
};

function home(): Page {
  const heroPhoto = image('hero-cleaning', 'Gloved hands wiping a household surface with a spray bottle', '650px', '340px', 'center');
  return page('index', 'Home', [
    section('hero', [grid('hero-layout', [
      box('hero-copy', [
        eyebrow('Residential care for lived-in homes', { color: token('sun') }),
        text('A clean home,\nwith room to live.', 'display', 'h1', { color: token('paper'), 'margin-top': '20px', 'max-width': '720px' }),
        text('Thoughtful cleaning for busy weeks, seasonal resets, and moving days—shaped around how each room is used.', 'lead', 'p', { color: '#eef4ed', 'margin-top': '24px', 'max-width': '44ch' }),
        box('hero-actions', [button('Request a quote', 'contact.html', false, true), button('Explore services', 'services.html', true, true)], { display: 'flex', 'flex-wrap': 'wrap', gap: '14px', 'margin-top': '30px' }),
      ], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', padding: '78px 70px', 'min-height': '650px' }, { padding: '56px 22px', 'min-height': '0' }),
      heroPhoto,
    ], '1.04fr .96fr', '0', { 'align-items': 'stretch' })], { padding: '0', 'background-color': token('ink') }, { padding: '0' }),

    section('promise-strip', [grid('promise-grid', [
      box('promise', [icon('sparkle'), text('Clear scope', 'subtitle', 'h2', { 'margin-top': '18px' }), text('Agree the rooms, priorities, and boundaries before work begins.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
      box('promise', [icon('shield'), text('Respectful entry', 'subtitle', 'h2', { 'margin-top': '18px' }), text('Bring access, pets, products, delicate surfaces, and privacy into the plan.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
      box('promise', [icon('calendar'), text('Useful rhythm', 'subtitle', 'h2', { 'margin-top': '18px' }), text('Choose a one-time reset or discuss a recurring routine that fits the home.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
    ], 'repeat(3,1fr)', '48px')], { 'background-color': token('oat'), padding: '58px 48px' }, { padding: '48px 22px' }),

    section('service-ledger', [
      grid('service-intro', [box('service-heading', [eyebrow('Ways to care for a home'), text('Start with the moment,\nnot a package name.', 'title', 'h2', { 'margin-top': '18px' })]), text('These sample service paths cover recurring care, a one-time reset, and moving day. Final scope, timing, and exclusions still need confirmation.', 'body', 'p', { color: token('text'), 'max-width': '54ch' })], '.9fr 1.1fr', '72px', { 'align-items': 'end', 'margin-bottom': '42px' }),
      serviceBand('Routine care', 'Homes that need a steady, agreed cleaning rhythm.', 'Core care can cover high-use rooms, floors, dusting, surfaces, and a final reset based on the confirmed checklist.'),
      serviceBand('Home reset', 'Seasonal changes, busy stretches, or a deeper one-time clean.', 'Scope can be shaped around buildup, detailed kitchen and bathroom care, and selected extras after the home has been discussed.'),
      serviceBand('Moving day', 'Empty or nearly empty homes before a handover.', 'Confirm access, utilities, appliance interiors, cupboards, disposal, keys, and the condition expected at handover.'),
    ]),

    section('room-story', [grid('room-story-layout', [
      image('kitchen', 'Bright kitchen with pale counters, plants, and everyday utensils', '610px', '360px', 'center'),
      box('room-story-copy', [eyebrow('Room by room'), text('Care follows how the home is used.', 'title', 'h2', { 'margin-top': '18px' }), text('The kitchen needs a different rhythm from a quiet bedroom. The site helps a customer name the places that matter most before any scope is agreed.', 'lead', 'p', { 'margin-top': '22px' }), box('room-lines', [checkLine('High-use surfaces and touchpoints'), checkLine('Floors, edges, and visible dust'), checkLine('Confirmed priorities for this visit')], { 'margin-top': '26px' }), link('Read the Commonwell approach', 'approach.html')]),
    ], '1.15fr .85fr', '76px', { 'align-items': 'center' })], { 'background-color': token('moss') }),

    section('visit-expectations', [grid('expectations-layout', [
      box('expectations-heading', [eyebrow('Before the door opens', { color: token('sun') }), text('A useful clean begins with useful context.', 'title', 'h2', { color: token('paper'), 'margin-top': '18px', 'max-width': '620px' }), text('Use these practical questions to shape a clear scope before choosing a service rhythm.', 'body', 'p', { color: '#d9e4dc', 'margin-top': '22px', 'max-width': '48ch' })]),
      box('expectation-list', [
        checkLine('Which rooms and surfaces are in scope?', token('paper')),
        checkLine('Are there pets, access notes, or sensitive items?', token('paper')),
        checkLine('Which products or equipment will be used?', token('paper')),
        checkLine('How will changes or extra work be agreed?', token('paper')),
      ]),
    ], '.9fr 1.1fr', '86px', { 'align-items': 'start' })], { 'background-color': token('ink') }),

    section('package-preview', [
      eyebrow('Illustrative service paths'),
      grid('package-heading', [text('Three starting points for a cared-for home.', 'title', 'h2', { 'margin-top': '18px' }), text('Steady, Reset, and Handover help identify the conversation that fits the moment. Exact scope and pricing are confirmed separately.', 'body', 'p', { color: token('text'), 'max-width': '52ch' })], '1fr 1fr', '66px', { 'align-items': 'end' }),
      grid('package-grid', [
        box('package-routine', [text('Steady', 'subtitle', 'h3'), text('A repeatable core checklist for agreed high-use spaces.', 'body', 'p', { 'margin-top': '14px' }), link('Discuss recurring care', 'contact.html')], { padding: '30px', 'background-color': token('paper'), 'border-top': `5px solid ${token('leaf')}` }),
        box('package-reset', [text('Reset', 'subtitle', 'h3'), text('A one-time visit shaped around current condition and priorities.', 'body', 'p', { 'margin-top': '14px' }), link('Discuss a reset', 'contact.html')], { padding: '30px', 'background-color': token('sun'), 'border-top': `5px solid ${token('ink')}` }),
        box('package-moving', [text('Handover', 'subtitle', 'h3'), text('An empty-home scope confirmed against access and handover needs.', 'body', 'p', { 'margin-top': '14px' }), link('Discuss moving day', 'contact.html')], { padding: '30px', 'background-color': token('paper'), 'border-top': `5px solid ${token('coral')}` }),
      ], 'repeat(3,1fr)', '18px', { 'margin-top': '42px' }),
    ], { 'background-color': token('bg') }),

    quoteCta(true),
  ]);
}

function services(): Page {
  return page('services', 'Services', [
    intro('Service guide', 'Choose the kind of reset the home needs.', 'Begin with recurring care, a one-time reset, or moving day. Final scope and availability need confirmation after the home and priorities are understood.'),
    section('services-photo', [image('kitchen', 'Bright kitchen prepared for ordinary daily use', '560px', '340px', 'center')], { padding: '0 48px 82px' }, { padding: '0 22px 58px' }),
    section('service-detail', [
      serviceBand('Routine homekeeping', 'A recurring rhythm after the first scope has been agreed.', 'Example core: bathrooms, kitchen surfaces, visible dust, floors, bins, and a room-by-room priority agreed with the household.'),
      serviceBand('Detailed reset', 'A bounded one-time visit for selected rooms or accumulated detail.', 'Possible focus: edges, fixtures, cabinet fronts, buildup, and selected extra tasks after the home has been discussed.'),
      serviceBand('Move preparation', 'An empty or nearly empty property before a move or handover.', 'Example discussion: interior cupboards, appliances, keys, access, utilities, disposal, and any agent or tenancy checklist supplied by the customer.'),
    ], { padding: '20px 48px 92px' }, { padding: '10px 22px 62px' }),
    section('package-comparison', [
      grid('comparison-intro', [box('comparison-heading', [eyebrow('Illustrative service paths'), text('Compare scope, then confirm it.', 'title', 'h2', { 'margin-top': '18px' })]), text('Each path is a starting point for the quote conversation. Rooms, timing, minimums, add-ons, and current pricing still need confirmation.', 'body', 'p', { color: token('text') })], '.85fr 1.15fr', '72px', { 'align-items': 'end' }),
      grid('comparison-grid', [
        box('compare-steady', [text('Steady', 'subtitle', 'h3'), text('Typical moment', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('muted') }), text('Recurring care', 'body', 'p', { 'margin-top': '8px' }), text('Scope decision', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('muted') }), text('Agree a repeatable checklist', 'body', 'p', { 'margin-top': '8px' })], { padding: '30px', 'background-color': token('paper') }),
        box('compare-reset', [text('Reset', 'subtitle', 'h3'), text('Typical moment', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('ink') }), text('One-time deeper focus', 'body', 'p', { 'margin-top': '8px' }), text('Scope decision', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('ink') }), text('Confirm rooms and priorities', 'body', 'p', { 'margin-top': '8px' })], { padding: '30px', 'background-color': token('sun') }),
        box('compare-handover', [text('Handover', 'subtitle', 'h3'), text('Typical moment', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('muted') }), text('Moving or empty home', 'body', 'p', { 'margin-top': '8px' }), text('Scope decision', 'small', 'p', { 'margin-top': '26px', 'font-weight': '750', color: token('muted') }), text('Confirm access and checklist', 'body', 'p', { 'margin-top': '8px' })], { padding: '30px', 'background-color': token('paper') }),
      ], 'repeat(3,1fr)', '14px', { 'margin-top': '44px', 'align-items': 'stretch' }, { gap: '14px' }),
    ], { 'background-color': token('moss') }),
    section('boundaries', [grid('boundaries-layout', [
      box('included-context', [eyebrow('Define the visit'), text('Write the boundary down.', 'title', 'h2', { 'margin-top': '18px' }), text('A clear agreement names what is included, what counts as an add-on, and which work sits outside the visit.', 'lead', 'p', { 'margin-top': '22px' })]),
      box('boundary-lines', [checkLine('Products, equipment, and surface limitations'), checkLine('Access, keys, alarms, pets, and parking'), checkLine('Cancellation, rescheduling, and extra work'), checkLine('Damage reporting and privacy handling')]),
    ], '.85fr 1.15fr', '84px', { 'align-items': 'start' })]),
    quoteCta(false),
  ]);
}

function approach(): Page {
  return page('approach', 'Approach', [
    intro('The Commonwell approach', 'Care starts before the first cloth is unfolded.', 'Preparation, scope, access, and a clear handover make the visit easier to understand before it begins.'),
    section('approach-scene', [image('bedroom', 'Quiet sunlit bedroom with sheer curtains and a made bed', '610px', '380px', 'center')], { padding: '0 48px 84px' }, { padding: '0 22px 58px' }),
    section('principles', [grid('principle-layout', [
      box('principle-heading', [eyebrow('How the work is shaped'), text('Specific enough to be useful. Flexible enough for a real home.', 'title', 'h2', { 'margin-top': '18px', 'max-width': '700px' })]),
      box('principle-list', [
        box('principle', [text('Listen first', 'subtitle', 'h3'), text('Ask how the rooms are used, which surfaces need care, and what the household wants left alone.', 'body', 'p', { 'margin-top': '12px', color: token('text') })], { padding: '0 0 26px', 'border-bottom': `1px solid ${token('line')}` }),
        box('principle', [text('Agree the scope', 'subtitle', 'h3'), text('Name the core tasks, priorities, products, access, timing, and any work that sits outside the visit.', 'body', 'p', { 'margin-top': '12px', color: token('text') })], { padding: '26px 0', 'border-bottom': `1px solid ${token('line')}` }),
        box('principle', [text('Leave a clear handover', 'subtitle', 'h3'), text('Agree how completed work, open questions, changes, or accidental damage will be communicated.', 'body', 'p', { 'margin-top': '12px', color: token('text') })], { padding: '26px 0 0' }),
      ]),
    ], '.9fr 1.1fr', '86px', { 'align-items': 'start' })], { 'background-color': token('moss') }),
    section('visit-rhythm', [
      eyebrow('A visit rhythm'),
      grid('rhythm-grid', [
        box('rhythm-arrive', [icon('map-pin'), text('Arrive with context', 'subtitle', 'h3', { 'margin-top': '18px' }), text('Confirm access, priorities, and anything that changed since the scope was agreed.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
        box('rhythm-work', [icon('sparkle'), text('Work through the home', 'subtitle', 'h3', { 'margin-top': '18px' }), text('Follow the agreed room order and surface guidance. Pause when the condition or task differs from the plan.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
        box('rhythm-close', [icon('check-circle'), text('Close the visit clearly', 'subtitle', 'h3', { 'margin-top': '18px' }), text('Secure the home and communicate any question or variation through the agreed channel.', 'body', 'p', { 'margin-top': '12px', color: token('text') })]),
      ], 'repeat(3,1fr)', '46px', { 'margin-top': '38px' }),
    ]),
    section('preparation', [grid('preparation-layout', [
      box('preparation-copy', [eyebrow('Products and preparation'), text('A few details change the whole visit.', 'title', 'h2', { 'margin-top': '18px' }), text('Confirm who brings products and equipment, how preferred products are handled, and which materials need special care.', 'body', 'p', { 'margin-top': '22px' }), box('preparation-list', [checkLine('Name delicate, damaged, or specialty surfaces'), checkLine('Put away sensitive documents and valuables'), checkLine('Confirm pets, keys, alarms, and entry instructions')], { 'margin-top': '24px' })]),
      image('cleaning-essentials', 'Unbranded spray bottle and paper towel against a plain wall', '520px', '340px', 'center'),
    ], '.9fr 1.1fr', '78px', { 'align-items': 'center' })], { 'background-color': token('oat') }),
    quoteCta(false),
  ]);
}

function contact(): Page {
  const form = node('quote-form', 'form', {
    mode: 'external',
    action: '',
    method: 'post',
    aria: 'Residential cleaning quote inquiry',
    submit: 'Prepare quote inquiry',
    fields: [
      { label: 'Name', name: 'name', type: 'text', required: 1, half: 1 },
      { label: 'Email', name: 'email', type: 'email', required: 1, half: 1 },
      { label: 'Service interest', name: 'service', type: 'select', opts: 'Not sure yet,Routine homekeeping,Detailed reset,Move preparation', required: 1, half: 1 },
      { label: 'Home size', name: 'home-size', type: 'select', opts: 'Studio or 1 bedroom,2 bedrooms,3 bedrooms,4 or more bedrooms,Other', required: 0, half: 1 },
      { label: 'Timing or preferred rhythm', name: 'timing', type: 'text', required: 0 },
      { label: 'Rooms, priorities, access, or pets', name: 'details', type: 'textarea', required: 1 },
    ],
  }, {
    '--f-bg': token('paper'),
    '--f-border': token('line'),
    '--f-text': token('ink'),
    '--f-label': token('ink'),
    '--f-btn-bg': token('ink'),
    '--f-btn-fg': token('paper'),
    '--f-radius': '10px',
    '--f-gap': '16px',
    'font-size': '17px',
  });

  return page('contact', 'Contact', [
    intro('Quote inquiry', 'Tell us what the home needs.', 'Share the rooms, timing, and priorities that would shape a quote. This demonstration is an inquiry, not a booked visit.'),
    section('contact-layout', [grid('contact-columns', [
      box('contact-context', [
        box('unconfigured-note', [icon('info', token('ink')), box('unconfigured-copy', [text('Form delivery is unconfigured', 'subtitle', 'h2'), text('This demonstration form does not send anywhere. Connect and test a recipient before using it for real inquiries.', 'body', 'p', { 'margin-top': '12px' })])], { display: 'grid', 'grid-template-columns': '30px 1fr', gap: '16px', padding: '26px', 'background-color': token('sun') }),
        text('A useful first note includes:', 'subtitle', 'h2', { 'margin-top': '34px' }),
        box('contact-list', [checkLine('Which rooms need attention'), checkLine('Current timing or recurring rhythm'), checkLine('Pets, access, parking, or product needs'), checkLine('Any delicate or specialty surfaces')], { 'margin-top': '14px' }),
        text('Availability', 'small', 'p', { 'margin-top': '32px', 'font-weight': '750', 'text-transform': 'uppercase', 'letter-spacing': '.12em', color: token('leaf') }),
        text('Service area and timing are not set for this fictional business. Both need confirmation before a quote can be prepared.', 'body', 'p', { 'margin-top': '10px', color: token('text') }),
      ]),
      form,
    ], '.8fr 1.2fr', '78px', { 'align-items': 'start' })], { padding: '10px 48px 94px' }, { padding: '0 22px 64px' }),
  ]);
}

function normalize(nodes: Node[]) {
  for (const value of nodes) {
    for (const breakpoint of ['d', 't', 'm'] as const) {
      const out: Style = {};
      for (const [key, raw] of Object.entries(value.css[breakpoint])) {
        if (key === 'padding' || key === 'margin') {
          const parts = String(raw).trim().split(/\s+/);
          const expanded = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]];
          ['top', 'right', 'bottom', 'left'].forEach((side, index) => { out[`${key}-${side}`] = expanded[index]; });
        } else out[key] = String(raw);
      }
      value.css[breakpoint] = out;
    }
    normalize(value.children);
  }
}

export function buildTemplateDocument(): Doc {
  Core.seed();
  serial = 0;

  const tokens = Core.defaultTokens();
  tokens.colors = Object.entries({
    bg: '#f6f1e7',
    paper: '#fffdf8',
    ink: '#16372c',
    text: '#344b42',
    leaf: '#2c654e',
    sun: '#e3ad43',
    coral: '#bd5e3f',
    moss: '#dbe5d5',
    oat: '#eadfc9',
    muted: '#5b6b63',
    line: '#b8c5b8',
  }).map(([id, value]) => ({ id, name: id, value }));

  const sizes: Record<string, string[]> = {
    display: ['78px', '58px', '42px'],
    title: ['48px', '39px', '32px'],
    subtitle: ['27px', '25px', '23px'],
    lead: ['23px', '21px', '19px'],
    body: ['18px', '18px', '17px'],
    small: ['14px', '14px', '13px'],
    btn: ['15px', '15px', '15px'],
  };
  for (const style of tokens.text) {
    if (!sizes[style.id]) continue;
    style.css = {
      d: {
        'font-family': ['display', 'title', 'subtitle'].includes(style.id) ? Core.stackFor('Lora', 'f') : 'inherit',
        'font-size': sizes[style.id][0],
        'font-weight': ['display', 'title'].includes(style.id) ? '600' : '450',
        'line-height': ['display', 'title', 'subtitle'].includes(style.id) ? '1.08' : '1.58',
        'letter-spacing': ['display', 'title'].includes(style.id) ? '-.035em' : '0',
      },
      t: { 'font-size': sizes[style.id][1] },
      m: { 'font-size': sizes[style.id][2] },
    };
  }
  tokens.classes = [
    { id: 'soft-panel', name: 'Soft panel', css: { d: { 'background-color': token('moss') }, t: {}, m: {} } },
    { id: 'warm-panel', name: 'Warm panel', css: { d: { 'background-color': token('oat') }, t: {}, m: {} } },
    { id: 'ink-panel', name: 'Ink panel', css: { d: { 'background-color': token('ink'), color: token('paper') }, t: {}, m: {} } },
  ];

  Core.state.meta = {
    ...Core.state.meta,
    name: 'Commonwell Homekeeping',
    lang: 'en',
    maxWidth: '1380px',
    size: '18px',
    font: Core.stackFor('Raleway', 's'),
    headFont: Core.stackFor('Lora', 'f'),
    css: '',
    headHtml: '',
    baseUrl: '',
    ogImage: 'asset:hero-cleaning',
    favicon: 'asset:mark',
    blocks: [],
    components: [],
    collections: [],
    selfHostFonts: 0,
    tokens,
  };

  const headerLogo = node('header-logo', 'image', { src: 'asset:logo', alt: 'Commonwell Homekeeping', link: 'index.html', lazy: 0 }, { width: '290px', height: '62px', 'object-fit': 'contain' }, [], { width: '205px', height: '46px' });
  Core.state.header = [section('header', [box('header-row', [
    headerLogo,
    node('navigation', 'nav', {
      collapse: '960',
      aria: 'Main navigation',
      items: [
        { label: 'Services', href: 'services.html' },
        { label: 'Approach', href: 'approach.html' },
        { label: 'Contact', href: 'contact.html' },
      ],
    }, { color: token('ink'), 'font-size': '15px', '--nav-gap': '30px', '--nav-panel': token('paper'), '--nav-hover': token('coral') }),
  ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '26px' })], { padding: '17px 48px', 'background-color': token('paper'), 'border-bottom': `1px solid ${token('line')}` }, { padding: '13px 22px' })];

  Core.state.footer = [section('footer', [
    box('footer-main', [
      node('footer-logo', 'image', { src: 'asset:logo-reverse', alt: 'Commonwell Homekeeping', link: 'index.html', lazy: 0 }, { width: '270px', height: '58px', 'object-fit': 'contain' }, [], { width: '205px', height: '46px' }),
      box('footer-links', [
        link('Home', 'index.html', token('paper')),
        link('Services', 'services.html', token('paper')),
        link('Approach', 'approach.html', token('paper')),
        link('Quote inquiry', 'contact.html', token('paper')),
      ], { display: 'flex', 'flex-wrap': 'wrap', gap: '22px' }, { gap: '12px' }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px' }, { 'flex-direction': 'column', 'align-items': 'flex-start' }),
    box('footer-note', [
      text('Fictional demonstration business · Form delivery is not configured.', 'small', 'p', { color: '#d6e1d8', 'max-width': '75ch' }),
      text('Commonwell · Pagecraft template', 'small', 'p', { color: '#d6e1d8' }),
    ], { display: 'flex', 'justify-content': 'space-between', gap: '24px', 'margin-top': '26px', 'padding-top': '20px', 'border-top': '1px solid #47665a' }, { 'flex-direction': 'column' }),
  ], { padding: '38px 48px', 'background-color': token('ink') }, { padding: '34px 22px' })];

  Core.state.pages = [home(), services(), approach(), contact()];
  Core.state.cur = 0;
  normalize(Core.state.header);
  normalize(Core.state.footer);
  Core.state.pages.forEach(item => normalize(item.tree));
  return structuredClone(Core.doc());
}
