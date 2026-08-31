import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';

const C = Core.cvar;
const N = Core.N as (type: string, props?: Record<string, unknown>, css?: Record<string, Record<string, string>>, children?: Node[]) => Node;
const BOX = Core.BOX as (top: string, right: string, bottom: string, left: string) => Record<string, string>;

type Css = Record<string, Record<string, string>>;

const named = (node: Node, cls: string) => {
  node.adv = { ...(node.adv || {}), cls: [node.adv?.cls, cls].filter(Boolean).join(' ') };
  return node;
};

const heading = (copy: string, style: 'display' | 'title' | 'subtitle', level: 'h1' | 'h2' | 'h3' | 'div' = 'h2', css: Css = {}) =>
  N('heading', { text: copy, ts: style, level }, css);

const text = (html: string, style: 'lead' | 'body' | 'small' = 'body', css: Css = {}) =>
  N('text', { html, ts: style }, css);

const image = (src: string, alt: string, w: number, h: number, css: Record<string, string> = {}, mobile: Record<string, string> = {}, lazy = true) =>
  named(N('image', { src, alt, w: String(w), h: String(h), lazy: lazy ? 1 : 0 }, {
    d: { width: '100%', height: '100%', 'object-fit': 'cover', ...css }, t: {}, m: mobile
  }), 'nl-media');

const column = (grow: number, children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}) =>
  N('column', {}, {
    d: { 'flex-grow': String(grow), ...(grow === 0 ? { 'flex-basis': 'auto', 'flex-shrink': '0' } : {}), ...css },
    t: {}, m: { 'flex-basis': '100%', ...(grow === 0 ? { 'flex-shrink': '1' } : {}), ...mobile }
  }, children);

const row = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}) =>
  N('row', {}, { d: { gap: '32px', ...css }, t: {}, m: { gap: '22px', ...mobile } }, children);

const section = (children: Node[], css: Record<string, string> = {}, mobile: Record<string, string> = {}, tag = 'section') =>
  N('section', { tag }, {
    d: { ...BOX('120px', '42px', '120px', '42px'), ...css },
    t: { ...BOX('88px', '28px', '88px', '28px') },
    m: { ...BOX('68px', '20px', '68px', '20px'), ...mobile }
  }, children);

const button = (label: string, link: string, mode: 'acid' | 'light' | 'line' = 'acid') => named(N('button', {
  text: label, link, ts: 'btn', variant: mode === 'line' ? 'outline' : 'solid', icon: 'arrow'
}, {
  d: mode === 'acid'
    ? { 'background-color': C('acid'), color: C('ink'), padding: '15px 22px', 'border-radius': '0px', 'font-weight': '750' }
    : mode === 'light'
      ? { 'background-color': C('paper'), color: C('ink'), padding: '15px 22px', 'border-radius': '0px', 'font-weight': '750' }
      : { 'background-color': 'transparent', color: 'currentColor', padding: '14px 21px', 'border-radius': '0px', 'border-width': '1px', 'border-style': 'solid', 'border-color': 'currentColor', 'font-weight': '700' },
  t: {}, m: { width: '100%' }
}), 'nl-button');

const label = (copy: string, tone = C('brand')) => named(text(`<p>${copy}</p>`, 'small', {
  d: { color: tone, 'font-size': '14px', 'font-weight': '750', 'letter-spacing': '.08em', 'text-transform': 'uppercase' }, t: {}, m: {}
}), 'nl-label');

const intro = (kicker: string, title: string, copy: string, inverse = false) => row([
  column(30, [label(kicker, inverse ? C('acid') : C('brand'))]),
  column(70, [heading(title, 'title', 'h2', { d: { color: inverse ? C('paper') : C('ink'), 'max-width': '20ch' }, t: {}, m: {} }), text(`<p>${copy}</p>`, 'lead', { d: { color: inverse ? C('paper-muted') : C('slate'), 'max-width': '51ch', 'margin-top': '24px' }, t: {}, m: {} })])
], { 'align-items': 'flex-start', gap: '56px' });

const servicePanel = (asset: string, alt: string, title: string, copy: string, link: string, accent: string) => named(column(1, [
  image(asset, alt, 1536, 1024, { height: '250px' }, { height: '240px' }),
  N('box', { layout: 'block' }, { d: { padding: '28px 26px 30px', 'min-height': '262px', display: 'flex', 'flex-direction': 'column' }, t: {}, m: { 'min-height': '0' } }, [
    label(title, accent),
    text(`<p>${copy}</p>`, 'body', { d: { color: C('slate'), 'max-width': '34ch', 'margin-top': '18px' }, t: {}, m: {} }),
    text(`<p><a href="${link}">Explore the discipline →</a></p>`, 'small', { d: { '--link': C('ink'), 'font-weight': '700', 'margin-top': 'auto', 'padding-top': '28px' }, t: {}, m: {} })
  ])
], { 'background-color': C('paper'), overflow: 'hidden', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') }), 'nl-service-panel');

const servicePanels = () => named(row([
  servicePanel('asset:northline-identity-artifacts', 'Identity materials, paper samples, and color studies arranged across a studio table', 'Identity', 'Positioning, language, identity, and the practical rules that make a brand recognizable in motion.', 'services.html', C('brand')),
  servicePanel('asset:northline-digital-prototype', 'Two angled displays showing an abstract interface prototype beside a paper wireframe', 'Digital', 'Websites and product surfaces with a legible journey, useful interactions, and a system ready to build.', 'services.html', C('red')),
  servicePanel('asset:northline-editorial-production', 'Editorial layouts, binding materials, and production tools on a workbench', 'Editorial', 'Launch stories, publications, and campaigns edited around one idea rather than a pile of content.', 'services.html', C('ink'))
], { 'align-items': 'stretch', gap: '14px', 'flex-wrap': 'nowrap' }, { 'flex-direction': 'column', gap: '16px' }), 'nl-service-row');

const feedbackSlider = () => N('slider', { arrows: 1, aria: 'Northline working loop' }, {
  d: { '--sl-gap': '14px', '--sl-w': 'calc((100% - var(--sl-gap)) / 2)' },
  t: { '--sl-w': '82%' }, m: { '--sl-w': '88%', '--sl-gap': '12px' }
}, [
  ['Frame', 'Name what has to change.', 'We turn the first conversation into a compact working frame: audience, pressure, ambition, and the decisions the project has to support.', C('brand')],
  ['Pressure-test', 'Put the direction under real weight.', 'Early concepts meet actual content, constraints, and use cases. What survives becomes the system; what does not gets edited out.', C('red')],
  ['Handover', 'Make the work useful after launch.', 'The final system includes the logic behind it, so a team can extend the work without flattening the point of view.', C('acid')]
].map(([stage, title, copy, accent]) => named(column(1, [
  label(String(stage), String(accent)),
  heading(String(title), 'subtitle', 'h3', { d: { 'font-size': '30px', 'max-width': '16ch', 'margin-top': '72px' }, t: {}, m: { 'font-size': '25px', 'margin-top': '50px' } }),
  text(`<p>${copy}</p>`, 'body', { d: { color: C('slate'), 'max-width': '42ch', 'margin-top': '20px' }, t: {}, m: {} })
], { 'background-color': C('paper'), padding: '34px', 'min-height': '380px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') }), 'nl-loop-card')));

const decisionTimeline = () => named(row([
  named(column(38, [label('How decisions move'), heading('A clear idea has to survive contact with reality.', 'title', 'h2', { d: { 'max-width': '14ch', 'margin-top': '18px' }, t: {}, m: {} }), text('<p>We keep strategy visible inside the work, so every visual choice has something stronger than taste to answer to.</p>', 'body', { d: { color: C('slate'), 'max-width': '34ch', 'margin-top': '26px' }, t: {}, m: {} })], { 'align-self': 'flex-start' }), 'nl-sticky'),
  column(62, [
    ['Question', 'What are people trying to understand?', 'We begin with the decision the audience needs to make—not with a moodboard.'],
    ['Pressure', 'What makes that decision difficult?', 'Competing messages, category habits, and real operational constraints become material for the design.'],
    ['Resolution', 'What is the simplest strong response?', 'Language, hierarchy, imagery, and interaction converge on one system that can keep working.']
  ].map(([kicker, title, copy]) => named(N('box', { layout: 'block' }, { d: { padding: '34px 0 72px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line'), 'min-height': '330px' }, t: {}, m: { 'min-height': '0', padding: '30px 0 52px' } }, [
    label(kicker), heading(title, 'subtitle', 'h3', { d: { 'font-size': 'clamp(29px,3vw,46px)', 'line-height': '1.03', 'letter-spacing': '-.035em', 'max-width': '17ch', 'margin-top': '32px' }, t: {}, m: { 'font-size': '30px' } }), text(`<p>${copy}</p>`, 'body', { d: { color: C('slate'), 'max-width': '44ch', 'margin-top': '24px' }, t: {}, m: {} })
  ]), 'nl-scrub')))
], { 'align-items': 'flex-start', gap: '88px' }), 'nl-timeline');

const header = () => [named(N('section', { tag: 'header' }, {
  d: { ...BOX('18px', '42px', '18px', '42px'), 'background-color': C('ink'), color: C('paper'), position: 'sticky', top: '0', 'z-index': '80' },
  t: { ...BOX('16px', '28px', '16px', '28px') }, m: { ...BOX('14px', '20px', '14px', '20px') }
}, [row([
  column(50, [heading('Northline', 'subtitle', 'div', { d: { color: C('paper'), 'font-size': '19px', 'font-weight': '780', 'letter-spacing': '-.03em' }, t: {}, m: {} })]),
  column(50, [named(N('nav', { collapse: '9999', aria: 'Main navigation', items: [
    { label: 'Home', href: 'index.html' }, { label: 'About', href: 'about.html' }, { label: 'Services', href: 'services.html' }, { label: 'Contact', href: 'contact.html' }
  ] }, { d: { color: C('paper'), '--nav-hover': C('acid'), '--nav-panel': C('ink'), 'align-self': 'flex-end' }, t: {}, m: {} }), 'nl-menu')])
], { 'align-items': 'center', 'flex-wrap': 'nowrap', gap: '16px' })]), 'nl-header')];

const footer = () => [named(section([
  row([
    column(55, [label('Northline Studio', C('acid')), heading('Independent direction for consequential work.', 'title', 'h2', { d: { color: C('paper'), 'max-width': '18ch', 'margin-top': '18px' }, t: {}, m: {} })]),
    column(20, [text('<p><a href="index.html">Home</a><br><a href="about.html">About</a><br><a href="services.html">Services</a><br><a href="contact.html">Contact</a></p>', 'small', { d: { color: C('paper-muted'), '--link': C('paper'), 'line-height': '2.15' }, t: {}, m: {} })]),
    column(25, [text('<p>Identity / digital / editorial</p><p><a href="mailto:hello@northline.studio">hello@northline.studio</a></p>', 'small', { d: { color: C('paper-muted'), '--link': C('paper'), 'line-height': '1.8' }, t: {}, m: {} })])
  ], { 'align-items': 'flex-start', gap: '48px' }),
  row([
    column(50, [text('<p>Independent studio / thoughtful systems</p>', 'small', { d: { color: C('paper-muted') }, t: {}, m: {} })]),
    column(50, [text('<p>© 2026 Northline Studio</p>', 'small', { d: { color: C('paper-muted'), 'text-align': 'right' }, t: {}, m: { 'text-align': 'left' } })])
  ], { 'margin-top': '88px', 'padding-top': '22px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': '#32415a' })
], { 'background-color': C('ink') }, {}, 'footer'), 'nl-footer')];

const cinematicClose = (title: string, copy: string) => named(section([
  N('box', { layout: 'block' }, { d: { 'max-width': '930px' }, t: {}, m: {} }, [
    label('Start with the real question', C('acid')),
    heading(title, 'display', 'h2', { d: { color: C('paper'), 'font-size': 'clamp(52px,7vw,88px)', 'line-height': '.94', 'letter-spacing': '-.055em', 'max-width': '15ch', 'margin-top': '22px' }, t: {}, m: { 'font-size': '43px' } }),
    text(`<p>${copy}</p>`, 'lead', { d: { color: C('paper'), 'max-width': '44ch', 'margin-top': '30px' }, t: {}, m: {} }),
    N('row', {}, { d: { 'margin-top': '34px' }, t: {}, m: {} }, [column(0, [button('Start a conversation', 'contact.html', 'light')])])
  ])
], { 'background-color': C('ink'), 'background-image': 'linear-gradient(90deg,rgba(7,26,51,.96) 0%,rgba(7,26,51,.73) 55%,rgba(7,26,51,.28) 100%),url("asset:northline-closing-studio")', 'background-size': 'cover', 'background-position': 'center', 'min-height': '690px', display: 'flex', 'align-items': 'center' }, { 'min-height': '600px', 'background-image': 'linear-gradient(180deg,rgba(7,26,51,.9),rgba(7,26,51,.62)),url("asset:northline-closing-studio")' }), 'nl-close');

const home = (): Page => ({
  id: 'page-home', name: 'Home', slug: 'index', title: 'Northline Studio — Ideas with consequence',
  desc: 'An independent studio for identity, digital, and editorial systems.', ogImage: 'asset:northline-system-hero', tree: [
    named(section([row([
      column(51, [label('Independent creative practice'), heading('Ideas with consequence.', 'display', 'h1', { d: { 'font-size': 'clamp(64px,6.2vw,84px)', 'line-height': '.91', 'letter-spacing': '-.06em', 'max-width': '10.5ch', 'margin-top': '26px' }, t: {}, m: { 'font-size': '51px' } }), text('<p>Northline turns complicated offers into identity, digital, and editorial systems people can understand and use.</p>', 'lead', { d: { color: C('slate'), 'max-width': '40ch', 'margin-top': '32px' }, t: {}, m: {} }), row([column(0, [button('See how we work', 'about.html')]), column(0, [button('View services', 'services.html', 'line')])], { 'margin-top': '34px', gap: '12px' })]),
      column(49, [image('asset:northline-system-hero', 'A designer arranges bold material studies in a daylight studio', 1024, 1536, { height: '720px' }, { height: '500px' }, false)])
    ], { 'align-items': 'flex-end', gap: '64px' })], { 'background-color': C('paper'), padding: '80px 42px 118px' }, { padding: '58px 20px 74px' }), 'nl-hero'),
    section([intro('Three connected disciplines', 'A studio operating system, not a menu of deliverables.', 'Strategy, language, imagery, and interaction are developed together. The work can enter through one discipline and still leave as a coherent whole.'), N('box', { layout: 'block' }, { d: { 'margin-top': '64px' }, t: {}, m: { 'margin-top': '42px' } }, [servicePanels()])], { 'background-color': C('surface') }),
    section([decisionTimeline()], { 'background-color': C('paper') }),
    section([intro('Working loop', 'The idea stays open long enough to get stronger.', 'Instead of disappearing into a reveal, we create a rhythm of framing, testing, and resolving. Each pass gives the work more conviction and less noise.'), N('box', { layout: 'block' }, { d: { 'margin-top': '58px' }, t: {}, m: { 'margin-top': '38px' } }, [feedbackSlider()])], { 'background-color': C('acid-soft') }),
    cinematicClose('Bring us the part that still feels unresolved.', 'A useful project starts with the tension—not a polished brief.')
  ]
});

const about = (): Page => ({
  id: 'page-about', name: 'About', slug: 'about', title: 'About — Northline Studio',
  desc: 'Northline combines strategy, language, and design in one independent practice.', ogImage: 'asset:northline-identity-artifacts', tree: [
    named(section([row([
      column(43, [label('About the practice', C('acid')), heading('One studio. Fewer handoffs. Better decisions.', 'display', 'h1', { d: { color: C('paper'), 'font-size': 'clamp(56px,6vw,82px)', 'line-height': '.92', 'letter-spacing': '-.055em', 'max-width': '10.5ch', 'margin-top': '25px' }, t: {}, m: { 'font-size': '45px' } }), text('<p>Northline brings strategy, writing, and design into the same working room so an idea does not lose its force as it moves from thought to form.</p>', 'lead', { d: { color: C('paper-muted'), 'max-width': '39ch', 'margin-top': '32px' }, t: {}, m: {} })]),
      column(57, [image('asset:northline-identity-artifacts', 'Identity system artifacts arranged for review on a dark studio table', 1536, 1024, { height: '620px' }, { height: '390px' }, false)])
    ], { 'align-items': 'center', gap: '68px' })], { 'background-color': C('ink'), color: C('paper') }), 'nl-about-hero'),
    section([intro('Why the studio stays small', 'The people defining the direction stay close to the work.', 'There are fewer layers between the first question and the finished system. When a project needs photography, development, motion, or production, specialists join around a clear direction rather than a chain of approvals.'), row([
      column(45, [image('asset:northline-editorial-production', 'Editorial production materials, layout films, and binding samples', 1536, 1024, { height: '520px' }, { height: '350px' })]),
      column(55, [heading('Clarity is not a warm-up exercise.', 'title', 'h2', { d: { 'max-width': '13ch' }, t: {}, m: {} }), text('<p>It is part of the craft. The logic behind a decision stays visible through concept, production, and handover, giving teams a system they can extend without sanding off its character.</p>', 'lead', { d: { color: C('slate'), 'max-width': '42ch', 'margin-top': '26px' }, t: {}, m: {} }), N('divider', {}, { d: { 'border-top-color': C('line'), 'margin': '38px 0' }, t: {}, m: {} }), text('<p><strong>Meaning before styling.</strong><br>Every choice must clarify the idea.</p><p><strong>Restraint with character.</strong><br>Edit hard without becoming anonymous.</p><p><strong>Systems that stay human.</strong><br>Consistency should support judgment, not replace it.</p>', 'body', { d: { color: C('slate'), 'line-height': '1.85' }, t: {}, m: {} })])
    ], { 'align-items': 'center', gap: '74px', 'margin-top': '86px' })], { 'background-color': C('paper') }),
    cinematicClose('A point of view becomes valuable when a team can use it.', 'Let’s build the logic and the expression together.')
  ]
});

const serviceDetail = (id: string, marker: string, title: string, copy: string, items: string, asset: string, alt: string, reverse = false) => named(section([
  row(reverse ? [
    column(54, [image(asset, alt, 1536, 1024, { height: '560px' }, { height: '340px' })]),
    column(46, [label(marker), heading(title, 'title', 'h2', { d: { 'max-width': '13ch', 'margin-top': '20px' }, t: {}, m: {} }), text(`<p>${copy}</p>`, 'lead', { d: { color: C('slate'), 'max-width': '40ch', 'margin-top': '24px' }, t: {}, m: {} }), text(`<p>${items}</p>`, 'body', { d: { color: C('ink'), 'line-height': '2', 'margin-top': '34px', 'padding-top': '28px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line') }, t: {}, m: {} })])
  ] : [
    column(46, [label(marker), heading(title, 'title', 'h2', { d: { 'max-width': '13ch', 'margin-top': '20px' }, t: {}, m: {} }), text(`<p>${copy}</p>`, 'lead', { d: { color: C('slate'), 'max-width': '40ch', 'margin-top': '24px' }, t: {}, m: {} }), text(`<p>${items}</p>`, 'body', { d: { color: C('ink'), 'line-height': '2', 'margin-top': '34px', 'padding-top': '28px', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': C('line') }, t: {}, m: {} })]),
    column(54, [image(asset, alt, 1536, 1024, { height: '560px' }, { height: '340px' })])
  ], { 'align-items': 'center', gap: '76px' })
], { 'background-color': marker === 'Digital systems' ? C('acid-soft') : C('paper') }), `nl-service-detail nl-${id}`);

const services = (): Page => ({
  id: 'page-services', name: 'Services', slug: 'services', title: 'Services — Northline Studio',
  desc: 'Identity, digital, and editorial direction built as connected systems.', ogImage: 'asset:northline-digital-prototype', tree: [
    section([label('Services'), heading('Find the system beneath the request.', 'display', 'h1', { d: { 'font-size': 'clamp(60px,7vw,88px)', 'line-height': '.9', 'letter-spacing': '-.06em', 'max-width': '15ch', 'margin-top': '26px' }, t: {}, m: { 'font-size': '45px' } }), row([column(50, []), column(50, [text('<p>Choose the pressure point. Engagements are shaped around the decisions the work needs to support—not a predetermined list of outputs.</p>', 'lead', { d: { color: C('slate'), 'max-width': '42ch' }, t: {}, m: {} })])], { 'margin-top': '58px' })], { 'background-color': C('paper') }),
    serviceDetail('identity', 'Identity systems', 'Make the idea recognizable.', 'Positioning, language, and visual identity become one usable set of rules.', 'Positioning and creative direction<br>Verbal principles and naming<br>Visual identity and art direction<br>Guidelines and launch tools', 'asset:northline-identity-artifacts', 'Identity artifacts and color studies arranged on a studio table'),
    serviceDetail('digital', 'Digital systems', 'Turn complexity into a clear journey.', 'Structure, interaction, and visual expression are designed together for the people using the experience.', 'Experience strategy<br>Information architecture<br>Copy and content direction<br>Responsive interface system<br>Developer handover', 'asset:northline-digital-prototype', 'Digital interface prototypes on sculptural studio displays', true),
    serviceDetail('editorial', 'Editorial systems', 'Give the story an editorial spine.', 'Campaigns and publications gain a repeatable rhythm without becoming repetitive.', 'Campaign narrative<br>Publication systems<br>Art direction<br>Launch stories<br>Presentation and sales materials', 'asset:northline-editorial-production', 'Editorial layouts and production tools spread across a workbench'),
    cinematicClose('The useful scope is the one that resolves the problem.', 'Begin with what needs to change; the deliverables can follow.')
  ]
});

const contact = (): Page => ({
  id: 'page-contact', name: 'Contact', slug: 'contact', title: 'Contact — Northline Studio',
  desc: 'Start a conversation with Northline Studio about identity, digital, or editorial work.', ogImage: 'asset:northline-closing-studio', tree: [
    named(section([row([
      column(58, [label('Contact', C('acid')), heading('Bring the unresolved part.', 'display', 'h1', { d: { color: C('paper'), 'font-size': 'clamp(64px,7vw,98px)', 'line-height': '.88', 'letter-spacing': '-.06em', 'max-width': '9ch', 'margin-top': '24px' }, t: {}, m: { 'font-size': '51px' } }), text('<p>A polished brief is not required. Tell us what you are making, why it matters now, and where the work is losing clarity.</p>', 'lead', { d: { color: C('paper-muted'), 'max-width': '41ch', 'margin-top': '34px' }, t: {}, m: {} }), N('row', {}, { d: { 'margin-top': '34px' }, t: {}, m: {} }, [column(0, [button('Email the studio', 'mailto:hello@northline.studio?subject=Project%20inquiry', 'light')])])]),
      column(42, [image('asset:northline-closing-studio', 'An after-hours design studio with a projected grid and worktable', 1536, 864, { height: '650px' }, { height: '420px' }, false)])
    ], { 'align-items': 'center', gap: '70px' })], { 'background-color': C('ink') }), 'nl-contact-hero'),
    section([row([
      column(34, [label('Useful first notes')]),
      column(66, [
        heading('A few honest sentences are enough.', 'title', 'h2', { d: { 'max-width': '17ch' }, t: {}, m: {} }),
        text('<p><strong>What is changing?</strong><br>The offer, the audience, the company, the product, or the way the work needs to be understood.</p><p><strong>Why now?</strong><br>A launch, a transition, a new chapter, or a system that no longer holds together.</p><p><strong>Where is the pressure?</strong><br>The part that is unclear, inconsistent, difficult to use, or impossible to explain simply.</p>', 'lead', { d: { color: C('slate'), 'max-width': '48ch', 'line-height': '1.8', 'margin-top': '36px' }, t: {}, m: {} }),
        text('<p><a href="mailto:hello@northline.studio">hello@northline.studio</a></p>', 'subtitle', { d: { '--link': C('brand'), 'font-size': 'clamp(25px,3vw,40px)', 'font-weight': '760', 'margin-top': '54px' }, t: {}, m: {} })
      ])
    ], { 'align-items': 'flex-start', gap: '60px' })], { 'background-color': C('surface') })
  ]
});

export function buildIndependentStudioDocument(): Doc {
  Core.seed();
  const tokens = Core.defaultTokens();
  const palette: Record<string, string> = {
    bg: '#f4f0e8', paper: '#f4f0e8', text: '#071a33', ink: '#071a33', brand: '#1646d8',
    muted: '#5f6670', 'muted-i': '#b9c1cf', slate: '#5f6670', line: '#c9c8c0', surface: '#ebe6dc',
    'paper-muted': '#b9c1cf', acid: '#d8ff3e', 'acid-soft': '#edf8c8', red: '#ef3f32'
  };
  for (const color of tokens.colors) if (palette[color.id]) color.value = palette[color.id];
  for (const [id, name, value] of [
    ['paper', 'Warm paper', palette.paper], ['paper-muted', 'Muted on ink', palette['paper-muted']],
    ['acid', 'Signal acid', palette.acid], ['acid-soft', 'Soft acid', palette['acid-soft']], ['red', 'Signal red', palette.red]
  ]) if (!tokens.colors.some(color => color.id === id)) tokens.colors.push({ id, name, value });
  const display = tokens.text.find(style => style.id === 'display');
  if (display) { display.css.d['font-weight'] = '780'; display.css.d['letter-spacing'] = '-.055em'; }
  const title = tokens.text.find(style => style.id === 'title');
  if (title) { title.css.d['font-weight'] = '760'; title.css.d['letter-spacing'] = '-.045em'; }
  const body = tokens.text.find(style => style.id === 'body');
  if (body) { body.css.d['font-size'] = '17px'; body.css.m['font-size'] = '16px'; }
  const lead = tokens.text.find(style => style.id === 'lead');
  if (lead) { lead.css.d['font-size'] = '20px'; lead.css.m['font-size'] = '17px'; }
  Core.state.meta = {
    ...Core.state.meta,
    name: 'Northline Studio', maxWidth: '1200px', size: '17px', lang: 'en',
    font: '"Geist","Helvetica Neue",Arial,sans-serif', headFont: '"Geist","Helvetica Neue",Arial,sans-serif',
    css: `
::selection{background:#d8ff3e;color:#071a33}
.nl-header .pagecraft-container{max-width:1200px}
.nl-menu .pagecraft-nav-toggle{display:flex}
.nl-menu .pagecraft-nav-list{display:none;position:fixed;inset:72px 0 0;z-index:70;background:#071a33;padding:8vh max(42px,calc((100vw - 1200px)/2));flex-direction:column;align-items:flex-start;justify-content:center;gap:0}
.nl-menu.is-open .pagecraft-nav-list{display:flex}
.nl-menu .pagecraft-nav-list li{width:100%;border-top:1px solid #32415a}
.nl-menu .pagecraft-nav-list li:last-child{border-bottom:1px solid #32415a}
.nl-menu .pagecraft-nav-list a{padding:18px 0!important;border-radius:0!important;font-size:clamp(32px,5vw,70px);font-weight:760;line-height:1;color:#f4f0e8}
.nl-menu .pagecraft-nav-list a:hover,.nl-menu .pagecraft-nav-list a:focus-visible{color:#d8ff3e;padding-left:18px!important}
.nl-menu .pagecraft-nav-toggle{margin-left:auto}
.nl-media{overflow:hidden;transition:transform .75s cubic-bezier(.2,.75,.25,1)}
.nl-media:hover{transform:scale(1.025)}
.nl-service-panel{transition:flex-grow .55s cubic-bezier(.2,.75,.25,1),transform .3s ease}
.nl-service-panel:hover,.nl-service-panel:focus-within{flex-grow:2.15;transform:translateY(-8px)}
.nl-service-panel .nl-media{transition:height .55s cubic-bezier(.2,.75,.25,1)}
.nl-service-panel:hover .nl-media,.nl-service-panel:focus-within .nl-media{height:330px!important}
.nl-sticky{position:sticky;top:128px}
.nl-loop-card{position:relative}
.nl-loop-card:before{content:"";position:absolute;left:34px;right:34px;top:24px;height:4px;background:currentColor;opacity:.12}
.nl-button:hover{transform:translateY(-2px)}
.nl-close{background-blend-mode:normal}
@supports(animation-timeline:view()){
  .nl-scrub{opacity:.22;transform:translateY(32px);animation:nl-reveal linear both;animation-timeline:view();animation-range:entry 15% cover 42%}
  @keyframes nl-reveal{to{opacity:1;transform:translateY(0)}}
}
@media(max-width:760px){
  .nl-menu .pagecraft-nav-list{inset:64px 0 0;padding:7vh 20px}
  .nl-menu .pagecraft-nav-list a{font-size:42px}
  .nl-service-row{display:flex!important;flex-direction:column!important}
  .nl-service-panel:hover,.nl-service-panel:focus-within{transform:none}
  .nl-service-panel:hover .nl-media,.nl-service-panel:focus-within .nl-media{height:240px!important}
  .nl-sticky{position:static}
  .nl-timeline{gap:38px!important}
}
@media(prefers-reduced-motion:reduce){.nl-media,.nl-service-panel,.nl-button{transition:none!important}.nl-scrub{animation:none!important;opacity:1!important;transform:none!important}}
`,
    headHtml: '', baseUrl: '', ogImage: 'asset:northline-system-hero', favicon: '', blocks: [], components: [], collections: [], selfHostFonts: 0, tokens
  };
  Core.state.header = header();
  Core.state.footer = footer();
  Core.state.pages = [home(), about(), services(), contact()];
  Core.state.cur = 0;
  const document = structuredClone(Core.doc());
  let nodeIndex = 0;
  const assignStableIds = (nodes: Node[]) => {
    for (const node of nodes) {
      node.id = `northline-v2-node-${String(++nodeIndex).padStart(4, '0')}`;
      if (node.children?.length) assignStableIds(node.children);
    }
  };
  assignStableIds(document.header);
  for (const page of document.pages) assignStableIds(page.tree);
  assignStableIds(document.footer);
  return document;
}
