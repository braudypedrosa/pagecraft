import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';

type Style = Record<string, string>;
let serial = 0;
const token = Core.cvar;

const assetDimensions: Record<string, [string, string]> = {
  logo: ['720', '160'],
  'logo-light': ['720', '160'],
  'ledger-desk': ['1672', '941'],
  'records-in-hand': ['1536', '1024'],
  'archive-studio': ['1536', '1024'],
};

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
  value.id = `ledger-loom-${name}-${++serial}`;
  if (type === 'nav' || name === 'footer-links') value.css.d.width = 'auto';
  if (type === 'image') {
    const id = String(props.src || '').replace(/^asset:/, '');
    const [w, h] = assetDimensions[id] || ['1536', '1024'];
    value.props.w = w;
    value.props.h = h;
  }
  return value;
};

const box = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'box', { layout: desktop.display === 'grid' ? 'grid' : desktop.display === 'flex' ? 'flex' : 'block' }, desktop, children, mobile, tablet);

const text = (copy: string, ts = 'body', level = 'p', desktop: Style = {}, mobile: Style = {}) =>
  node('text', 'heading', { text: copy, ts, level }, { margin: '0', ...desktop }, [], mobile);

const section = (name: string, children: Node[], desktop: Style = {}, mobile: Style = {}, tablet: Style = {}) =>
  node(name, 'section', {}, { padding: '96px 48px', ...desktop }, children, { padding: '62px 22px', ...mobile }, { padding: '76px 32px', ...tablet });

const grid = (name: string, children: Node[], columns = '1fr 1fr', gap = '56px', desktop: Style = {}, mobile: Style = {}) =>
  box(name, children, { display: 'grid', 'grid-template-columns': columns, gap, ...desktop }, { 'grid-template-columns': '1fr', gap: '32px', ...mobile });

const image = (asset: string, alt: string, height = '520px', mobileHeight = '340px') =>
  node(asset, 'image', { src: `asset:${asset}`, alt, lazy: 1 }, { display: 'block', width: '100%', height, 'object-fit': 'cover', 'border-radius': '0' }, [], { height: mobileHeight });

const button = (label: string, href: string, light = false) => {
  const value = node('button', 'button', { text: label, link: href, ts: 'btn', variant: light ? 'outline' : 'solid' }, {
    padding: '14px 22px',
    'min-height': '48px',
    'border-radius': '2px',
    'border-width': light ? '1px' : '0',
    'border-style': 'solid',
    'border-color': light ? token('ivory') : token('ochre'),
    'background-color': light ? 'transparent' : token('ochre'),
    color: token('ivory'),
    'align-self': 'start',
    transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
  });
  value.st = {
    hover: { d: { 'background-color': light ? token('ivory') : token('ochre-dark'), color: light ? token('ink') : token('ivory'), 'border-color': token('ivory') }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('ochre-soft')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const quietLink = (label: string, href: string, color = token('ink')) => {
  const hoverColor = color === token('ivory') ? token('ochre-soft') : token('ochre');
  const value = node('link', 'button', { text: label, link: href, ts: 'btn', variant: 'link' }, {
    padding: '10px 0',
    'min-height': '44px',
    'border-width': '0',
    'background-color': 'transparent',
    color,
    'text-decoration': 'underline',
    'text-underline-offset': '7px',
    'text-decoration-thickness': '1px',
    'align-self': 'start',
  });
  value.st = {
    hover: { d: { color: hoverColor }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${token('ochre-soft')}`, 'outline-offset': '3px' }, t: {}, m: {} },
  };
  return value;
};

const eyebrow = (copy: string, desktop: Style = {}) => text(copy, 'small', 'p', {
  'text-transform': 'uppercase',
  'letter-spacing': '.16em',
  'font-weight': '650',
  ...desktop,
});

const anchor = (value: Node, id: string) => {
  value.adv.htmlId = id;
  return value;
};

const page = (slug: string, name: string, tree: Node[], desc: string): Page => ({
  id: `ledger-loom-page-${slug}`,
  slug,
  name,
  title: `${name} — Ledger & Loom`,
  desc,
  ogImage: slug === 'approach' ? 'asset:records-in-hand' : slug === 'contact' ? 'asset:archive-studio' : 'asset:ledger-desk',
  tree,
});

const pageIntro = (label: string, heading: string, copy: string) => section('page-intro', [
  box('page-intro-copy', [
    eyebrow(label, { color: token('ochre') }),
    text(heading, 'display', 'h1', { 'margin-top': '18px', 'max-width': '1020px' }),
    text(copy, 'lead', 'p', { 'margin-top': '24px', 'max-width': '58ch', color: token('muted') }),
  ], { 'max-width': '1160px' }),
], { padding: '68px 48px 78px', 'background-color': token('paper') }, { padding: '48px 22px 58px' });

const serviceRecord = (label: string, heading: string, copy: string, href?: string, dark = false) => {
  const value = box('service-record', [
    eyebrow(label, { color: dark ? token('ochre-soft') : token('ochre') }),
    text(heading, 'subtitle', 'h3', { color: dark ? token('ivory') : token('ink') }),
    box('service-record-copy', [
      text(copy, 'body', 'p', { color: dark ? token('ivory-muted') : token('muted'), 'max-width': '54ch' }),
      ...(href ? [quietLink('See service details', href)] : []),
    ], { display: 'flex', 'flex-direction': 'column', gap: '12px' }),
  ], { display: 'grid', 'grid-template-columns': '.45fr .8fr 1.35fr', gap: '34px', 'align-items': 'start', padding: '30px 0' }, { 'grid-template-columns': '1fr', gap: '12px', padding: '24px 0' });
  value.cls = ['ruled-record'];
  return value;
};

const practicePoint = (heading: string, copy: string, light = false) => box('practice-point', [
  text(heading, 'subtitle', 'h3', { color: light ? token('ivory') : token('ink') }),
  text(copy, 'body', 'p', { 'margin-top': '14px', color: light ? token('ivory-muted') : token('muted') }),
], { padding: '0 28px 0 0' }, { padding: '0' });

const packageBand = (name: string, bestFor: string, description: string, includes: string[]) => {
  const value = box('package-band', [
    box('package-heading', [
      eyebrow('Service package', { color: token('ochre') }),
      text(name, 'title', 'h2', { 'margin-top': '16px' }),
      text(bestFor, 'lead', 'p', { 'margin-top': '18px', color: token('muted'), 'max-width': '34ch' }),
    ]),
    box('package-detail', [
      text(description, 'body', 'p', { 'max-width': '58ch' }),
      box('package-includes', includes.map(item => text(item, 'body', 'p', { padding: '15px 0', 'border-top': `1px solid ${token('line')}` })), { 'margin-top': '26px' }),
    ]),
  ], { display: 'grid', 'grid-template-columns': '.82fr 1.18fr', gap: '80px', padding: '72px 0' }, { 'grid-template-columns': '1fr', gap: '30px', padding: '48px 0' });
  value.cls = ['ruled-record'];
  return value;
};

function homeHero() {
  const scene = image('ledger-desk', 'Ordered bookkeeping desk with an open ledger, calculator, folders and brass ruler', '720px', '650px');
  scene.props.lazy = 0;
  scene.css.d = { ...scene.css.d, position: 'absolute', inset: '0', height: '100%' };
  scene.css.t.height = '100%';
  scene.css.m.height = '100%';
  const hero = section('hero', [
    scene,
    box('hero-shade', [], { position: 'absolute', inset: '0', 'background-image': 'linear-gradient(90deg,rgba(29,27,24,.96) 0%,rgba(29,27,24,.88) 37%,rgba(29,27,24,.20) 70%,rgba(29,27,24,.06) 100%)' }, { 'background-image': 'linear-gradient(180deg,rgba(29,27,24,.92) 0%,rgba(29,27,24,.80) 65%,rgba(29,27,24,.56) 100%)' }),
    box('hero-copy', [
      eyebrow('Bookkeeping for steady businesses', { color: token('ochre-soft') }),
      text('Good books.\nClear records.\nCalmer months.', 'display', 'h1', { color: token('ivory'), 'margin-top': '20px', 'max-width': '720px', 'white-space': 'pre-line' }, { 'font-size': '44px' }),
      text('Ongoing bookkeeping, catch-up work, and payroll coordination shaped around the way your business already runs.', 'lead', 'p', { color: token('ivory-muted'), 'margin-top': '24px', 'max-width': '43ch' }),
      box('hero-actions', [button('Explore services', 'services.html'), button('Start a consultation', 'contact.html', true)], { display: 'flex', 'flex-wrap': 'wrap', gap: '14px', 'margin-top': '32px' }),
    ], { position: 'relative', 'z-index': '1', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'min-height': '720px', width: '54%', 'max-width': '720px' }, { 'min-height': '650px', width: '100%' }),
  ], { position: 'relative', overflow: 'hidden', padding: '0 48px', 'background-color': token('ink') }, { padding: '0 22px' }, { padding: '0 32px' });
  hero.props.width = 'full';
  return hero;
}

function home(): Page {
  return page('index', 'Home', [
    homeHero(),
    section('scope', [
      grid('scope-layout', [
        box('scope-intro', [
          eyebrow('A practical bookkeeping practice', { color: token('ochre') }),
          text('The records your business needs, kept in working order.', 'title', 'h2', { 'margin-top': '18px', 'max-width': '12ch' }),
          text('Choose a steady monthly routine or a focused reset. Every engagement begins with the records, systems, and responsibilities already in place.', 'body', 'p', { 'margin-top': '24px', color: token('muted'), 'max-width': '43ch' }),
        ]),
        box('scope-records', [
          serviceRecord('Ongoing', 'Monthly Books', 'Transaction categorisation, reconciliations, and a consistent month-end record for the people who need it.', 'services.html#monthly-books'),
          serviceRecord('Focused reset', 'Catch-up & Reset', 'A bounded review of overdue or untidy records, followed by an agreed path back to a maintainable routine.', 'services.html#catch-up'),
          serviceRecord('Coordinated', 'Payroll Support', 'Routine payroll coordination based on the agreed platform, schedule, approvals, and employer responsibilities.', 'services.html#payroll'),
        ]),
      ], '.72fr 1.28fr', '78px', { 'align-items': 'start' }),
    ], { 'background-color': token('paper') }),
    section('workbench', [
      grid('workbench-layout', [
        image('records-in-hand', 'Hands sorting paper records into an orderly filing tray', '610px', '390px'),
        box('workbench-copy', [
          eyebrow('Made to be maintained', { color: token('ochre') }),
          text('A useful set of books is a working habit, not a one-off tidy-up.', 'title', 'h2', { 'margin-top': '18px' }),
          text('We begin by agreeing what arrives, when it arrives, and who answers questions. That rhythm keeps the records easier to review and reduces the scramble at month end.', 'lead', 'p', { 'margin-top': '24px', 'max-width': '40ch' }),
          quietLink('How the practice works', 'approach.html'),
        ], { 'align-self': 'center' }),
      ], '1.18fr .82fr', '84px', { 'align-items': 'center' }),
    ], { 'background-color': token('ivory') }),
    section('monthly-rhythm', [
      grid('rhythm-heading', [
        box('rhythm-title', [eyebrow('A monthly rhythm', { color: token('ochre-soft') }), text('Quiet structure, repeated well.', 'title', 'h2', { color: token('ivory'), 'margin-top': '18px' })]),
        text('The exact cadence depends on the agreed package and systems. The shape stays simple: receive complete records, reconcile the activity, then return a usable review point.', 'body', 'p', { color: token('ivory-muted'), 'max-width': '52ch' }),
      ], '.8fr 1.2fr', '78px', { 'align-items': 'end' }),
      grid('rhythm-points', [
        practicePoint('Collect', 'A clear hand-off for documents, source data, and questions that need an owner.', true),
        practicePoint('Reconcile', 'Transactions and balances checked against the agreed records and accounts.', true),
        practicePoint('Review', 'A compact month-end hand-off with open items named plainly.', true),
      ], 'repeat(3,minmax(0,1fr))', '34px', { 'margin-top': '54px' }),
    ], { 'background-color': token('ink') }),
    section('fit', [
      grid('fit-layout', [
        box('fit-primary', [
          eyebrow('A considered fit', { color: token('ochre') }),
          text('For owners who want a repeatable record-keeping routine.', 'title', 'h2', { 'margin-top': '18px' }),
          text('A good starting point is a business with named accounts, an approved bookkeeping platform, and someone available to answer source-document questions.', 'body', 'p', { 'margin-top': '22px', 'max-width': '47ch' }),
        ]),
        box('fit-boundary', [
          text('Where another adviser belongs', 'subtitle', 'h3'),
          text('Personal tax advice, investment advice, legal interpretation, audit, and business valuation sit outside ordinary bookkeeping scope. The right specialist should lead those decisions.', 'body', 'p', { 'margin-top': '18px', color: token('muted') }),
          quietLink('Read the service boundaries', 'services.html#boundaries'),
        ], { padding: '34px', 'background-color': token('surface'), 'border-left': `4px solid ${token('ochre')}` }, { padding: '26px' }),
      ], '1.15fr .85fr', '78px', { 'align-items': 'start' }),
    ], { 'background-color': token('paper') }),
    photoCta(),
  ], 'Bookkeeping services for independent operators and small teams, presented with clear scope and a steady monthly rhythm.');
}

function photoCta() {
  const scene = image('archive-studio', 'Quiet bookkeeping studio with archival shelving and a walnut desk', '500px', '460px');
  scene.css.d = { ...scene.css.d, position: 'absolute', inset: '0', height: '100%' };
  scene.css.t.height = '100%';
  scene.css.m.height = '100%';
  const value = section('photo-cta', [
    scene,
    box('cta-shade', [], { position: 'absolute', inset: '0', 'background-image': 'linear-gradient(90deg,rgba(29,27,24,.94),rgba(29,27,24,.72) 55%,rgba(29,27,24,.20))' }),
    box('cta-copy', [
      eyebrow('Begin with the current picture', { color: token('ochre-soft') }),
      text('Tell us what needs keeping, catching up, or simplifying.', 'title', 'h2', { color: token('ivory'), 'margin-top': '18px', 'max-width': '720px' }),
      text('A first conversation is for understanding the records and defining a useful next step.', 'lead', 'p', { color: token('ivory-muted'), 'margin-top': '22px', 'max-width': '42ch' }),
      box('cta-action', [button('Start a consultation', 'contact.html')], { 'margin-top': '30px' }),
    ], { position: 'relative', 'z-index': '1', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'min-height': '500px' }, { 'min-height': '460px' }),
  ], { position: 'relative', overflow: 'hidden', padding: '0 48px', 'background-color': token('ink') }, { padding: '0 22px' }, { padding: '0 32px' });
  value.props.width = 'full';
  return value;
}

function services(): Page {
  return page('services', 'Services', [
    pageIntro('Bookkeeping services', 'A defined scope for each state of the books.', 'Choose the starting point that matches the records today. Final responsibilities, platforms, frequency, and hand-offs belong in the agreed scope.'),
    section('package-list', [
      anchor(packageBand('Monthly Books', 'For businesses ready for a repeatable month-end routine.', 'Ongoing bookkeeping keeps agreed accounts and records current on a regular cadence. The work is built around complete source information and clear ownership of questions.', ['Transaction categorisation within the agreed accounts', 'Bank and account reconciliations', 'Month-end open-items review', 'Record hand-off for the business and its appointed accountant']), 'monthly-books'),
      anchor(packageBand('Catch-up & Reset', 'For records that have fallen behind or need a bounded clean-up.', 'Catch-up work begins with a review of the available periods, accounts, source documents, and platform condition. The scope names what can be addressed and what needs another adviser.', ['Initial records and platform review', 'Agreed catch-up period and document list', 'Reconciliation and question log', 'Handover into a maintainable ongoing routine']), 'catch-up'),
      anchor(packageBand('Payroll Coordination', 'For a defined payroll cycle on an approved platform.', 'Payroll support follows the agreed system, cut-off, approvals, and employer responsibilities. It does not replace employment, tax, or legal advice.', ['Scheduled payroll preparation', 'Approved change and leave inputs', 'Payroll record reconciliation', 'Named exceptions returned for owner approval']), 'payroll'),
    ], { padding: '24px 48px 84px', 'background-color': token('paper') }, { padding: '12px 22px 58px' }),
    section('records-needed', [
      grid('records-needed-layout', [
        box('records-needed-copy', [
          eyebrow('What keeps the work moving', { color: token('ochre') }),
          text('Complete records. Named owners. Agreed cut-offs.', 'title', 'h2', { 'margin-top': '18px' }),
        ]),
        box('records-needed-points', [
          practicePoint('Source access', 'Approved access to the bookkeeping platform, relevant accounts, and source documents.'),
          practicePoint('A question owner', 'One person who can confirm transactions, changes, and missing information.'),
          practicePoint('A steady cut-off', 'Documents and approvals supplied by the agreed date for each cycle.'),
        ], { display: 'grid', gap: '34px' }),
      ], '.8fr 1.2fr', '88px', { 'align-items': 'start' }),
    ], { 'background-color': token('surface') }),
    anchor(section('boundaries', [
      grid('boundaries-layout', [
        image('archive-studio', 'Orderly archive shelves and a clear bookkeeping worktable', '470px', '330px'),
        box('boundaries-copy', [
          eyebrow('Service boundaries', { color: token('ochre') }),
          text('Bookkeeping records the business. Specialist advice belongs with the specialist.', 'title', 'h2', { 'margin-top': '18px' }),
          text('Tax positions, investments, legal obligations, audit opinions, valuations, and personal financial decisions sit outside ordinary bookkeeping scope. Those decisions need an appropriately qualified adviser.', 'body', 'p', { 'margin-top': '22px', color: token('muted'), 'max-width': '50ch' }),
          quietLink('Ask about a bookkeeping scope', 'contact.html'),
        ], { 'align-self': 'center' }),
      ], '1fr 1fr', '76px', { 'align-items': 'center' }),
    ], { 'background-color': token('ivory') }), 'boundaries'),
    photoCta(),
  ], 'Monthly bookkeeping, catch-up work, and payroll coordination with clear boundaries and no invented pricing.');
}

function approach(): Page {
  return page('approach', 'Approach', [
    pageIntro('How the practice works', 'Make the routine visible. Keep the questions owned.', 'The approach is designed around consistent hand-offs, explicit exceptions, and records that another responsible person can follow.'),
    section('approach-image', [image('records-in-hand', 'Bookkeeper sorting paper records into clearly separated folders', '660px', '420px')], { padding: '0 48px 86px', 'background-color': token('paper') }, { padding: '0 22px 58px' }),
    section('working-principles', [
      grid('principles-layout', [
        box('principles-intro', [
          eyebrow('Working principles', { color: token('ochre') }),
          text('Order comes from a shared routine.', 'title', 'h2', { 'margin-top': '18px' }),
          text('The system matters, but so do the moments where information changes hands.', 'lead', 'p', { 'margin-top': '22px', 'max-width': '36ch' }),
        ]),
        box('principles-list', [
          serviceRecord('Complete', 'Start with source records', 'Work from agreed statements, documents, approvals, and system access rather than reconstructed assumptions.'),
          serviceRecord('Explicit', 'Return open questions', 'Keep unclear activity visible, name who can answer it, and avoid silently deciding what belongs to the owner.'),
          serviceRecord('Repeatable', 'Close the loop', 'Use the same cut-off, review point, and hand-off so the monthly work becomes easier to maintain.'),
        ]),
      ], '.75fr 1.25fr', '84px', { 'align-items': 'start' }),
    ], { 'background-color': token('ivory') }),
    section('working-cycle', [
      grid('cycle-heading', [
        text('From first review to steady state.', 'title', 'h2', { color: token('ivory') }),
        text('A new engagement moves through a bounded setup before the recurring cadence begins. Exact timing depends on record condition, access, and response time.', 'body', 'p', { color: token('ivory-muted'), 'max-width': '54ch' }),
      ], '.8fr 1.2fr', '78px', { 'align-items': 'end' }),
      box('cycle-records', [
        serviceRecord('Understand', 'Review the current setup', 'Confirm accounts, platform, periods, source documents, existing roles, and the questions already known.', undefined, true),
        serviceRecord('Define', 'Agree the working scope', 'Name responsibilities, cut-offs, deliverables, exclusions, and the route for exceptions.', undefined, true),
        serviceRecord('Establish', 'Run the first cycle', 'Complete one working cycle, return open items, and adjust the hand-off where the process is unclear.', undefined, true),
        serviceRecord('Maintain', 'Repeat and review', 'Keep the cadence consistent and revisit the scope when the business or systems change.', undefined, true),
      ], { 'margin-top': '50px', color: token('ivory') }),
    ], { 'background-color': token('ink') }),
    section('practice-note', [
      grid('practice-note-layout', [
        box('practice-mark', [
          image('logo', 'Ledger & Loom bookkeeping practice', '170px', '118px'),
        ], { padding: '38px', 'background-color': token('paper'), 'border': `1px solid ${token('line')}` }, { padding: '26px' }),
        box('practice-note-copy', [
          eyebrow('Ledger & Loom', { color: token('ochre') }),
          text('A bookkeeping practice built around useful records and calm hand-offs.', 'title', 'h2', { 'margin-top': '18px' }),
          text('Good bookkeeping stays close to source records, keeps exceptions visible, and gives every recurring hand-off a clear owner.', 'body', 'p', { 'margin-top': '22px', color: token('muted') }),
          button('Start a consultation', 'contact.html'),
        ]),
      ], '.7fr 1.3fr', '82px', { 'align-items': 'center' }),
    ], { 'background-color': token('surface') }),
  ], 'A plain-language bookkeeping approach built around source records, named questions, and a repeatable monthly cadence.');
}

function contact(): Page {
  const form = node('consultation-form', 'form', {
    mode: 'external',
    action: '',
    method: 'post',
    aria: 'Bookkeeping consultation inquiry',
    submit: 'Send consultation request',
    fields: [
      { label: 'Name', name: 'name', type: 'text', required: 1, width: 50 },
      { label: 'Email', name: 'email', type: 'email', required: 1, width: 50 },
      { label: 'Business name', name: 'business', type: 'text', required: 0, width: 50 },
      { label: 'Current bookkeeping setup', name: 'setup', type: 'select', opts: 'Ongoing routine,Catch-up needed,Changing systems,Not sure yet', required: 1, width: 50 },
      { label: 'What would you like help with?', name: 'message', type: 'textarea', required: 1, width: 100 },
    ],
  }, {
    '--f-layout': 'flex',
    '--f-bg': token('paper'),
    '--f-border': token('line'),
    '--f-text': token('ink'),
    '--f-label': token('muted'),
    '--f-btn-bg': token('ochre'),
    '--f-btn-fg': token('ivory'),
    '--f-radius': '2px',
    '--f-gap': '18px',
    '--f-pad': '13px 14px',
    'font-size': '17px',
  }, [], { '--f-gap': '14px' });

  const faq = node('faq', 'accordion', {
    open: 'first',
    single: 1,
    marker: 'plus',
    items: [
      { q: 'What should I bring to a first conversation?', a: 'A short description of the business, the bookkeeping platform in use, which periods are current, and the main records or questions that need attention. Do not send confidential documents through an initial inquiry.' },
      { q: 'Can I ask for catch-up work only?', a: 'Yes. Catch-up can be scoped as a bounded project. The record condition, periods, access, and intended hand-off need review before the work is defined.' },
      { q: 'Does bookkeeping include tax or legal advice?', a: 'No. Bookkeeping can prepare and maintain agreed records. Tax positions, legal interpretation, investments, audit, and other regulated decisions belong with appropriately qualified advisers.' },
      { q: 'How is the service scope agreed?', a: 'The starting records, accounts, platform, frequency, responsibilities, and exclusions are reviewed before a package is confirmed.' },
    ],
  }, {
    width: '100%',
    '--ac-line': token('line'),
    '--ac-pad': '22px',
    '--ac-gap': '0px',
    '--ac-q-size': '18px',
    '--ac-q-weight': '600',
    '--ac-q-color': token('ink'),
    '--ac-a-size': '17px',
    '--ac-a-color': token('muted'),
    '--ac-mark': token('ochre'),
    '--ac-radius': '0px',
  }, [], { '--ac-pad': '18px', '--ac-q-size': '17px' });

  return page('contact', 'Contact', [
    pageIntro('Start a consultation', 'Begin with the records as they are today.', 'Share the bookkeeping setup, where the routine is working, and where it has become difficult. Do not include account numbers, payroll data, tax identifiers, or other sensitive records in an initial inquiry.'),
    section('contact-form', [
      grid('contact-form-layout', [
        box('form-panel', [
          text('Consultation request', 'subtitle', 'h2'),
          text('Form setup required: connect and test an approved submission destination before publishing. Until then, this form is intentionally disabled.', 'small', 'p', { 'margin-top': '12px', color: token('muted') }),
          box('form-wrap', [form], { 'margin-top': '30px' }),
        ], { padding: '42px', 'background-color': token('ivory'), 'border': `1px solid ${token('line')}` }, { padding: '26px' }),
        box('contact-context', [
          image('archive-studio', 'Quiet bookkeeping studio with orderly archive boxes and a clear writing desk', '420px', '300px'),
          box('contact-context-copy', [
            eyebrow('A useful first note', { color: token('ochre') }),
            text('Name the current state, not the perfect one.', 'subtitle', 'h2', { 'margin-top': '16px' }),
            text('Include the bookkeeping platform, the periods involved, whether payroll is in scope, and who can answer transaction questions.', 'body', 'p', { 'margin-top': '18px', color: token('muted') }),
          ], { 'margin-top': '28px' }),
        ]),
      ], '1.18fr .82fr', '72px', { 'align-items': 'start' }),
    ], { 'background-color': token('paper') }),
    section('faq-section', [
      grid('faq-layout', [
        box('faq-intro', [
          eyebrow('Before you get in touch', { color: token('ochre') }),
          text('Common starting questions.', 'title', 'h2', { 'margin-top': '18px' }),
          text('A first conversation works better when the current platform, record condition, and decision owners are already clear.', 'body', 'p', { 'margin-top': '22px', color: token('muted'), 'max-width': '38ch' }),
        ]),
        faq,
      ], '.72fr 1.28fr', '82px', { 'align-items': 'start' }),
    ], { 'background-color': token('surface') }),
  ], 'Start a bookkeeping consultation with clear scope and privacy prompts.');
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
    bg: '#f6f0e4',
    paper: '#fffaf0',
    ivory: '#f6f0e4',
    ink: '#1d1b18',
    text: '#332f29',
    ochre: '#854709',
    'ochre-dark': '#743b06',
    'ochre-soft': '#d59a4c',
    surface: '#e8dcc8',
    muted: '#655e53',
    'ivory-muted': '#e4d9c7',
    line: '#c9bda9',
  }).map(([id, value]) => ({ id, name: id.replace(/-/g, ' '), value }));
  tokens.classes = [
    {
      id: 'ruled-record',
      name: 'Ruled record',
      css: { d: { 'border-top': `1px solid ${token('line')}` }, t: {}, m: {} },
      st: { hover: { d: { 'border-top-color': token('ochre') }, t: {}, m: {} } },
    },
  ];
  const sizes: Record<string, string[]> = {
    display: ['76px', '58px', '42px'],
    title: ['48px', '39px', '32px'],
    subtitle: ['25px', '24px', '22px'],
    lead: ['22px', '21px', '19px'],
    body: ['18px', '18px', '17px'],
    small: ['14px', '14px', '13px'],
    btn: ['15px', '15px', '15px'],
  };
  for (const style of tokens.text) if (sizes[style.id]) style.css = {
    d: {
      'font-family': ['display', 'title', 'subtitle'].includes(style.id) ? Core.stackFor('Outfit', 's') : Core.stackFor('Work Sans', 's'),
      'font-size': sizes[style.id][0],
      'font-weight': ['display', 'title'].includes(style.id) ? '550' : style.id === 'subtitle' ? '600' : '400',
      'line-height': ['display', 'title', 'subtitle'].includes(style.id) ? '1.05' : '1.58',
      'letter-spacing': ['display', 'title'].includes(style.id) ? '-.045em' : '0',
    },
    t: { 'font-size': sizes[style.id][1] },
    m: { 'font-size': sizes[style.id][2] },
  };

  Core.state.meta = {
    ...Core.state.meta,
    name: 'Ledger & Loom',
    lang: 'en',
    maxWidth: '1380px',
    size: '18px',
    font: Core.stackFor('Work Sans', 's'),
    headFont: Core.stackFor('Outfit', 's'),
    css: '',
    headHtml: '',
    baseUrl: '',
    ogImage: 'asset:ledger-desk',
    favicon: 'asset:logo',
    blocks: [],
    components: [],
    collections: [],
    selfHostFonts: 0,
    tokens,
  };

  const logo = node('logo', 'image', { src: 'asset:logo', alt: 'Ledger & Loom bookkeeping practice', link: 'index.html', lazy: 0 }, { width: '270px', height: '60px', 'object-fit': 'contain', 'object-position': 'left center' }, [], { width: '205px', height: '46px' });
  Core.state.header = [section('header', [
    box('header-row', [
      logo,
      node('navigation', 'nav', {
        collapse: 'tablet',
        mobileMenu: 'dropdown',
        aria: 'Main navigation',
        menuLocation: 'primary',
        items: [
          { id: 'menu-services', label: 'Services', href: 'services.html', objectType: 'page', objectId: 'ledger-loom-page-services' },
          { id: 'menu-approach', label: 'Approach', href: 'approach.html', objectType: 'page', objectId: 'ledger-loom-page-approach' },
          { id: 'menu-contact', label: 'Contact', href: 'contact.html', objectType: 'page', objectId: 'ledger-loom-page-contact' },
        ],
      }, {
        color: token('ink'),
        'font-size': '15px',
        'font-weight': '600',
        '--nav-gap': '32px',
        '--nav-panel': token('paper'),
        '--nav-hover': token('ochre'),
      }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '26px' }),
  ], { padding: '17px 48px', 'background-color': token('paper'), 'border-bottom': `1px solid ${token('line')}` }, { padding: '13px 22px' }, { padding: '15px 32px' })];

  Core.state.footer = [section('footer', [
    box('footer-main', [
      node('footer-logo', 'image', { src: 'asset:logo-light', alt: 'Ledger & Loom bookkeeping practice', link: 'index.html', lazy: 0 }, { width: '260px', height: '58px', 'object-fit': 'contain', 'object-position': 'left center' }, [], { width: '210px', height: '48px' }),
      box('footer-links', [
        quietLink('Home', 'index.html', token('ivory')),
        quietLink('Services', 'services.html', token('ivory')),
        quietLink('Approach', 'approach.html', token('ivory')),
        quietLink('Contact', 'contact.html', token('ivory')),
      ], { display: 'flex', 'flex-wrap': 'wrap', gap: '10px 24px', 'align-items': 'center' }, { gap: '4px 18px' }),
    ], { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', gap: '28px' }, { 'flex-direction': 'column', 'align-items': 'flex-start' }),
    box('footer-note', [
      text('Fictional demo bookkeeping practice.', 'small', 'p', { color: token('ivory-muted') }),
      text('Ledger & Loom · Bookkeeping practice', 'small', 'p', { color: token('ivory-muted') }),
    ], { display: 'flex', 'justify-content': 'space-between', gap: '24px', 'margin-top': '26px', 'padding-top': '20px', 'border-top': `1px solid #514b42` }, { 'flex-direction': 'column', gap: '8px' }),
  ], { padding: '40px 48px', 'background-color': token('ink') }, { padding: '36px 22px' }, { padding: '38px 32px' })];

  Core.state.pages = [home(), services(), approach(), contact()];
  Core.state.cur = 0;
  normalize(Core.state.header);
  normalize(Core.state.footer);
  Core.state.pages.forEach(item => normalize(item.tree));
  return structuredClone(Core.doc());
}
