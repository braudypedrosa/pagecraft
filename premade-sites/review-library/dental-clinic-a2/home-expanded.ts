import type { Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

/** Preserve the approved A2 opening and add the six approved native sections. */
export function expandHome(h: DentalHelpers, original: Page): Page {
  const { color, node, box, text, sec, naturalImage, button } = h;
  const contained = (children: Parameters<typeof box>[0]) => box(children, { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' });
  const introStack = (title: string, description: string) => box([
    text(title, 'title', 'h2'),
    text(description, 'lead', 'p', { 'margin-top': '16px', 'max-width': '68ch' })
  ]);
  const approachImage = naturalImage('approach-conversation', 'A clinician listening to a patient during a conversation', 703, 669);
  Object.assign(approachImage.css.d, { height: '380px', 'object-position': '50% 35%' });
  approachImage.css.t.height = '340px';
  approachImage.css.m.height = '300px';
  const approach = sec([contained([box([
    approachImage,
    box([
      ...[text('Care begins with a conversation.', 'title', 'h2', { 'max-width': '16ch' }),
        text('Space to ask questions. Time to understand your options.', 'lead', 'p', { 'margin-top': '18px', 'max-width': '46ch' })],
      box([button('Our approach', 'care-team.html')], { 'margin-top': '28px' })
    ])
  ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '64px', 'align-items': 'center' },
     { 'grid-template-columns': '1fr', gap: '28px' }, { gap: '40px' })])], { 'background-color': color.white, 'padding-top': '60px', 'padding-bottom': '60px' });

  const entries: [string, string, string, string][] = [
    ['icon-preventive', 'Preventive care', 'Regular check-ups help you stay informed about your oral health.', 'Your dental team can discuss an approach suited to your needs.'],
    ['icon-restorative', 'Restorative care', 'Discuss options for looking after teeth that need attention.', 'Your team can explain the choices available to you.'],
    ['icon-planning', 'Treatment planning', 'Talk through your needs and questions with your dental team.', 'Ask about the process, alternatives and costs.']
  ];
  const treatment = sec([contained([
    introStack('Explore your care options.', 'Understand the kinds of care you can discuss with your dental team.'),
    box(entries.map(([icon, heading, first, second]) => box([
      node('image', { src: `asset:${icon}`, alt: '', decorative: 1, lazy: 0, w: 32, h: 32 }, { width: '36px', height: '36px', 'object-fit': 'contain', 'border-radius': '0', 'margin-bottom': '22px' }),
      text(heading, 'subtitle', 'h3'),
      text(first, 'body', 'p', { 'margin-top': '18px' }),
      text(second, 'body', 'p', { 'margin-top': '12px' })
    ], { 'border-top': `2px solid ${color.sky}`, 'padding-top': '22px' })),
    { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '40px', 'margin-top': '44px' },
    { 'grid-template-columns': '1fr', gap: '28px', 'margin-top': '32px' }),
    box([button('View treatments', 'treatments.html')], { 'margin-top': '36px' })
  ])], { 'background-color': color.ice });

  const steps: [string, string, string][] = [
    ['Before your visit', 'Bring any questions and let us know what would help you feel comfortable.', color.white],
    ['During your visit', 'We’ll listen to your concerns and explain what we see.', color.sky],
    ['After your visit', 'We’ll talk through options and agree on what comes next.', color.ice]
  ];
  const visitIntro = introStack('Your first visit, made clearer.', 'Know what to bring, share what matters to you, and talk through next steps with your care team.');
  visitIntro.children.forEach(child => { child.css.d.color = color.white; });
  const visit = sec([contained([box([
    box([
      visitIntro,
      box([button('Plan your first visit', 'first-visit.html', true)], { 'margin-top': '28px' })
    ]),
    box(steps.map(([title, copy, bg]) => box([
      text(title, 'subtitle', 'h3'), text(copy, 'body', 'p', { 'margin-top': '8px' })
    ], { 'background-color': bg, 'padding-top': '22px', 'padding-right': '24px', 'padding-bottom': '22px', 'padding-left': '24px' })),
    { display: 'flex', 'flex-direction': 'column', gap: '14px' })
  ], { display: 'grid', 'grid-template-columns': '.85fr 1.15fr', gap: '64px', 'align-items': 'start' },
     { 'grid-template-columns': '1fr', gap: '30px' }, { gap: '40px' })])], { 'background-color': color.primary });

  const teamImage = naturalImage('care-team-scene', 'Dental team members in conversation together', 1536, 647);
  teamImage.css.d['border-radius'] = '0';
  const team = sec([
    box([contained([
      introStack('People behind your care.', 'Meet a team ready to listen and explain.'),
      box([button('Meet the care team', 'care-team.html')], { 'margin-top': '26px' })
    ])], { 'padding-top': '76px', 'padding-right': '56px', 'padding-bottom': '48px', 'padding-left': '56px' },
    { 'padding-top': '48px', 'padding-right': '22px', 'padding-bottom': '32px', 'padding-left': '22px' },
    { 'padding-top': '60px', 'padding-right': '32px', 'padding-bottom': '40px', 'padding-left': '32px' }),
    teamImage
  ], { 'background-color': color.white, 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' },
     { 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' },
     { 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' });

  const faq = node('accordion', {
    open: 'first', single: 1, marker: 'plus', items: [
      { q: 'What should I bring to my first visit?', a: 'Ask the practice what it needs before your visit. Bring your questions so you can discuss them with the team.' },
      { q: 'Can I discuss feeling nervous?', a: 'Yes. Let the team know how you are feeling and what would help you feel more comfortable.' },
      { q: 'How can I ask about fees?', a: 'Ask the practice about current fees and payment options before your visit. You can also discuss the cost of any proposed care before deciding.' },
      { q: 'Can I ask for a clearer explanation?', a: 'Yes. Ask us to explain an unfamiliar term, a recommendation or a possible next step in plain language.' }
    ]
  }, { '--ac-line': color.sky, '--ac-pad': '22px', '--ac-q-size': '21px', '--ac-q-weight': '600', '--ac-q-color': color.ink, '--ac-a-size': '17px', '--ac-a-color': color.ink, '--ac-mark': color.primary }, [],
  { '--ac-pad': '18px', '--ac-q-size': '18px', '--ac-a-size': '16px' });
  const infoLink = node('button', { text: 'More patient information', link: 'patient-information.html', ts: 'body', variant: 'outline' },
    { 'padding-top': '10px', 'padding-right': '0', 'padding-bottom': '10px', 'padding-left': '0', 'min-height': '44px', 'border-width': '0', 'background-color': 'transparent', color: color.primary, 'text-decoration': 'underline', 'text-underline-offset': '4px' });
  const questions = sec([contained([
    introStack('A few questions, answered.', 'Useful things to know before you get in touch.'),
    box([faq], { 'margin-top': '40px' }),
    box([infoLink], { 'margin-top': '28px' })
  ])], { 'background-color': color.ice });

  const closingContent = box([contained([
    text('Let’s talk about your next visit.', 'title', 'h2', { color: color.white }),
    text('Tell us what you need and bring your questions to the team.', 'lead', 'p', { 'margin-top': '16px', color: color.white, 'max-width': '64ch' }),
    box([button('Request a visit', 'contact.html', true)], { 'margin-top': '28px' })
  ])], { position: 'relative', 'z-index': '1', 'padding-top': '76px', 'padding-right': '56px', 'padding-bottom': '76px', 'padding-left': '56px' },
  { 'padding-top': '48px', 'padding-right': '22px', 'padding-bottom': '48px', 'padding-left': '22px' },
  { 'padding-top': '60px', 'padding-right': '32px', 'padding-bottom': '60px', 'padding-left': '32px' });
  const closing = sec([
    box([], { position: 'absolute', inset: '0', 'background-color': color.ink, opacity: '.82', 'pointer-events': 'none' }),
    closingContent
  ], { position: 'relative', 'background-color': color.ink, 'background-image': 'url("asset:cta-clinic-entrance")', 'background-size': 'cover', 'background-position': 'center 50%', 'background-repeat': 'no-repeat', 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' },
  { 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' },
  { 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' });
  return { ...original, tree: [...original.tree, approach, treatment, visit, team, questions, closing] };
}
