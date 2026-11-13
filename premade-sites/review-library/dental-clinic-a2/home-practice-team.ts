import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

/** Replace only the two approved Home sections, preserving their root IDs. */
export function replacePracticeAndTeam(h: DentalHelpers, page: Page): Page {
  const { box, button, color, image, node, portrait, sec, text } = h;
  const hasText = (n: Node, value: string): boolean =>
    (n.props.text === value) || n.children.some(child => hasText(child, value));
  const approachIndex = page.tree.findIndex(n => hasText(n, 'Care begins with a conversation.'));
  const teamIndex = page.tree.findIndex(n => hasText(n, 'People behind your care.'));
  if (approachIndex < 0 || teamIndex < 0 || approachIndex === teamIndex) {
    throw new Error('Expected distinct Practice and Team sections on Home.');
  }
  const contained = (children: Node[]) => box(children, { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' });
  const editorial = (heading: string, copy: string) => box([
    text(heading, 'subtitle', 'h3'),
    text(copy, 'body', 'p', { 'margin-top': '14px' })
  ], { 'border-top': `3px solid ${color.sky}`, 'padding-top': '18px' });
  const link = node('button', { text: 'Get to know our approach', link: 'care-team.html', ts: 'btn', variant: 'outline' }, {
    'padding-top': '10px', 'padding-right': '0', 'padding-bottom': '10px', 'padding-left': '0', 'min-height': '44px',
    'border-width': '0', 'background-color': 'transparent', color: color.primary, 'text-decoration': 'underline', 'text-underline-offset': '4px'
  });
  const reception = image('welcoming-reception', 'A welcoming dental practice reception', '350px', '240px');
  reception.props.w = 1672; reception.props.h = 941;
  const practice = sec([contained([
    text('Welcome to Linden Dental', 'eyebrow', 'p', { color: color.primary, 'letter-spacing': '.12em', 'text-transform': 'uppercase' }),
    text('A welcoming place to talk about your smile.', 'title', 'h2', { 'margin-top': '14px' }),
    text('Family-focused care begins with listening. We make space for your concerns, explain the choices in front of you and help you feel clearer about the next step.', 'lead', 'p', { 'margin-top': '16px', 'max-width': '80ch' }),
    box([reception], { 'margin-top': '36px' }, { 'margin-top': '26px' }),
    box([
      editorial('Your concerns come first.', 'Tell us what brought you in, what you would like to understand and anything that could help you feel more comfortable. There is room for questions, even when you are not sure where to start.'),
      editorial('Clarity at every step.', 'Talk through recommendations, possible choices and what you want explained again. Share your communication or access needs before your visit so the conversation can begin with what matters to you.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '48px', 'margin-top': '36px' }, { 'grid-template-columns': '1fr', gap: '26px', 'margin-top': '28px' }),
    box([link], { 'margin-top': '24px' })
  ])], { 'background-color': color.white });
  practice.id = page.tree[approachIndex].id;

  const first = portrait('care-team-portrait-01', 'Dental team member in a bright practice');
  const second = portrait('care-team-portrait-02', 'Dental team member in a clinical setting');
  const portraits = box([first, second], {
    display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '16px', 'grid-column': '2', 'grid-row': '1'
  }, { 'grid-column': '1', 'grid-row': '1', gap: '12px' }, { 'grid-column': '1', 'grid-row': '1' });
  const details = box([
    text('People behind your care.', 'title', 'h2'),
    text('Meet a team ready to listen and explain.', 'lead', 'p', { 'margin-top': '18px' }),
    box([editorial('Your dental conversation', 'Share what matters to you, ask questions and talk through your options.')], { 'margin-top': '28px' }),
    box([editorial('Support around your visit', 'Discuss how to prepare and any comfort or communication needs before you arrive.')], { 'margin-top': '24px' }),
    box([button('Meet the care team', 'care-team.html')], { 'margin-top': '28px' })
  ], { 'grid-column': '1', 'grid-row': '1' }, { 'grid-column': '1', 'grid-row': '2' }, { 'grid-column': '1', 'grid-row': '2' });
  const team = sec([contained([box([portraits, details], {
    display: 'grid', 'grid-template-columns': 'minmax(0, .85fr) minmax(0, 2fr)', gap: '36px', 'align-items': 'start'
  }, { 'grid-template-columns': '1fr', gap: '28px' }, { 'grid-template-columns': '1fr', gap: '32px' })])], { 'background-color': color.white });
  team.id = page.tree[teamIndex].id;
  const tree = [...page.tree]; tree[approachIndex] = practice; tree[teamIndex] = team;
  return { ...page, tree };
}
