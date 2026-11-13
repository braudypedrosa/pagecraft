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
  value.id = `copperline-${name}-${++serial}`;
  if (type === 'nav' || name === 'footer-links') value.css.d.width = 'auto';
  if (type === 'image') {
    value.props.w = name.includes('logo') ? 520 : 1600;
    value.props.h = name.includes('logo') ? 96 : 1067;
  }
  return value;
};

const box = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'box', { layout: desktop.display === 'grid' ? 'grid' : desktop.display === 'flex' ? 'flex' : 'block' }, desktop, children, mobile, tablet);

const text = (copy: string, ts = 'body', level = 'p', desktop: Style = {}, mobile: Style = {}) =>
  node('text', 'heading', { text: copy, ts, level }, { margin: '0', ...desktop }, [], mobile);

const section = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'section', {}, { padding: '92px 48px', ...desktop }, children, { padding: '58px 22px', ...mobile }, { padding: '72px 32px', ...tablet });

const fullSection = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) => {
  const value = section(name, children, desktop, mobile, tablet);
  value.props.width = 'full';
  return value;
};

const grid = (name: string, children: Node[], columns = '1fr 1fr', gap = '52px', desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  box(name, children, { display: 'grid', 'grid-template-columns': columns, gap, ...desktop }, { 'grid-template-columns': '1fr', gap: '30px', ...mobile }, { 'grid-template-columns': columns === 'repeat(3,1fr)' ? '1fr 1fr' : columns, gap: '36px', ...tablet });

const image = (asset: string, alt: string, height = '520px', mobile = '340px') =>
  node(asset, 'image', { src: `asset:${asset}`, alt, lazy: 0 }, { display: 'block', width: '100%', height, 'object-fit': 'cover', 'border-radius': '4px' }, [], { height: mobile });

const button = (label: string, href: string, outline = false, light = false) => {
  const value = node('button', 'button', { text: label, link: href, ts: 'btn', variant: outline ? 'outline' : 'primary', icon: 'arrow' }, {
    padding: '14px 20px',
    'min-height': '48px',
    'border-radius': '2px',
    'border-width': outline ? '1px' : '0',
    'border-color': light ? token('cream') : token('ink'),
    'background-color': outline ? 'transparent' : token('copper'),
    color: outline ? (light ? token('cream') : token('ink')) : token('ink'),
    'align-self': 'start',
    transition: 'background-color 180ms ease,color 180ms ease,border-color 180ms ease',
  });
  value.st = {
    hover: { d: { 'background-color': outline ? (light ? '#30405d' : token('mist')) : '#f3a57d' }, t: {}, m: {} },
    focus: { d: { 'outline-color': token('focus'), 'outline-style': 'solid', 'outline-width': '3px', 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const link = (label: string, href: string, color = token('ink')) => {
  const value = node('link', 'button', { text: label, link: href, ts: 'btn', variant: 'outline', icon: 'arrow' }, {
    padding: '10px 0',
    'min-height': '44px',
    'border-width': '0',
    'background-color': 'transparent',
    color,
    'text-decoration': 'underline',
    'text-underline-offset': '6px',
    'align-self': 'start',
  });
  value.st = { focus: { d: { 'outline-color': token('focus'), 'outline-style': 'solid', 'outline-width': '3px', 'outline-offset': '3px' }, t: {}, m: {} } };
  return value;
};

const icon = (name: string, label: string) => node(`icon-${name}`, 'icon', { name, label }, { '--icon-size': '32px', color: token('copper') });
const eyebrow = (copy: string, desktop: Style = {}) => text(copy, 'eyebrow', 'p', desktop);
const anchor = (value: Node, id: string) => { value.adv.htmlId = id; return value; };
const page = (slug: string, name: string, tree: Node[]): Page => ({
  id: `copperline-page-${slug}`,
  slug,
  name,
  title: `${name} — Copperline Electric`,
  desc: 'A fictional electrician service demonstration site with editable native Pagecraft content.',
  tree,
});

const intro = (label: string, heading: string, copy: string, dark = false) => fullSection('page-intro', [
  box('intro-inner', [
    eyebrow(label, { color: dark ? token('copper') : token('blue') }),
    text(heading, 'display', 'h1', { 'margin-top': '18px', 'max-width': '1000px', color: dark ? token('cream') : token('ink') }),
    text(copy, 'lead', 'p', { 'margin-top': '24px', 'max-width': '62ch', color: dark ? token('cream-muted') : token('muted') }),
  ], { 'max-width': '1240px', margin: '0 auto' }),
], { padding: '72px 48px 82px', 'background-color': dark ? token('ink') : token('cream') }, { padding: '50px 22px 58px' });

const serviceRow = (iconName: string, title: string, copy: string, href = 'contact.html') => box('service-row', [
  icon(iconName, ''),
  box('service-copy', [text(title, 'subtitle', 'h3'), text(copy, 'body', 'p', { 'margin-top': '10px', 'max-width': '48ch' }), link('Discuss this work', href)], { display: 'flex', 'flex-direction': 'column' }),
], { display: 'grid', 'grid-template-columns': '52px 1fr', gap: '20px', padding: '28px 0', 'border-top': `1px solid ${token('line')}`, 'align-items': 'start' }, { 'grid-template-columns': '42px 1fr', gap: '14px' });

const processColumn = (label: string, title: string, copy: string) => box('process-column', [
  eyebrow(label, { color: token('copper') }),
  text(title, 'subtitle', 'h3', { 'margin-top': '14px', color: token('cream') }),
  text(copy, 'body', 'p', { 'margin-top': '14px', color: token('cream-muted') }),
], { padding: '30px 0', 'border-top': `1px solid ${token('ink-line')}` });

function hero(): Node {
  return fullSection('hero', [
    grid('hero-grid', [
      box('hero-copy', [
        eyebrow('Residential · Renovation · Small business', { color: token('blue') }),
        text('Electrical work, clearly considered.', 'display', 'h1', { 'margin-top': '18px', 'max-width': '720px' }),
        text('Thoughtful planning for home updates, lighting, rewiring and small workplace projects — from the first conversation to a useful handover.', 'lead', 'p', { 'margin-top': '24px', 'max-width': '52ch' }),
        box('hero-actions', [button('Start an inquiry', 'contact.html'), button('Explore services', 'services.html', true)], { display: 'flex', 'flex-wrap': 'wrap', gap: '14px', 'margin-top': '32px' }),
      ], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', padding: '62px 0' }, { padding: '10px 0 18px' }),
      image('panel-hero', 'Electrician reviewing an organized residential electrical panel', '690px', '430px'),
    ], '0.9fr 1.1fr', '66px', { 'align-items': 'stretch', 'max-width': '1440px', margin: '0 auto' }),
  ], { padding: '32px 48px 70px', 'background-color': token('cream') }, { padding: '24px 22px 52px' });
}

function home(): Page {
  return page('index', 'Home', [
    hero(),
    section('scope', [
      grid('scope-intro', [
        box('scope-heading', [eyebrow('Where Copperline fits'), text('Useful work starts with a useful brief.', 'title', 'h2', { 'margin-top': '16px' })]),
        text('From an uncertain fault to a full renovation, the work becomes easier to navigate when each decision is explained in plain language.', 'body', 'p', { 'max-width': '54ch' }),
      ], '1fr 1fr', '70px', { 'align-items': 'end' }),
      grid('scope-ledger', [
        box('scope-left', [serviceRow('settings', 'Switchboards & fault finding', 'Clear diagnosis, practical options and tidy documentation for the next decision.'), serviceRow('zap', 'Renovations & rewiring', 'Electrical planning that coordinates with the build instead of arriving as an afterthought.')]),
        box('scope-right', [serviceRow('sparkle', 'Lighting & controls', 'Layered light, switching and control choices shaped around how a room is used.'), serviceRow('box', 'Small business fit-outs', 'A straightforward path from site walk-through to a clear scope and handover.')]),
      ], '1fr 1fr', '72px', { 'margin-top': '46px' }),
    ]),
    fullSection('process', [
      box('process-inner', [
        grid('process-title', [
          box('process-heading', [eyebrow('A calm way through', { color: token('cream-muted') }), text('No mystery in the middle.', 'title', 'h2', { 'margin-top': '16px', color: token('cream') })]),
          text('The same three questions keep a project grounded: what does the space need, what should happen next, and what will be useful after the work is complete?', 'body', 'p', { color: token('cream-muted'), 'max-width': '52ch' }),
        ], '1fr 1fr', '70px', { 'align-items': 'end' }),
        grid('process-grid', [
          processColumn('Listen', 'Start with the space.', 'Share the room, problem, timing and constraints. The first task is to understand what the work needs to support.'),
          processColumn('Plan', 'Make the scope legible.', 'Set out assumptions, decisions and dependencies before tools arrive. Keep responsibilities and open questions easy to follow.'),
          processColumn('Finish', 'Leave a useful handover.', 'Record what changed, label what matters and explain the controls so the next person can use the space with confidence.'),
        ], 'repeat(3,1fr)', '34px', { 'margin-top': '46px' }, {}, { 'grid-template-columns': '1fr 1fr' }),
      ], { 'max-width': '1340px', margin: '0 auto' }),
    ], { 'background-color': token('ink') }),
    section('lighting-story', [
      grid('lighting-grid', [
        image('lighting-room', 'Warm layered lighting in a finished living and dining room', '590px', '350px'),
        box('lighting-copy', [
          eyebrow('Lighting as part of the room'),
          text('Plan the atmosphere before choosing the fitting.', 'title', 'h2', { 'margin-top': '16px' }),
          text('A strong lighting plan balances task, accent and ambient light with controls that feel obvious once the room is in use.', 'lead', 'p', { 'margin-top': '22px' }),
          link('See work and method', 'work.html'),
        ], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }),
      ], '1.15fr .85fr', '76px', { 'align-items': 'center' }),
    ], { 'background-color': token('mist') }),
    section('project-fit', [
      grid('fit-grid', [
        box('fit-copy', [eyebrow('Project fit'), text('A clearer first conversation.', 'title', 'h2', { 'margin-top': '16px' }), text('Bring the type of space, project stage and main concern. Even a rough plan is useful when the priorities are clear.', 'body', 'p', { 'margin-top': '22px', 'max-width': '46ch' })]),
        box('fit-list', [
          text('An older home with a changing electrical load', 'lead', 'p', { padding: '18px 0', 'border-top': `1px solid ${token('line')}` }),
          text('A renovation that needs early coordination', 'lead', 'p', { padding: '18px 0', 'border-top': `1px solid ${token('line')}` }),
          text('A small workplace needing a tidy, staged scope', 'lead', 'p', { padding: '18px 0', 'border-top': `1px solid ${token('line')}`, 'border-bottom': `1px solid ${token('line')}` }),
        ]),
      ], '.8fr 1.2fr', '84px', { 'align-items': 'start' }),
    ]),
    section('home-cta', [
      box('cta-band', [
        box('cta-copy', [eyebrow('Have a project in mind?', { color: token('cream-muted') }), text('Turn the first questions into a useful scope.', 'title', 'h2', { 'margin-top': '14px', color: token('cream'), 'max-width': '700px' })]),
        button('Start a project inquiry', 'contact.html', false),
      ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '32px', padding: '46px', 'background-color': token('blue') }, { 'flex-direction': 'column', 'align-items': 'flex-start', padding: '30px 24px' }),
    ], { padding: '70px 48px' }, { padding: '44px 22px' }),
  ]);
}

function services(): Page {
  return page('services', 'Services', [
    intro('Services', 'Electrical planning for spaces that need to work.', 'Explore electrical work for homes, renovations and small workplaces, with a clear scope from the first conversation.', true),
    section('service-detail', [
      grid('service-detail-grid', [
        image('rewire-detail', 'Gloved electrician routing cable during a residential renovation', '610px', '360px'),
        box('service-detail-copy', [
          eyebrow('Homes & renovations'),
          text('Work around the building, not against it.', 'title', 'h2', { 'margin-top': '16px' }),
          text('Early electrical planning keeps decisions visible across architecture, cabinetry, lighting, appliances and the build schedule.', 'body', 'p', { 'margin-top': '22px' }),
          box('service-points', [
            text('Renovation electrical planning', 'lead', 'p', { padding: '16px 0', 'border-top': `1px solid ${token('line')}` }),
            text('Switchboard and circuit review', 'lead', 'p', { padding: '16px 0', 'border-top': `1px solid ${token('line')}` }),
            text('Lighting, switching and power layouts', 'lead', 'p', { padding: '16px 0', 'border-top': `1px solid ${token('line')}`, 'border-bottom': `1px solid ${token('line')}` }),
          ], { 'margin-top': '30px' }),
        ], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }),
      ], '1.1fr .9fr', '74px', { 'align-items': 'center' }),
    ]),
    section('service-groups', [
      grid('service-groups-head', [text('Investigate. Improve. Coordinate.', 'title', 'h2'), text('Choose the starting point that fits your space. The details can take shape together.', 'body', 'p', { 'max-width': '52ch' })], '1fr 1fr', '70px', { 'align-items': 'end' }),
      grid('service-groups-grid', [
        box('service-group', [icon('zap', ''), text('Investigate', 'subtitle', 'h3', { 'margin-top': '22px' }), text('Trace the concern, explain the findings and set out a sensible next decision.', 'body', 'p', { 'margin-top': '14px' })], { padding: '30px', 'background-color': token('paper'), 'border-top': `4px solid ${token('copper')}` }),
        box('service-group', [icon('layers', ''), text('Improve', 'subtitle', 'h3', { 'margin-top': '22px' }), text('Plan switchboard, circuit, power and lighting improvements around the space as a whole.', 'body', 'p', { 'margin-top': '14px' })], { padding: '30px', 'background-color': token('paper'), 'border-top': `4px solid ${token('blue')}` }),
        box('service-group', [icon('sparkle', ''), text('Coordinate', 'subtitle', 'h3', { 'margin-top': '22px' }), text('Sequence renovation and small workplace work clearly with builders, designers and other trades.', 'body', 'p', { 'margin-top': '14px' })], { padding: '30px', 'background-color': token('paper'), 'border-top': `4px solid ${token('ink')}` }),
      ], 'repeat(3,1fr)', '24px', { 'margin-top': '42px' }, {}, { 'grid-template-columns': '1fr 1fr' }),
    ], { 'background-color': token('mist') }),
    section('project-ready', [
      grid('ready-grid', [
        box('ready-copy', [eyebrow('Before you inquire'), text('A little context makes the next step easier.', 'title', 'h2', { 'margin-top': '16px' })]),
        box('ready-list', [
          box('ready-item', [icon('map-pin', ''), text('The project location or intended service area', 'body', 'p')], { display: 'grid', 'grid-template-columns': '36px 1fr', gap: '16px', padding: '18px 0', 'border-top': `1px solid ${token('line')}` }),
          box('ready-item', [icon('calendar', ''), text('The project stage and any fixed dates', 'body', 'p')], { display: 'grid', 'grid-template-columns': '36px 1fr', gap: '16px', padding: '18px 0', 'border-top': `1px solid ${token('line')}` }),
          box('ready-item', [icon('info', ''), text('What has changed, what you have noticed and what you need the space to do', 'body', 'p')], { display: 'grid', 'grid-template-columns': '36px 1fr', gap: '16px', padding: '18px 0', 'border-top': `1px solid ${token('line')}`, 'border-bottom': `1px solid ${token('line')}` }),
        ]),
      ], '.8fr 1.2fr', '84px', { 'align-items': 'start' }),
    ]),
    anchor(section('service-faq', [
      grid('faq-grid', [
        box('faq-copy', [eyebrow('Practical questions'), text('A few useful answers before we begin.', 'title', 'h2', { 'margin-top': '16px' }), text('What to bring, when to get in touch, and how to shape an initial brief.', 'body', 'p', { 'margin-top': '20px' })]),
        node('faq', 'accordion', { single: 1, marker: 'plus', open: '0', items: [
          { q: 'Can I start before plans are finalized?', a: 'An initial brief can begin with the space, the changes you have in mind, and the questions still open.' },
          { q: 'What should I include in my brief?', a: 'Describe the property, your project stage, access requirements and any existing drawings. Leave sensitive documents out of the initial inquiry.' },
          { q: 'Does the inquiry form send a message?', a: 'Not yet. Its destination is intentionally blank until the site owner configures and tests a real delivery route.' },
        ] }, { '--acc-line': token('line'), '--acc-marker': token('blue'), '--acc-bg': 'transparent' }),
      ], '.75fr 1.25fr', '82px', { 'align-items': 'start' }),
    ], { 'background-color': token('cream') }), 'questions'),
  ]);
}

function work(): Page {
  return page('work', 'Work & Method', [
    intro('Work & method', 'Careful planning. Clear decisions. Useful handovers.', 'A look at the questions and decisions behind an electrical project. Planning scenarios and imagery below are illustrative.'),
    section('team-scene', [
      grid('team-grid', [
        image('team-planning', 'Two electricians reviewing plans at a workshop table', '590px', '360px'),
        box('team-copy', [eyebrow('The working table'), text('Questions first. Decisions in view.', 'title', 'h2', { 'margin-top': '16px' }), text('A shared plan gives homeowners, designers and trades one place to see what has been decided and what still needs an answer.', 'lead', 'p', { 'margin-top': '22px' }), link('Discuss your project', 'contact.html')], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }),
      ], '1.15fr .85fr', '76px', { 'align-items': 'center' }),
    ]),
    fullSection('scenario-band', [
      box('scenario-inner', [
        grid('scenario-head', [text('Sample planning scenarios.', 'title', 'h2', { color: token('cream') }), text('These are content examples, not completed Copperline projects, customer stories or measured outcomes.', 'body', 'p', { color: token('cream-muted'), 'max-width': '54ch' })], '1fr 1fr', '72px', { 'align-items': 'end' }),
        grid('scenario-grid', [
          box('scenario', [eyebrow('Older home refresh', { color: token('copper') }), text('Map what exists before choosing what changes.', 'subtitle', 'h3', { 'margin-top': '16px', color: token('cream') }), text('Begin with the existing condition, then separate safety concerns, changing needs and optional improvements into a readable scope.', 'body', 'p', { 'margin-top': '14px', color: token('cream-muted') })], { padding: '28px 0', 'border-top': `1px solid ${token('ink-line')}` }),
          box('scenario', [eyebrow('Kitchen + living', { color: token('copper') }), text('Coordinate power, lighting and cabinetry early.', 'subtitle', 'h3', { 'margin-top': '16px', color: token('cream') }), text('Connect the electrical plan with task lighting, appliances, furniture and the way people move between rooms.', 'body', 'p', { 'margin-top': '14px', color: token('cream-muted') })], { padding: '28px 0', 'border-top': `1px solid ${token('ink-line')}` }),
          box('scenario', [eyebrow('Small workspace', { color: token('copper') }), text('Stage the work around access and continuity.', 'subtitle', 'h3', { 'margin-top': '16px', color: token('cream') }), text('Define access, sequencing and handover needs before turning the brief into a practical work plan.', 'body', 'p', { 'margin-top': '14px', color: token('cream-muted') })], { padding: '28px 0', 'border-top': `1px solid ${token('ink-line')}` }),
        ], 'repeat(3,1fr)', '34px', { 'margin-top': '44px' }, {}, { 'grid-template-columns': '1fr 1fr' }),
      ], { 'max-width': '1340px', margin: '0 auto' }),
    ], { 'background-color': token('ink') }),
    section('method-detail', [
      grid('method-grid', [
        box('method-copy', [eyebrow('A useful finish'), text('A handover people can use.', 'title', 'h2', { 'margin-top': '16px' }), text('Clear labels, updated notes and a practical demonstration help the next person understand what changed and how the space now works.', 'body', 'p', { 'margin-top': '22px' }), button('Ask about the process', 'contact.html', true)], { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center' }),
        image('rewire-detail', 'Close view of organized cable work during a renovation', '500px', '330px'),
      ], '.85fr 1.15fr', '76px', { 'align-items': 'center' }),
    ], { 'background-color': token('mist') }),
  ]);
}

function contact(): Page {
  const inquiry = node('inquiry-form', 'form', {
    mode: 'external', action: '', method: 'post', aria: 'Project inquiry form', submit: 'Prepare inquiry', fields: [
      { label: 'Name', name: 'name', type: 'text', required: 1, half: 1 },
      { label: 'Email', name: 'email', type: 'email', required: 1, half: 1 },
      { label: 'Phone (optional)', name: 'phone', type: 'tel', required: 0, half: 1 },
      { label: 'Service interest', name: 'service', type: 'select', opts: 'Fault finding or review,Renovation or rewiring,Lighting and controls,Small business fit-out,Something else', required: 1, half: 1 },
      { label: 'Project location', name: 'location', type: 'text', required: 1 },
      { label: 'What would you like to plan?', name: 'message', type: 'textarea', required: 1 },
    ],
  }, {
    '--f-bg': token('paper'), '--f-border': token('line'), '--f-text': token('ink'), '--f-btn-bg': token('copper'), '--f-btn-fg': token('ink'), '--f-radius': '2px', '--f-gap': '18px', 'font-size': '17px',
  });
  return page('contact', 'Contact', [
    intro('Contact', 'A useful inquiry starts with context.', 'This demonstration publishes no real phone number, email address, office location or service area. Configure verified contact details before launch.', true),
    anchor(section('contact-form', [
      grid('contact-grid', [
        box('contact-copy', [
          eyebrow('Demo inquiry'),
          text('Tell the project story so far.', 'title', 'h2', { 'margin-top': '16px' }),
          text('The form is intentionally unconfigured. Submitting cannot deliver a message until a site owner adds and tests an approved destination.', 'body', 'p', { 'margin-top': '22px', 'max-width': '44ch' }),
          box('contact-disclosure', [icon('alert', ''), text('No message delivery, booking, response time or availability is promised by this demo.', 'small', 'p')], { display: 'grid', 'grid-template-columns': '32px 1fr', gap: '14px', padding: '20px', 'margin-top': '30px', 'background-color': token('mist') }),
          box('contact-placeholder', [text('Contact details', 'subtitle', 'h3'), text('No live phone number, inbox or service area is published in this demonstration.', 'body', 'p', { 'margin-top': '14px' })], { 'margin-top': '34px' }),
        ]),
        box('form-wrap', [inquiry, text('Demo state: destination not configured. Replace this note only after a successful end-to-end delivery test.', 'small', 'p', { 'margin-top': '16px', color: token('muted') })], { padding: '34px', 'background-color': token('paper'), 'border-top': `4px solid ${token('copper')}` }, { padding: '24px 18px' }),
      ], '.8fr 1.2fr', '72px', { 'align-items': 'start' }),
    ]), 'inquiry'),
    section('contact-next', [
      grid('contact-next-grid', [
        box('contact-next-copy', [eyebrow('A better first brief'), text('Useful details to bring.', 'title', 'h2', { 'margin-top': '16px' })]),
        box('contact-next-list', [
          text('The room, building or part of the project involved.', 'lead', 'p', { padding: '17px 0', 'border-top': `1px solid ${token('line')}` }),
          text('What changed, what you noticed and what you need next.', 'lead', 'p', { padding: '17px 0', 'border-top': `1px solid ${token('line')}` }),
          text('The project stage and any timing constraints already known.', 'lead', 'p', { padding: '17px 0', 'border-top': `1px solid ${token('line')}`, 'border-bottom': `1px solid ${token('line')}` }),
        ]),
      ], '.8fr 1.2fr', '84px', { 'align-items': 'start' }),
    ], { 'background-color': token('mist') }),
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
    cream: '#f7f2e8', paper: '#fffdf8', ink: '#17243c', blue: '#1e40af', copper: '#e76a32', mist: '#e8eef6', text: '#2f3b4d', muted: '#536174', line: '#c8d0dc', focus: '#f59e0b', 'cream-muted': '#d7dfec', 'ink-line': '#536078',
  }).map(([id, value]) => ({ id, name: id.replace(/-/g, ' '), value }));
  const sizes: Record<string, string[]> = {
    display: ['72px', '56px', '42px'], title: ['46px', '38px', '31px'], subtitle: ['25px', '23px', '22px'], lead: ['21px', '20px', '18px'], body: ['17px', '17px', '16px'], small: ['14px', '14px', '14px'], eyebrow: ['13px', '13px', '12px'], btn: ['15px', '15px', '15px'],
  };
  for (const style of tokens.text) if (sizes[style.id]) style.css = {
    d: {
      'font-family': ['display', 'title'].includes(style.id) ? Core.stackFor('Inter', 's') : style.id === 'lead' ? Core.stackFor('Playfair Display', 'f') : 'inherit',
      'font-size': sizes[style.id][0],
      'font-weight': ['display', 'title', 'subtitle', 'btn'].includes(style.id) ? '700' : style.id === 'eyebrow' ? '800' : '400',
      'line-height': ['display', 'title'].includes(style.id) ? '1.02' : '1.55',
      'letter-spacing': ['display', 'title'].includes(style.id) ? '-.045em' : style.id === 'eyebrow' ? '.12em' : '0',
      'text-transform': style.id === 'eyebrow' ? 'uppercase' : 'none',
      color: ['eyebrow', 'subtitle', 'display', 'title'].includes(style.id) ? token('ink') : style.id === 'body' ? token('text') : token('muted'),
    },
    t: { 'font-size': sizes[style.id][1] },
    m: { 'font-size': sizes[style.id][2] },
  };
  Core.state.meta = {
    ...Core.state.meta,
    name: 'Copperline Electric', lang: 'en', maxWidth: '1360px', size: '17px', font: Core.stackFor('Inter', 's'), headFont: Core.stackFor('Inter', 's'), css: '', headHtml: '', baseUrl: '', ogImage: 'asset:panel-hero', favicon: 'asset:logo', blocks: [], components: [], collections: [], selfHostFonts: 0, tokens,
  };

  const headerLogo = node('header-logo', 'image', { src: 'asset:logo', alt: 'Copperline Electric', link: 'index.html', lazy: 0 }, { width: '286px', height: '53px', 'object-fit': 'contain' }, [], { width: '215px', height: '40px' });
  const nav = node('navigation', 'nav', {
    collapse: '940', mobileMenu: 'dropdown', menuLocation: 'primary', aria: 'Main navigation', items: [
      { id: 'nav-home', label: 'Home', href: 'index.html' },
      { id: 'nav-services', label: 'Services', href: 'services.html' },
      { id: 'nav-work', label: 'Work & Method', href: 'work.html' },
      { id: 'nav-contact', label: 'Contact', href: 'contact.html' },
    ],
  }, { color: token('ink'), 'font-size': '15px', '--nav-gap': '28px', '--nav-panel': token('cream'), '--nav-hover': token('blue') });
  const headerAction = button('Project inquiry', 'contact.html');
  headerAction.css.m.display = 'none';
  Core.state.header = [fullSection('header', [box('header-row', [headerLogo, nav, headerAction], { display: 'grid', 'grid-template-columns': 'auto 1fr auto', 'align-items': 'center', gap: '28px', 'max-width': '1440px', margin: '0 auto' }, { 'grid-template-columns': '1fr auto', gap: '14px' })], { padding: '16px 48px', 'background-color': token('cream'), 'border-bottom': `1px solid ${token('line')}` }, { padding: '12px 18px' })];

  Core.state.footer = [fullSection('footer', [
    box('footer-top', [
      node('footer-logo', 'image', { src: 'asset:logo-light', alt: 'Copperline Electric', link: 'index.html', lazy: 0 }, { width: '250px', height: '46px', 'object-fit': 'contain' }, [], { width: '220px', height: '41px' }),
      box('footer-links', [link('Services', 'services.html', token('cream')), link('Work & Method', 'work.html', token('cream')), link('Contact', 'contact.html', token('cream'))], { display: 'flex', 'flex-wrap': 'wrap', gap: '22px' }, { 'flex-direction': 'column', gap: '6px' }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px', 'max-width': '1340px', margin: '0 auto' }, { 'flex-direction': 'column', 'align-items': 'flex-start' }),
    box('footer-note', [
      text('Fictional demo business. Replace all details before publishing.', 'small', 'p', { color: token('cream-muted') }),
      text('Copperline Electric · Pagecraft template', 'small', 'p', { color: token('cream-muted') }),
    ], { display: 'flex', 'justify-content': 'space-between', gap: '24px', 'margin-top': '28px', 'padding-top': '20px', 'border-top': `1px solid ${token('ink-line')}`, 'max-width': '1340px', 'margin-left': 'auto', 'margin-right': 'auto' }, { 'flex-direction': 'column' }),
  ], { padding: '40px 48px', 'background-color': token('ink') }, { padding: '36px 22px' })];

  Core.state.pages = [home(), services(), work(), contact()];
  Core.state.cur = 0;
  normalize(Core.state.header);
  normalize(Core.state.footer);
  Core.state.pages.forEach(item => normalize(item.tree));
  return structuredClone(Core.doc());
}
