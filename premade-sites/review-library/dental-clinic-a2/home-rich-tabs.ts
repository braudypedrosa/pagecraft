import type { Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

/** Replace the two earlier care teasers with the approved native treatment explorer. */
export function replaceCareTeasers(h: DentalHelpers, page: Page): Page {
  const { box, button, color, image, node, sec, text } = h;
  const topics = [
    {
      label: 'Preventive care', image: 'light-filled-treatment-room', alt: 'A bright dental treatment room',
      title: 'Everyday care, clearly explained.',
      description: 'Start with routine check-ups, hygiene questions and the habits you want to understand. A conversation can help you make sense of your oral health and the next step.',
      items: [
        ['Routine check-ups', 'Discuss changes, concerns and what you want to understand.'],
        ['Hygiene and daily care', 'Explore the questions behind your everyday routine.'],
        ['A plan you understand', 'Leave the conversation clear on what to consider next.']
      ], action: 'Explore preventive care'
    },
    {
      label: 'Restorative care', image: 'everyday-care-adult', alt: 'An adult discussing dental care',
      title: 'Support for teeth that need attention.',
      description: 'Discuss what is concerning you and ask your dental team to explain the options available for your needs.',
      items: [
        ['Share your concerns', 'Describe any changes or questions you have noticed.'],
        ['Understand the options', 'Ask how different choices could address your needs.'],
        ['Discuss next steps', 'Talk through the process and what to consider before deciding.']
      ], action: 'Explore restorative care'
    },
    {
      label: 'Treatment planning', image: 'comfortable-consultation', alt: 'A clinician and patient in conversation',
      title: 'Make sense of your choices.',
      description: 'A treatment conversation is a chance to ask about recommendations, alternatives and the practical details that matter to you.',
      items: [
        ['Your priorities', 'Share what matters most to you and what you would like explained.'],
        ['The choices', 'Ask about the process and any alternatives available.'],
        ['Costs and timing', 'Discuss fees and next steps before deciding how to proceed.']
      ], action: 'Explore treatment planning'
    }
  ];
  const icons = ['icon-preventive', 'icon-restorative', 'icon-planning'];
  const panels = topics.map(topic => {
    const photo = image(topic.image, topic.alt, '430px', '260px');
    Object.assign(photo.css.d, { 'grid-column': '2', 'grid-row': '1', 'object-position': 'center' });
    Object.assign(photo.css.m, { 'grid-column': '1', 'grid-row': '1' });
    const content = box([
      text(topic.title, 'title', 'h3'),
      text(topic.description, 'lead', 'p', { 'margin-top': '18px', 'max-width': '62ch' }),
      box(topic.items.map(([title, description], i) => box([
        node('image', { src: `asset:${icons[i]}`, alt: '', decorative: 1, lazy: 0, w: 32, h: 32 }, { width: '32px', height: '32px', 'object-fit': 'contain', 'border-radius': '0', 'flex-shrink': '0' }),
        box([text(title, 'body', 'h4', { 'font-weight': '600' }), text(description, 'body', 'p', { 'margin-top': '3px' })])
      ], { display: 'grid', 'grid-template-columns': '32px minmax(0, 1fr)', gap: '20px', 'align-items': 'start' })), { display: 'flex', 'flex-direction': 'column', gap: '22px', 'margin-top': '30px' }),
      box([
        button(topic.action, 'treatments.html'),
        node('button', { text: 'View all care topics', link: 'treatments.html', ts: 'btn', variant: 'outline' }, { 'padding-top': '12px', 'padding-right': '0', 'padding-bottom': '12px', 'padding-left': '0', 'min-height': '48px', 'border-width': '0', 'background-color': 'transparent', color: color.primary, 'text-decoration': 'underline', 'text-underline-offset': '4px' })
      ], { display: 'flex', 'flex-wrap': 'wrap', gap: '24px', 'align-items': 'center', 'margin-top': '32px' }, { gap: '12px' })
    ], { 'grid-column': '1', 'grid-row': '1' }, { 'grid-column': '1', 'grid-row': '2' });
    return box([photo, content], { display: 'grid', 'grid-template-columns': 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '48px', 'align-items': 'start' }, { 'grid-template-columns': 'minmax(0, 1fr)', gap: '28px' }, { gap: '32px' });
  });
  const tabs = node('tabs', { items: topics.map((topic, i) => ({ label: topic.label, panelId: panels[i].id })) }, {
    'margin-top': '34px', '--tb-on': color.primary, '--tb-off': color.ink, '--tb-line': color.line, '--tb-size': '18px', '--tb-weight': '600', '--tb-gap': '40px', '--tb-body-color': color.ink, '--tb-body-pad': '42px'
  }, panels, { 'margin-top': '24px', '--tb-size': '16px', '--tb-gap': '18px', '--tb-body-pad': '28px' });
  const section = sec([box([
    text('Our care', 'eyebrow', 'p', { color: color.primary, 'letter-spacing': '.12em', 'text-transform': 'uppercase' }),
    text('Find a clearer path to your care.', 'title', 'h2', { 'margin-top': '14px' }),
    text('Explore everyday dental care, support for teeth that need attention, and the choices to discuss with your team.', 'lead', 'p', { 'margin-top': '16px', 'max-width': '85ch' }),
    tabs
  ], { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' })], { 'background-color': color.ice });
  return { ...page, tree: [page.tree[0], section, page.tree[2], ...page.tree.slice(4)] };
}
