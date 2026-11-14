import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers, DentalStyle } from './expanded-types.ts';

/** The five approved Treatments sections, built entirely with native nodes. */
export function refineTreatments(h: DentalHelpers, page: Page): Page {
  const { box, button, color, image, node, sec, text } = h;
  const pad = (vertical: string, horizontal: string): DentalStyle => ({ 'padding-top': vertical, 'padding-right': horizontal, 'padding-bottom': vertical, 'padding-left': horizontal });
  const contained = (children: Node[]) => box(children, { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' });
  const eyebrow = (value: string) => text(value, 'eyebrow', 'p', { color: color.primary, 'letter-spacing': '.12em', 'text-transform': 'uppercase' });
  const link = (label: string, href: string) => node('button', { text: label, link: href, ts: 'btn', variant: 'outline' }, {
    ...pad('10px', '0'), 'min-height': '44px', 'border-width': '0', 'background-color': 'transparent', color: color.primary,
    'text-decoration': 'underline', 'text-underline-offset': '4px'
  });
  const heroPhoto = image('everyday-care-adult', 'An adult smiling during a dental visit', '100%', '300px');
  heroPhoto.props.w = 1448; heroPhoto.props.h = 1086;
  Object.assign(heroPhoto.css.d, { position: 'absolute', inset: '0', width: '100%', height: '100%', 'object-position': 'center top', 'border-radius': '0' });
  Object.assign(heroPhoto.css.m, { position: 'relative', inset: 'auto', height: '300px', 'object-position': 'center 20%' });
  Object.assign(heroPhoto.css.t, { position: 'relative', inset: 'auto', height: 'auto' });
  const heroShade = box([], { position: 'absolute', inset: '0', 'background-image': `linear-gradient(90deg, ${color.white} 0%, color-mix(in srgb, ${color.white} 94%, transparent) 35%, transparent 75%)`, 'pointer-events': 'none' }, { display: 'none' }, { display: 'none' });
  const heroContent = box([contained([
    eyebrow('Our care'),
    text('Care that starts with you.', 'display', 'h1', { 'margin-top': '14px', 'max-width': '540px' }),
    text('Explore common types of care and bring your questions to a conversation with your dental team.', 'lead', 'p', { 'margin-top': '18px', 'max-width': '58ch' }),
    box([button('Talk about your care', 'contact.html')], { 'margin-top': '26px' }),
    box([link('Preventive care', '#preventive-care'), link('Restorative care', '#restorative-care'), link('Planning together', '#planning-together')], { display: 'flex', 'flex-wrap': 'wrap', gap: '8px 24px', 'margin-top': '22px' }, { gap: '4px 20px' })
  ])], { position: 'relative', 'z-index': '1', 'min-height': '700px', ...pad('110px', '56px') }, { 'min-height': '0', ...pad('36px', '22px'), 'background-color': color.white }, { 'min-height': '0', ...pad('48px', '32px'), 'background-color': color.white });
  // Match the visible inset of the approved logo artwork, as on Home.
  heroContent.children[0].css.d['padding-left'] = '18px';
  heroContent.children[0].css.m['padding-left'] = '14px';
  const hero = sec([heroPhoto, heroShade, heroContent], { position: 'relative', ...pad('0', '0') }, { ...pad('0', '0') }, { ...pad('0', '0') });

  const careRows: [string, string, string][] = [
    ['icon-preventive', 'Routine check-ups', 'Ask what a check-up may involve and what you want to understand.'],
    ['icon-restorative', 'Hygiene and daily care', 'Discuss the questions behind your everyday routine.'],
    ['icon-planning', 'A plan that fits', 'Share what is easy or difficult and talk through the next step.']
  ];
  const room = image('light-filled-treatment-room', 'A bright dental treatment room', '520px', '280px');
  room.props.w = 1672; room.props.h = 941;
  room.css.d['object-position'] = 'right center';
  room.css.t.height = '420px';
  const preventive = sec([contained([box([
    room,
    box([
      eyebrow('Preventive care'),
      text('Support for your everyday oral health.', 'title', 'h2', { 'margin-top': '14px' }),
      text('Preventive care can help you understand your oral health and make informed choices about looking after it.', 'lead', 'p', { 'margin-top': '16px' }),
      box(careRows.map(([icon, heading, copy]) => box([
        node('image', { src: `asset:${icon}`, alt: '', decorative: 1, lazy: 0, w: 32, h: 32 }, { width: '32px', height: '32px', 'object-fit': 'contain', 'border-radius': '0' }),
        box([text(heading, 'body', 'h3', { 'font-weight': '600' }), text(copy, 'body', 'p', { 'margin-top': '3px' })])
      ], { display: 'grid', 'grid-template-columns': '32px minmax(0, 1fr)', gap: '20px', 'align-items': 'start' })), { display: 'flex', 'flex-direction': 'column', gap: '24px', 'margin-top': '28px' }),
      box([link('Prepare for your first visit', 'first-visit.html')], { 'margin-top': '24px' })
    ])
  ], { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '56px', 'align-items': 'center' }, { 'grid-template-columns': '1fr', gap: '28px' }, { gap: '32px' })])], { 'background-color': color.ice });
  preventive.adv.htmlId = 'preventive-care';

  const scene = box([], { 'background-image': 'url("asset:comfortable-consultation")', 'background-size': 'cover', 'background-position': 'center top', 'background-repeat': 'no-repeat', 'border-radius': '12px', ...pad('35%', '0') }, { ...pad('135px', '0') }, { ...pad('37.5%', '0') });
  const explanation = (heading: string, copy: string) => box([text(heading, 'subtitle', 'h3'), text(copy, 'body', 'p', { 'margin-top': '10px' })]);
  const panel = box([
    eyebrow('Restorative care'),
    text('Understand the options before deciding.', 'title', 'h2', { 'margin-top': '14px' }),
    text('If a tooth needs attention, ask the team to explain the options it considers relevant to your situation.', 'lead', 'p', { 'margin-top': '16px' }),
    box([
      explanation('Understand the concern', 'Ask what the team has noticed and what it means for your oral health.'),
      explanation('Consider the choices', 'Talk through possible approaches, alternatives and questions before deciding.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '40px', 'margin-top': '30px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '24px' }),
    box([link('Discuss your care options', 'contact.html')], { 'margin-top': '24px' })
  ], { position: 'relative', 'max-width': '95.6%', 'margin-top': '-64px', 'margin-left': '2.2%', 'margin-right': '2.2%', 'background-color': color.ice, 'border-radius': '12px', ...pad('40px', '44px') },
  { 'max-width': '100%', 'margin-top': '0', 'margin-left': '0', 'margin-right': '0', ...pad('28px', '22px') }, { ...pad('32px', '32px') });
  const restorative = sec([contained([scene, panel])], { 'background-color': color.white });
  restorative.adv.htmlId = 'restorative-care';

  const accordion = node('accordion', { open: 'first', single: 1, marker: 'plus', items: [
    { q: 'How do I know which option is right for me?', a: 'Ask the dental team to explain the options it considers relevant to your needs, along with the reasons, trade-offs and any uncertainties. You can ask questions before deciding.' },
    { q: 'Can I ask about fees before treatment?', a: 'Ask the practice for current fees and payment information before deciding. You can ask the team to explain anything that is unclear.' },
    { q: 'What if I need more time to think?', a: 'Let the team know. You can ask for a clearer explanation or time to consider the information before discussing next steps.' },
    { q: 'What questions can I bring to the discussion?', a: 'Ask about the proposed care, possible alternatives, timing and fees. Bring any other questions that matter to you.' }
  ] }, { '--ac-line': color.sky, '--ac-pad': '22px', '--ac-q-size': '21px', '--ac-q-weight': '600', '--ac-q-color': color.ink, '--ac-a-size': '17px', '--ac-a-color': color.ink, '--ac-mark': color.primary }, [], { '--ac-pad': '18px', '--ac-q-size': '18px', '--ac-a-size': '16px' });
  const planning = sec([contained([
    eyebrow('Planning together'),
    text('Make space for the questions that matter.', 'title', 'h2', { 'margin-top': '14px' }),
    text('A treatment plan is easier to understand when you can ask about choices, timing and fees.', 'lead', 'p', { 'margin-top': '16px' }),
    box([accordion], { 'margin-top': '36px' }, { 'margin-top': '28px' })
  ])], { 'background-color': color.ice });
  planning.adv.htmlId = 'planning-together';

  const closingContent = box([contained([
    text('Start with a conversation.', 'title', 'h2', { color: color.white }),
    text('Share what you would like help with and bring your questions to the team.', 'lead', 'p', { color: color.white, 'margin-top': '16px', 'max-width': '62ch' }),
    box([button('Request a visit', 'contact.html', true)], { 'margin-top': '28px' })
  ])], { position: 'relative', 'z-index': '1', ...pad('76px', '56px') }, { ...pad('48px', '22px') }, { ...pad('60px', '32px') });
  const closing = sec([
    box([], { position: 'absolute', inset: '0', 'background-color': color.ink, opacity: '.82', 'pointer-events': 'none' }),
    closingContent
  ], { position: 'relative', 'background-color': color.ink, 'background-image': 'url("asset:cta-clinic-entrance")', 'background-size': 'cover', 'background-position': 'center 50%', 'background-repeat': 'no-repeat', ...pad('0', '0') }, { ...pad('0', '0') }, { ...pad('0', '0') });
  return { ...page, tree: [hero, preventive, restorative, planning, closing] };
}
