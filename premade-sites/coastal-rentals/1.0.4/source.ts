import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';

const C = Core.cvar;
const N = Core.N as (type: string, props?: Record<string, unknown>, css?: Record<string, Record<string, string>>, children?: Node[]) => Node;
const BOX = Core.BOX as (top: string, right: string, bottom: string, left: string) => Record<string, string>;
type Css = Record<string, Record<string, string>>;
const asset = (id: string) => `asset:marea-${id}`;

const named = (node: Node, cls: string) => {
  node.adv = { ...(node.adv || {}), cls: [node.adv?.cls, cls].filter(Boolean).join(' ') };
  return node;
};
const reveal = (node: Node, delay = '0s') => {
  node.anim = { name: 'fade-up', dur: '.65s', delay, ease: 'ease-out', once: 1 };
  return node;
};
const heading = (copy: string, style: 'display' | 'title' | 'subtitle', level: 'h1' | 'h2' | 'h3' | 'div' = 'h2', css: Css = {}) => N('heading', { text: copy, ts: style, level }, css);
const text = (html: string, style: 'lead' | 'body' | 'small' = 'body', css: Css = {}) => N('text', { html, ts: style }, css);
const image = (src: string, alt: string, css: Record<string, string> = {}, mobile: Record<string, string> = {}, lazy = true) => N('image', { src, alt, w: '1536', h: '1024', lazy: lazy ? 1 : 0 }, { d: { width: '100%', height: '100%', 'object-fit': 'cover', ...css }, t: {}, m: mobile });
const column = (grow: number, children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}) => N('column', {}, {
  d: {
    'flex-grow': String(grow), 'flex-basis': grow === 0 ? 'auto' : '0', 'min-width': '0',
    ...(grow === 0 ? { 'flex-shrink': '0' } : {}), ...css
  },
  t: {}, m: { 'flex-basis': '100%', ...(grow === 0 ? { 'flex-shrink': '1' } : {}), ...mobile }
}, children);
const row = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}) => N('row', {}, { d: { gap: '36px', ...css }, t: {}, m: { gap: '24px', ...mobile } }, children);
const section = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}, tag = 'section') => N('section', { tag }, { d: { ...BOX('104px', '32px', '104px', '32px'), ...css }, t: { ...BOX('80px', '24px', '80px', '24px') }, m: { ...BOX('64px', '18px', '64px', '18px'), ...mobile } }, children);

const button = (label: string, link: string, mode: 'dark' | 'light' | 'line' = 'dark') => {
  const node = N('button', { text: label, link, ts: 'btn', variant: mode === 'line' ? 'outline' : 'solid', icon: 'arrow' }, {
    d: mode === 'dark'
      ? { 'background-color': C('ink'), color: C('paper'), padding: '14px 20px', 'border-radius': '2px', 'min-height': '48px' }
      : mode === 'light'
        ? { 'background-color': C('paper'), color: C('ink'), padding: '14px 20px', 'border-radius': '2px', 'min-height': '48px' }
        : { 'background-color': 'transparent', color: C('ink'), padding: '13px 19px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('ink'), 'border-radius': '2px', 'min-height': '48px' },
    t: {}, m: { width: '100%' }
  });
  node.st = {
    hover: { d: { transform: 'translateY(-2px)', opacity: '.88' }, t: {}, m: {} },
    focus: { d: { outline: `3px solid ${C('signal')}`, 'outline-offset': '3px' }, t: {}, m: {} }
  };
  return node;
};

const proseIntro = (title: string, copy: string, inverse = false) => N('box', { layout: 'block' }, { d: { 'max-width': '720px' }, t: {}, m: {} }, [
  heading(title, 'title', 'h2', { d: { color: inverse ? C('paper') : C('ink'), 'max-width': '19ch' }, t: {}, m: {} }),
  text(`<p>${copy}</p>`, 'lead', { d: { color: inverse ? C('paper-muted') : C('muted'), 'max-width': '58ch', 'margin-top': '22px' }, t: {}, m: {} })
]);

interface Stay {
  slug: string; name: string; place: string; note: string; intro: string; detail: string;
  assetId: string; alt: string; sleeps: string; mood: string;
}

const stays: Stay[] = [
  { slug: 'stone-cove-house', name: 'Stone Cove House', place: 'North cove', note: 'Sea edge · Two bedrooms', intro: 'A low limestone house with the water at the end of the path.', detail: 'The plan moves from a sheltered living room to a quiet terrace. Pale stone, oak, and linen keep the rooms composed while the coast remains the main event.', assetId: 'stone-cove-house', alt: 'Low limestone vacation house beside dune grass and the sea', sleeps: 'Made for four guests', mood: 'Open horizon' },
  { slug: 'pine-court-house', name: 'Pine Court House', place: 'West pines', note: 'Woodland edge · Two bedrooms', intro: 'A cedar retreat held between rock, moss, and wind-shaped pines.', detail: 'The house gathers around one long shared room, then opens to a shaded outdoor table. It is the collection’s quietest setting: close to the coast, but screened by trees.', assetId: 'pine-court-house', alt: 'Cedar vacation house among wind-shaped coastal pine trees', sleeps: 'Made for four guests', mood: 'Woodland shelter' },
  { slug: 'harbor-studio', name: 'Harbor Studio', place: 'Old harbor', note: 'Waterside · One bedroom', intro: 'A compact studio with a deep window seat above the harbor.', detail: 'Blue joinery gives the small plan its rhythm. The bed, desk, and window seat each have a clear place, making this the easiest stay for a solo week or a short trip for two.', assetId: 'harbor-studio', alt: 'Deep blue harbor studio bedroom with window seat and water view', sleeps: 'Made for two guests', mood: 'Harbor outlook' },
  { slug: 'garden-casita', name: 'Garden Casita', place: 'Olive garden', note: 'Courtyard · One bedroom', intro: 'A whitewashed casita arranged around a shaded garden court.', detail: 'The courtyard is the center of the stay: a place for coffee, lunch, and the last light of the day. Inside, simple rooms keep the garden visible from every turn.', assetId: 'garden-casita', alt: 'Whitewashed vacation casita with olive trees and a shaded courtyard', sleeps: 'Made for two guests', mood: 'Garden shade' }
];

const stayCard = (stay: Stay) => {
  const node = N('box', { layout: 'block', tag: 'article', link: `${stay.slug}.html` }, { d: { 'background-color': C('paper'), 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line'), overflow: 'hidden', 'min-height': '100%' }, t: {}, m: {} }, [
    image(asset(stay.assetId), stay.alt, { height: '330px', 'border-radius': '0' }, { height: '250px', 'border-radius': '0' }),
    N('box', { layout: 'block' }, { d: { padding: '26px 26px 28px' }, t: {}, m: { padding: '22px 20px 24px' } }, [
      text(`<p>${stay.place}</p>`, 'small', { d: { color: C('clay'), 'font-weight': '650' }, t: {}, m: {} }),
      heading(stay.name, 'subtitle', 'h3', { d: { 'font-size': '25px', 'font-family': Core.stackFor('Newsreader', 'f'), 'font-weight': '500', 'margin-top': '8px' }, t: {}, m: { 'font-size': '23px' } }),
      text(`<p>${stay.intro}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '13px', 'max-width': '45ch' }, t: {}, m: {} }),
      text(`<p>${stay.note} &nbsp;→</p>`, 'small', { d: { color: C('ink'), 'font-weight': '650', 'margin-top': '22px' }, t: {}, m: {} })
    ])
  ]);
  node.st = { hover: { d: { 'border-color': C('ink') }, t: {}, m: {} }, focus: { d: { outline: `3px solid ${C('signal')}`, 'outline-offset': '3px' }, t: {}, m: {} } };
  return node;
};

const stayGrid = () => N('box', { layout: 'grid' }, { d: { 'grid-template-columns': 'repeat(2,minmax(0,1fr))', gap: '18px', 'margin-top': '54px' }, t: {}, m: { 'grid-template-columns': '1fr', gap: '14px', 'margin-top': '38px' } }, stays.map(stayCard));

const header = () => {
  const action = button('Plan a stay', 'contact.html', 'dark');
  action.css.d['align-self'] = 'flex-end';
  return [named(N('section', { tag: 'header' }, {
    d: { ...BOX('15px', '32px', '15px', '32px'), 'background-color': C('paper'), 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': C('line'), position: 'sticky', top: '0px', 'z-index': '80' },
    t: { ...BOX('14px', '24px', '14px', '24px') }, m: { ...BOX('12px', '18px', '12px', '18px') }
  }, [row([
    column(23, [heading('Marea', 'subtitle', 'div', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': '25px', 'font-weight': '550', 'letter-spacing': '-.02em' }, t: {}, m: { 'font-size': '23px' } })]),
    column(57, [N('nav', { collapse: '760', aria: 'Main navigation', items: [{ label: 'Stays', href: 'stays.html' }, { label: 'Guest services', href: 'services.html' }, { label: 'About', href: 'about.html' }, { label: 'Contact', href: 'contact.html' }] }, { d: { color: C('ink'), '--nav-hover': C('clay'), '--nav-gap': '28px', '--nav-panel': C('paper'), 'justify-content': 'center' }, t: {}, m: {} })]),
    column(20, [action], { display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end' }, { display: 'none' })
  ], { 'align-items': 'center', 'flex-wrap': 'nowrap', gap: '20px' }, { gap: '12px' })]), 'marea-header')];
};

const footer = () => [named(section([
  row([
    column(52, [heading('Marea', 'title', 'h2', { d: { color: C('paper'), 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': '43px', 'font-weight': '500' }, t: {}, m: { 'font-size': '36px' } }), text('<p>Four fictional stays composed as a Pagecraft template for independent vacation-rental hosts.</p>', 'body', { d: { color: C('paper-muted'), 'max-width': '39ch', 'margin-top': '18px' }, t: {}, m: {} })]),
    column(22, [text('<p><a href="stays.html">Stays</a><br><a href="services.html">Guest services</a><br><a href="about.html">About</a><br><a href="contact.html">Contact</a></p>', 'small', { d: { color: C('paper-muted'), '--link': C('paper'), 'line-height': '2.15' }, t: {}, m: {} })]),
    column(26, [text('<p>North cove<br>West pines<br>Old harbor<br>Olive garden</p>', 'small', { d: { color: C('paper-muted'), 'line-height': '2.15' }, t: {}, m: {} })])
  ], { 'align-items': 'flex-start', gap: '48px' }),
  row([column(60, [text('<p>Sample vacation-rental collection</p>', 'small', { d: { color: C('paper-muted') }, t: {}, m: {} })]), column(40, [text('<p>Built to be reshaped in Pagecraft</p>', 'small', { d: { color: C('paper-muted'), 'text-align': 'right' }, t: {}, m: { 'text-align': 'left' } })])], { 'margin-top': '68px', 'padding-top': '22px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('ink-line') })
], { 'background-color': C('ink'), color: C('paper') }, {}, 'footer'), 'marea-footer')];

const darkCta = (title: string, copy: string) => {
  const action = button('Start an inquiry', 'contact.html', 'light');
  action.css.d['align-self'] = 'flex-end';
  action.css.m['align-self'] = 'stretch';
  return section([row([
    column(66, [heading(title, 'title', 'h2', { d: { color: C('paper'), 'max-width': '19ch' }, t: {}, m: {} }), text(`<p>${copy}</p>`, 'lead', { d: { color: C('paper-muted'), 'max-width': '48ch', 'margin-top': '22px' }, t: {}, m: {} })]),
    column(34, [action], { display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', 'justify-content': 'center' })
  ], { 'align-items': 'center', gap: '48px' })], {
    'background-color': C('ink'),
    'background-image': `linear-gradient(90deg,rgba(23,35,30,.94) 0%,rgba(23,35,30,.82) 58%,rgba(23,35,30,.66) 100%),url("${asset('coastal-path')}")`,
    'background-size': 'cover', 'background-position': 'center', color: C('paper'), 'min-height': '420px', display: 'flex', 'align-items': 'center'
  }, { 'min-height': '390px', 'background-image': `linear-gradient(180deg,rgba(23,35,30,.93),rgba(23,35,30,.78)),url("${asset('coastal-path')}")` });
};

const homeHero = () => {
  const primary = button('Explore the stays', 'stays.html', 'light');
  const secondary = button('How Marea works', 'about.html', 'line');
  secondary.css.d.color = C('paper');
  secondary.css.d['border-color'] = C('paper');
  secondary.css.d['background-color'] = 'rgba(23,35,30,.18)';
  secondary.css.m.color = C('paper');
  secondary.css.m['border-color'] = C('paper');
  secondary.css.m['background-color'] = 'rgba(23,35,30,.18)';

  return named(section([
    N('box', { layout: 'block' }, { d: { 'max-width': '680px' }, t: {}, m: {} }, [
      reveal(heading('A quieter way to stay by the coast.', 'display', 'h1', { d: { color: C('paper'), 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(50px,5.5vw,72px)', 'font-weight': '500', 'line-height': '.98', 'letter-spacing': '-.035em', 'max-width': '12ch' }, t: {}, m: { 'font-size': '43px' } })),
      reveal(text('<p>Marea is a fictional collection of four distinct homes shaped around salt air, long meals, and unhurried days.</p>', 'lead', { d: { color: C('paper-muted'), 'max-width': '42ch', 'margin-top': '25px' }, t: {}, m: {} }), '.08s'),
      reveal(row([column(0, [primary]), column(0, [secondary])], { 'margin-top': '32px', gap: '12px' }), '.16s')
    ])
  ], {
    'background-color': C('ink'),
    'background-image': `linear-gradient(90deg,rgba(18,30,25,.86) 0%,rgba(18,30,25,.62) 48%,rgba(18,30,25,.08) 82%),url("${asset('coastal-living-room')}")`,
    'background-size': 'cover',
    'background-position': 'center 58%',
    color: C('paper'),
    'min-height': '730px',
    display: 'flex',
    'align-items': 'flex-end',
    padding: '76px 32px'
  }, {
    'background-image': `linear-gradient(180deg,rgba(18,30,25,.28) 0%,rgba(18,30,25,.82) 72%),url("${asset('coastal-living-room')}")`,
    'background-position': '58% center',
    'min-height': '680px',
    padding: '48px 18px'
  }), 'marea-hero');
};

const home = (): Page => ({
  id: 'page-home', name: 'Home', slug: 'index', title: 'Marea — A quieter way to stay by the coast', desc: 'A fictional collection of four coastal vacation rentals, designed as a fully editable Pagecraft template.', ogImage: asset('coastal-living-room'), tree: [
    homeHero(),
    section([proseIntro('Four homes, each with its own pace.', 'Choose the setting first: the open cove, the pine court, the old harbor, or the garden. Every card leads to a complete, editable stay page.'), stayGrid()], { 'background-color': C('sand') }),
    section([row([
      column(52, [image(asset('coastal-path'), 'Weathered path through dune grass leading to a quiet blue cove', { height: '570px' }, { height: '340px' })]),
      column(48, [heading('Leave room for the day to change its mind.', 'title', 'h2', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(36px,4vw,52px)', 'font-weight': '500', 'max-width': '15ch' }, t: {}, m: { 'font-size': '34px' } }), text('<p>The collection is designed around simple choices: walk or swim, cook or wander, gather at the table or close the door for an afternoon.</p><p>Use this page to tell guests what the place feels like before asking them to choose dates.</p>', 'lead', { d: { color: C('muted'), 'max-width': '43ch', 'margin-top': '26px' }, t: {}, m: {} }), text('<p><a href="services.html">See the guest services →</a></p>', 'body', { d: { '--link': C('ink'), 'font-weight': '650', 'margin-top': '28px' }, t: {}, m: {} })])
    ], { 'align-items': 'center', gap: '76px' })], { 'background-color': C('paper') }),
    section([
      proseIntro('The practical parts, handled with the same calm.', 'Guest services sit close to the stay rather than in a separate list of promises. Arrival notes, pantry planning, and local routes can all be edited to match the host’s real offer.'),
      N('box', { layout: 'grid' }, { d: { 'grid-template-columns': 'repeat(3,minmax(0,1fr))', gap: '48px', 'margin-top': '52px' }, t: {}, m: { 'grid-template-columns': '1fr', gap: '34px', 'margin-top': '38px' } }, [
        ['map-pin', 'Arrive with a plan', 'Clear directions, entry notes, and the first essentials in one message.'], ['box', 'Set the kitchen', 'Shape an optional pantry list around the pace of the stay.'], ['globe', 'Find the quiet route', 'Share the paths, coves, and tables that fit the guest’s day.']
      ].map(([iconName, title, copy]) => N('box', { layout: 'block' }, { d: { 'max-width': '33ch' }, t: {}, m: {} }, [N('icon', { name: iconName }, { d: { '--icon-size': '30px', color: C('clay'), 'margin-bottom': '20px' }, t: {}, m: { '--icon-size': '28px', 'margin-bottom': '16px' } }), heading(title, 'subtitle', 'h3'), text(`<p>${copy}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '12px' }, t: {}, m: {} })])))
    ], { 'background-color': C('mist') }),
    darkCta('Choose the house. Then shape the stay.', 'Each page is built from Pagecraft-native elements, ready for a host to replace the sample content, imagery, colors, and booking path.')
  ]
});

const staysPage = (): Page => ({
  id: 'page-stays', name: 'Stays', slug: 'stays', title: 'The stays — Marea', desc: 'Compare the four fictional homes in the Marea vacation-rental template.', ogImage: asset('stone-cove-house'), tree: [
    section([N('box', { layout: 'block' }, { d: { 'max-width': '850px' }, t: {}, m: {} }, [heading('Choose the setting before the schedule.', 'display', 'h1', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(48px,5vw,68px)', 'font-weight': '500', 'max-width': '15ch' }, t: {}, m: { 'font-size': '42px' } }), text('<p>Every stay has a different relationship to the coast. Compare scale, outlook, and atmosphere without sorting through invented ratings or urgency.</p>', 'lead', { d: { color: C('muted'), 'max-width': '56ch', 'margin-top': '24px' }, t: {}, m: {} })]), stayGrid()], { 'background-color': C('paper') }),
    section([proseIntro('Three useful ways to decide.', 'A small comparison guide gives guests a reason to choose without pretending the homes can be reduced to a score.'), N('box', { layout: 'grid' }, { d: { 'grid-template-columns': 'repeat(3,minmax(0,1fr))', gap: '18px', 'margin-top': '46px' }, t: {}, m: { 'grid-template-columns': '1fr' } }, [
      ['For the widest view', 'Stone Cove House opens directly toward the water.'], ['For the deepest quiet', 'Pine Court House is screened by trees and rock.'], ['For a smaller footprint', 'Harbor Studio and Garden Casita keep the plan compact.']
    ].map(([title, copy]) => N('box', { layout: 'block' }, { d: { padding: '28px', 'background-color': C('paper'), 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') }, t: {}, m: { padding: '24px' } }, [heading(title, 'subtitle', 'h3'), text(`<p>${copy}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '12px' }, t: {}, m: {} })])))], { 'background-color': C('sand') }),
    darkCta('Found the right setting?', 'Use the inquiry page to turn this sample path into the host’s real booking or contact flow.')
  ]
});

const fact = (title: string, copy: string) => N('box', { layout: 'block' }, { d: { padding: '24px 0', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line') }, t: {}, m: {} }, [heading(title, 'subtitle', 'h3'), text(`<p>${copy}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '7px' }, t: {}, m: {} })]);

const stayPage = (stay: Stay): Page => ({
  id: `page-${stay.slug}`, name: stay.name, slug: stay.slug, title: `${stay.name} — Marea`, desc: stay.intro, ogImage: asset(stay.assetId), tree: [
    section([N('crumbs', { mode: 'manual', home: 'Home', sep: 'slash', items: [{ label: 'Stays', href: 'stays.html' }, { label: stay.name, href: '' }] }, { d: { 'margin-bottom': '36px' }, t: {}, m: { 'margin-bottom': '26px' } }), row([
      column(42, [text(`<p>${stay.place}</p>`, 'small', { d: { color: C('clay'), 'font-weight': '650' }, t: {}, m: {} }), heading(stay.name, 'display', 'h1', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(48px,5vw,68px)', 'font-weight': '500', 'margin-top': '12px', 'max-width': '10ch' }, t: {}, m: { 'font-size': '42px' } }), text(`<p>${stay.intro}</p>`, 'lead', { d: { color: C('muted'), 'max-width': '38ch', 'margin-top': '24px' }, t: {}, m: {} }), row([column(0, [button('Ask about this stay', 'contact.html', 'dark')])], { 'margin-top': '30px' })]),
      column(58, [image(asset(stay.assetId), stay.alt, { height: '620px' }, { height: '400px' }, false)])
    ], { 'align-items': 'flex-end', gap: '66px' })], { 'background-color': C('paper'), padding: '62px 32px 104px' }, { padding: '42px 18px 66px' }),
    section([row([
      column(38, [named(N('box', { layout: 'block' }, { d: { position: 'sticky', top: '104px' }, t: { position: 'static', top: '0px' }, m: {} }, [heading('The shape of the stay', 'title', 'h2', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-weight': '500', 'max-width': '12ch' }, t: {}, m: {} }), text(`<p>${stay.detail}</p>`, 'lead', { d: { color: C('muted'), 'max-width': '36ch', 'margin-top': '22px' }, t: {}, m: {} })]), 'marea-sticky-story')]),
      column(62, [image(asset('host-preparation'), 'Folded linen, ceramic cup, brass key, and rosemary prepared on an oak table', { height: '400px' }, { height: '280px' }), N('box', { layout: 'block' }, { d: { 'margin-top': '34px' }, t: {}, m: { 'margin-top': '24px' } }, [fact('Scale', stay.sleeps), fact('Setting', stay.mood), fact('Good to know', 'Replace this sample note with the host’s verified accessibility, arrival, and house information.')])])
    ], { 'align-items': 'flex-start', gap: '82px' })], { 'background-color': C('mist') }),
    section([proseIntro('A few details before the calendar.', 'The template keeps the practical information together, where a host can replace it with accurate property details.'), N('box', { layout: 'grid' }, { d: { 'grid-template-columns': 'repeat(3,minmax(0,1fr))', gap: '18px', 'margin-top': '44px' }, t: {}, m: { 'grid-template-columns': '1fr' } }, [
      ['Arrival', 'Add the real check-in window, route, parking, and entry process.'], ['Inside', 'List the actual rooms, equipment, climate controls, and accessibility details.'], ['Outside', 'Describe the verified garden, terrace, water access, or neighborhood conditions.']
    ].map(([title, copy]) => N('box', { layout: 'block' }, { d: { padding: '26px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line'), 'background-color': C('paper') }, t: {}, m: { padding: '22px' } }, [heading(title, 'subtitle', 'h3'), text(`<p>${copy}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '11px' }, t: {}, m: {} })])))], { 'background-color': C('paper') }),
    darkCta(`Ask about ${stay.name}.`, 'The sample inquiry route is deliberately simple so a host can connect Pagecraft to the booking or contact system they actually use.')
  ]
});

const servicesPage = (): Page => ({
  id: 'page-services', name: 'Guest services', slug: 'services', title: 'Guest services — Marea', desc: 'A sample guest-services page for the Marea vacation-rental template.', ogImage: asset('host-preparation'), tree: [
    section([row([
      column(46, [heading('Useful help, kept close to the stay.', 'display', 'h1', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(48px,5vw,68px)', 'font-weight': '500', 'max-width': '13ch' }, t: {}, m: { 'font-size': '42px' } }), text('<p>This page is a structure for the services an independent host can genuinely support—not a decorative list of luxury promises.</p>', 'lead', { d: { color: C('muted'), 'max-width': '43ch', 'margin-top': '24px' }, t: {}, m: {} })]),
      column(54, [image(asset('host-preparation'), 'Folded linen, ceramic cup, brass key, and rosemary on a host preparation table', { height: '520px' }, { height: '340px' }, false)])
    ], { 'align-items': 'center', gap: '72px' })], { 'background-color': C('paper') }),
    section([['Arrival planning', 'Put directions, transport choices, entry notes, and a reachable contact in one reliable place.'], ['Pantry and table', 'Offer only the groceries, meal preparation, or local reservations the host can consistently arrange.'], ['Days outside', 'Share walks, swims, markets, and weather notes with enough context for a guest to choose well.']].map(([title, copy], index) => N('box', { layout: 'block' }, { d: { padding: '38px 0', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line') }, t: {}, m: { padding: '30px 0' } }, [row([column(32, [heading(`0${index + 1}`, 'subtitle', 'div', { d: { color: C('clay'), 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': '28px', 'font-weight': '500' }, t: {}, m: {} })]), column(68, [heading(title, 'title', 'h2', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': '34px', 'font-weight': '500' }, t: {}, m: { 'font-size': '29px' } }), text(`<p>${copy}</p>`, 'lead', { d: { color: C('muted'), 'max-width': '49ch', 'margin-top': '14px' }, t: {}, m: {} })])], { gap: '44px' })])), { 'background-color': C('sand') }),
    section([proseIntro('Questions guests ask before arrival.', 'Keep answers concise, factual, and specific to the property. The accordion rows are fully editable in Pagecraft.'), N('accordion', { open: 'first', single: 1, marker: 'plus', items: [
      { q: 'How do guests receive arrival details?', a: 'Replace this sample answer with the host’s real communication schedule and contact method.' }, { q: 'Can services be added after booking?', a: 'Describe which requests are available, their lead time, and how any cost is confirmed.' }, { q: 'What happens when plans change?', a: 'Add the verified cancellation, date-change, and travel-disruption policy here.' }
    ] }, { d: { 'margin-top': '44px', '--ac-line': C('line'), '--ac-pad': '22px', '--ac-q-size': '18px', '--ac-a-size': '16px', '--ac-q-color': C('ink'), '--ac-a-color': C('muted') }, t: {}, m: { 'margin-top': '32px', '--ac-pad': '18px' } })], { 'background-color': C('paper') }),
    darkCta('Make the service page tell the truth.', 'Replace the examples with the help the host can deliver consistently, then connect the final action to the real inquiry path.')
  ]
});

const aboutPage = (): Page => ({
  id: 'page-about', name: 'About', slug: 'about', title: 'About — Marea', desc: 'The fictional host story behind the Marea vacation-rental template.', ogImage: asset('coastal-path'), tree: [
    section([row([
      column(48, [heading('A collection shaped by the coast, not a checklist.', 'display', 'h1', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(48px,5vw,68px)', 'font-weight': '500', 'max-width': '13ch' }, t: {}, m: { 'font-size': '42px' } }), text('<p>Marea is fictional, but its structure is practical: one point of view, four clearly different homes, and useful information kept near the decisions guests are making.</p>', 'lead', { d: { color: C('muted'), 'max-width': '44ch', 'margin-top': '25px' }, t: {}, m: {} })]),
      column(52, [image(asset('coastal-path'), 'Quiet coastal path through pale dune grass toward a sheltered cove', { height: '600px' }, { height: '380px' }, false)])
    ], { 'align-items': 'flex-end', gap: '72px' })], { 'background-color': C('paper') }),
    section([row([column(38, [heading('Hospitality becomes believable in the details.', 'title', 'h2', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-weight': '500', 'max-width': '14ch' }, t: {}, m: {} })]), column(62, [text('<p>Use this page for the origin, operating principles, and people behind the collection. Keep claims specific. If a service, environmental practice, or accessibility feature cannot be verified, leave it out.</p><p>The strongest story is often the simplest one: why these homes exist, how they are cared for, and what kind of stay they are designed to support.</p>', 'lead', { d: { color: C('muted'), 'max-width': '53ch' }, t: {}, m: {} })])], { 'align-items': 'flex-start', gap: '76px' })], { 'background-color': C('mist') }),
    section([proseIntro('Three principles for the real version.', 'These are editorial prompts, not claims about the fictional collection.'), N('box', { layout: 'grid' }, { d: { 'grid-template-columns': 'repeat(3,minmax(0,1fr))', gap: '18px', 'margin-top': '44px' }, t: {}, m: { 'grid-template-columns': '1fr' } }, [
      ['Say what is different', 'Give every home a distinct reason to be chosen.'], ['Show the whole stay', 'Pair atmosphere with accurate practical information.'], ['Make contact easy', 'Keep one clear inquiry or booking route throughout the site.']
    ].map(([title, copy]) => N('box', { layout: 'block' }, { d: { padding: '28px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') }, t: {}, m: { padding: '24px' } }, [heading(title, 'subtitle', 'h3'), text(`<p>${copy}</p>`, 'body', { d: { color: C('muted'), 'margin-top': '12px' }, t: {}, m: {} })])))], { 'background-color': C('paper') }),
    darkCta('Turn the sample story into the host’s own.', 'The hierarchy, content groups, and responsive values are ready to edit directly in Pagecraft.')
  ]
});

const contactPage = (): Page => ({
  id: 'page-contact', name: 'Contact', slug: 'contact', title: 'Plan a stay — Marea', desc: 'A fully editable inquiry page for the Marea vacation-rental template.', ogImage: asset('garden-casita'), tree: [
    section([row([
      column(42, [heading('Begin with the stay you have in mind.', 'display', 'h1', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-size': 'clamp(48px,5vw,68px)', 'font-weight': '500', 'max-width': '12ch' }, t: {}, m: { 'font-size': '42px' } }), text('<p>Ask about a home, a date range, or the practical detail that will help you choose. This sample form is ready to connect to the host’s real form endpoint.</p>', 'lead', { d: { color: C('muted'), 'max-width': '41ch', 'margin-top': '24px' }, t: {}, m: {} }), text('<p><strong>Prefer email?</strong><br><a href="mailto:stay@marea.example">stay@marea.example</a></p>', 'body', { d: { '--link': C('ink'), 'margin-top': '30px' }, t: {}, m: {} })]),
      column(58, [N('box', { layout: 'block' }, { d: { padding: '34px', 'background-color': C('sand'), 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') }, t: {}, m: { padding: '22px' } }, [heading('Stay inquiry', 'subtitle', 'h2', { d: { 'font-size': '26px', 'font-family': Core.stackFor('Newsreader', 'f'), 'font-weight': '500', 'margin-bottom': '24px' }, t: {}, m: {} }), N('form', { mode: 'external', action: '', method: 'post', submit: 'Send inquiry', aria: 'Stay inquiry form', fields: [
        { type: 'text', label: 'Name', name: 'name', ph: 'Your name', required: 1, half: 1 }, { type: 'email', label: 'Email', name: 'email', ph: 'you@example.com', required: 1, half: 1 }, { type: 'select', label: 'Stay', name: 'stay', opts: 'Stone Cove House, Pine Court House, Harbor Studio, Garden Casita', required: 1 }, { type: 'text', label: 'Dates or timing', name: 'dates', ph: 'What timing are you considering?' }, { type: 'textarea', label: 'What would help?', name: 'message', ph: 'Guests, questions, and anything important to know', required: 1 }
      ] }, { d: { '--f-label': C('ink'), '--f-bg': C('paper'), '--f-text': C('ink'), '--f-border': C('line-strong'), '--f-btn-bg': C('ink'), '--f-btn-fg': C('paper'), '--f-radius': '2px' }, t: {}, m: {} })])])
    ], { 'align-items': 'flex-start', gap: '72px' })], { 'background-color': C('paper') }),
    section([row([column(46, [image(asset('garden-casita'), 'Whitewashed garden casita with olive trees and a shaded courtyard', { height: '470px' }, { height: '310px' })]), column(54, [heading('Before this page goes live', 'title', 'h2', { d: { 'font-family': Core.stackFor('Newsreader', 'f'), 'font-weight': '500' }, t: {}, m: {} }), text('<p>Connect the form to the approved endpoint, replace the sample email, add the verified response window, and test a full submission. The visual template deliberately does not invent those operational details.</p>', 'lead', { d: { color: C('muted'), 'max-width': '47ch', 'margin-top': '22px' }, t: {}, m: {} })])], { 'align-items': 'center', gap: '72px' })], { 'background-color': C('mist') })
  ]
});

export function buildTemplateDocument(): Doc {
  Core.seed();
  const tokens = Core.defaultTokens();
  const palette: Record<string, string> = { bg: '#f4f0e7', paper: '#f7f4ed', text: '#202823', ink: '#17231e', brand: '#66776d', muted: '#616b65', 'muted-i': '#bcc5bf', slate: '#66776d', line: '#d2d0c7', surface: '#ffffff', sand: '#ece7dc', mist: '#e7ece8', clay: '#9a5d43', signal: '#d8e868', 'ink-line': '#3d4943', 'line-strong': '#a8aaa2' };
  for (const color of tokens.colors) if (palette[color.id]) color.value = palette[color.id];
  for (const [id, name, value] of [
    ['paper', 'Chalk paper', palette.paper], ['sand', 'Warm sand', palette.sand],
    ['mist', 'Coastal mist', palette.mist], ['clay', 'Weathered clay', palette.clay],
    ['signal', 'Lichen signal', palette.signal], ['paper-muted', 'Muted on ink', palette['muted-i']],
    ['ink-line', 'Line on ink', palette['ink-line']], ['line-strong', 'Strong hairline', palette['line-strong']]
  ]) if (!tokens.colors.some(color => color.id === id)) tokens.colors.push({ id, name, value });
  const display = tokens.text.find(style => style.id === 'display');
  if (display) { display.css.d['font-family'] = Core.stackFor('Newsreader', 'f'); display.css.d['font-size'] = '64px'; display.css.d['font-weight'] = '500'; display.css.d['line-height'] = '.98'; display.css.d['letter-spacing'] = '-.045em'; display.css.t['font-size'] = '50px'; display.css.m['font-size'] = '42px'; }
  const title = tokens.text.find(style => style.id === 'title');
  if (title) { title.css.d['font-family'] = Core.stackFor('Newsreader', 'f'); title.css.d['font-size'] = '42px'; title.css.d['font-weight'] = '500'; title.css.d['line-height'] = '1.05'; title.css.d['letter-spacing'] = '-.035em'; title.css.t['font-size'] = '36px'; title.css.m['font-size'] = '31px'; }
  const subtitle = tokens.text.find(style => style.id === 'subtitle'); if (subtitle) { subtitle.css.d['font-size'] = '20px'; subtitle.css.d['font-weight'] = '650'; }
  const body = tokens.text.find(style => style.id === 'body'); if (body) { body.css.d['font-size'] = '17px'; body.css.m['font-size'] = '16px'; }
  const lead = tokens.text.find(style => style.id === 'lead'); if (lead) { lead.css.d['font-size'] = '19px'; lead.css.m['font-size'] = '17px'; }
  const small = tokens.text.find(style => style.id === 'small'); if (small) small.css.d['font-size'] = '14px';
  Core.state.meta = { ...Core.state.meta, name: 'Marea', maxWidth: '1200px', size: '17px', lang: 'en', font: Core.stackFor('Outfit', 's'), headFont: Core.stackFor('Newsreader', 'f'), css: '', headHtml: '', baseUrl: '', ogImage: asset('coastal-living-room'), favicon: '', blocks: [], components: [], collections: [], selfHostFonts: 0, tokens };
  Core.state.header = header();
  Core.state.footer = footer();
  Core.state.pages = [home(), staysPage(), ...stays.map(stayPage), servicesPage(), aboutPage(), contactPage()];
  Core.state.cur = 0;
  const document = structuredClone(Core.doc());
  let nodeIndex = 0;
  const assignStableIds = (nodes: Node[]) => { for (const node of nodes) { node.id = `marea-node-${String(++nodeIndex).padStart(4, '0')}`; if (node.children?.length) assignStableIds(node.children); } };
  assignStableIds(document.header); for (const page of document.pages) assignStableIds(page.tree); assignStableIds(document.footer);
  return document;
}
