import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers, DentalStyle } from './expanded-types.ts';

/** The five approved Care Team sections, built with native nodes. */
export function refineCareTeam(h: DentalHelpers, page: Page): Page {
  const { box, button, color, naturalImage, node, portrait, sec, text } = h;
  const pad = (vertical: string, horizontal: string): DentalStyle => ({ 'padding-top': vertical, 'padding-right': horizontal, 'padding-bottom': vertical, 'padding-left': horizontal });
  const contained = (children: Node[]) => box(children, { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' });
  const eyebrow = (copy: string, shade = color.primary) => text(copy, 'eyebrow', 'p', { color: shade, 'letter-spacing': '.1em', 'text-transform': 'uppercase' });

  const hero = sec([contained([
    eyebrow('Care team', color.sky),
    text('A team that listens.', 'display', 'h1', { color: color.white, 'margin-top': '14px' }),
    text('A good visit begins with a conversation. Meet the people who make space for your questions and your comfort.', 'lead', 'p', { color: color.white, 'margin-top': '18px', 'max-width': '65ch' }),
    box([button('Meet the team', '#meet-the-team', true)], { 'margin-top': '28px' })
  ])], { 'background-color': color.ink, ...pad('100px', '56px') }, { ...pad('56px', '22px') }, { ...pad('72px', '32px') });

  const profile = (asset: string, alt: string, title: string, copy: string) => box([
    portrait(asset, alt),
    box([text(title, 'subtitle', 'h3'), text(copy, 'body', 'p', { 'margin-top': '12px' })])
  ], { display: 'grid', 'grid-template-columns': '42fr 58fr', gap: '24px', 'align-items': 'center', 'background-color': color.ice, 'border-radius': '12px', ...pad('28px', '28px') },
  { 'grid-template-columns': '1fr', gap: '22px', ...pad('22px', '22px') });
  const people = sec([contained([
    text('People behind your care.', 'title', 'h2'),
    text('Meet a team ready to listen and explain.', 'lead', 'p', { 'margin-top': '12px' }),
    box([
      profile('care-team-portrait-01', 'Dental team member in a bright practice', 'Your dental team', 'Here to discuss your oral health, explain your options and help you make informed decisions.'),
      profile('care-team-portrait-02', 'Dental team member in a clinical setting', 'Support at every step', 'From your first inquiry through your visit, a welcoming team can help you understand what to expect.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '24px', 'margin-top': '36px' }, { 'grid-template-columns': '1fr', gap: '20px', 'margin-top': '28px' }, { 'grid-template-columns': '1fr' })
  ])], { 'background-color': color.white });
  people.adv.htmlId = 'meet-the-team';

  const explanation = (title: string, copy: string) => box([text(title, 'subtitle', 'h3'), text(copy, 'body', 'p', { 'margin-top': '10px' })]);
  const consultation = naturalImage('comfortable-consultation', 'A clinician and patient in conversation', 1448, 1086);
  const approachPanel = box([
    eyebrow('How we work with you'),
    text('Care starts with listening.', 'title', 'h2', { 'margin-top': '12px' }),
    text('Your questions, concerns and priorities help shape the conversation. The team can explain what it knows, what it recommends and where you may want more information.', 'lead', 'p', { 'margin-top': '14px' }),
    box([
      explanation('Talk through what matters', 'Share what has brought you in and what you hope to understand. You can ask the team to pause or explain something another way.'),
      explanation('Understand your choices', 'Ask about the reasons for a recommendation, any alternatives to discuss and what questions remain for you.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '28px', 'margin-top': '28px' }, { 'grid-template-columns': '1fr', gap: '22px', 'margin-top': '24px' })
  ], { position: 'relative', 'margin-left': '-16px', 'background-color': color.white, 'border-radius': '12px', ...pad('32px', '36px') },
  { 'margin-left': '0', ...pad('28px', '22px') }, { 'margin-left': '0', ...pad('32px', '32px') });
  const approach = sec([contained([box([consultation, approachPanel],
    { display: 'grid', 'grid-template-columns': '51fr 49fr', 'align-items': 'center' },
    { 'grid-template-columns': '1fr', gap: '20px' }, { 'grid-template-columns': '1fr', gap: '24px' })])], { 'background-color': '#EAF1F3' });

  const prompts: [string, string, string][] = [
    ['perspective-concerns', 'What you would like help with', 'Describe your concerns or the questions you most want answered.'],
    ['perspective-comfort', 'What would help you feel comfortable', 'Tell the practice about any communication or accessibility needs you want it to know about.'],
    ['perspective-choices', 'What you want to understand', 'Ask the team to explain recommendations, options or next steps in a way that is clear to you.']
  ];
  const perspective = sec([contained([
    text('Bring your perspective', 'title', 'h2'),
    text('A few points can help you make the most of a conversation with the team. There is no need to have everything figured out beforehand.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '80ch' }),
    box(prompts.map(([icon, title, copy]) => box([
      node('image', { src: `asset:${icon}`, alt: '', decorative: 1, lazy: 0, w: 48, h: 48 }, { width: '48px', height: '48px', 'object-fit': 'contain', 'border-radius': '0' }),
      text(title, 'subtitle', 'h3', { 'margin-top': '24px' }),
      text(copy, 'body', 'p', { 'margin-top': '14px' })
    ], { 'background-color': '#F4F7F8', border: '1px solid #D7E1E5', 'border-radius': '12px', ...pad('32px', '32px') })),
    { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '24px', 'margin-top': '36px' },
    { 'grid-template-columns': '1fr', gap: '20px', 'margin-top': '28px' }, { 'grid-template-columns': '1fr' })
  ])], { 'background-color': color.white });

  const closingContent = box([contained([
    text('Get ready for your first visit.', 'title', 'h2', { color: color.white }),
    text('Learn what you may want to ask or share before speaking with the team.', 'lead', 'p', { color: color.white, 'margin-top': '16px', 'max-width': '62ch' }),
    box([button('Your first visit', 'first-visit.html', true)], { 'margin-top': '28px' })
  ])], { position: 'relative', 'z-index': '1', ...pad('100px', '56px') }, { ...pad('56px', '22px') }, { ...pad('72px', '32px') });
  const closing = sec([
    box([], { position: 'absolute', inset: '0', 'background-color': color.ink, opacity: '.82', 'pointer-events': 'none' }),
    closingContent
  ], { position: 'relative', 'background-color': color.ink, 'background-image': 'url("asset:welcoming-reception")', 'background-size': 'cover', 'background-position': 'center center', 'background-repeat': 'no-repeat', ...pad('0', '0') }, { ...pad('0', '0') }, { ...pad('0', '0') });
  return { ...page, tree: [hero, people, approach, perspective, closing] };
}
