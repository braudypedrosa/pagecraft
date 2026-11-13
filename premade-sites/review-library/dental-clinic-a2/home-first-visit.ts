import type { Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

/** Replace only the approved First Visit section while retaining its stable root id. */
export function replaceFirstVisit(h: DentalHelpers, page: Page): Page {
  const { color, node, box, text, sec, button } = h;
  const title = 'Your first visit, made clearer.';
  const containsTitle = (item: Page['tree'][number]): boolean =>
    (item.type === 'heading' && item.props.text === title)
    || item.children.some(containsTitle);
  const index = page.tree.findIndex(item => item.type === 'section' && containsTitle(item));
  if (index < 0) throw new Error(`Could not find the Home section containing “${title}”.`);

  const card = (heading: string, lead: string, bullets: string[], background: string) => box([
    text(heading, 'subtitle', 'h3'),
    text(lead, 'body', 'p', { 'margin-top': '18px' }),
    box(bullets.map(copy => text(`•  ${copy}`, 'body', 'p')),
      { display: 'flex', 'flex-direction': 'column', gap: '12px', 'margin-top': '20px' })
  ], {
    'background-color': background,
    'border-radius': '12px',
    'padding-top': '28px', 'padding-right': '28px', 'padding-bottom': '28px', 'padding-left': '28px',
    'min-width': '0'
  }, {
    'padding-top': '22px', 'padding-right': '20px', 'padding-bottom': '22px', 'padding-left': '20px'
  }, {
    'padding-top': '24px', 'padding-right': '24px', 'padding-bottom': '24px', 'padding-left': '24px'
  });

  const cards = box([
    card('Before you arrive', 'Make a note of what matters most to you, then confirm the practical details before you arrive.', [
      'Questions and concerns',
      'Access or communication needs',
      'Information requested by the practice'
    ], color.white),
    card('During your visit', 'Start by sharing what brought you in. Ask for a clear explanation of anything you would like to understand.', [
      'Talk through your concerns',
      'Understand any recommendations',
      'Pause and ask for clarification'
    ], color.sky),
    card('Before you leave', 'Make sure you understand the next step and how to follow up.', [
      'Recap what was discussed',
      'Clarify any fees or choices',
      'Know who to contact'
    ], color.ice)
  ], {
    display: 'grid',
    'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
    gap: '22px',
    'margin-top': '48px'
  }, {
    'grid-template-columns': '1fr',
    gap: '16px',
    'margin-top': '30px'
  }, {
    'grid-template-columns': '1fr',
    gap: '18px',
    'margin-top': '38px'
  });

  const secondaryAction = node('button', {
    text: 'Patient information', link: 'patient-information.html', ts: 'body', variant: 'outline'
  }, {
    'padding-top': '12px', 'padding-right': '0', 'padding-bottom': '12px', 'padding-left': '0',
    'min-height': '48px', 'border-width': '0', 'background-color': 'transparent',
    color: color.white, 'text-decoration': 'underline', 'text-underline-offset': '4px'
  });

  const content = box([
    box([
      text('Your first visit, at your pace.', 'title', 'h2', { color: color.white, 'max-width': '19ch' }),
      text('What to prepare, what to discuss and what to take away from the conversation.', 'lead', 'p', {
        'margin-top': '16px', 'max-width': '70ch', color: color.white
      })
    ], { 'max-width': '850px' }),
    cards,
    box([
      button('Plan your first visit', 'first-visit.html', true),
      secondaryAction
    ], {
      display: 'flex', 'align-items': 'center', 'flex-wrap': 'wrap', gap: '26px', 'margin-top': '30px'
    }, { gap: '18px', 'margin-top': '24px' })
  ], { 'max-width': '1320px', margin: '0 auto', position: 'relative', 'z-index': '1' });

  const replacement = sec([
    box([], {
      position: 'absolute', inset: '0',
      'background-image': `linear-gradient(180deg, color-mix(in srgb, ${color.ink} 76%, transparent) 0%, color-mix(in srgb, ${color.ink} 78%, transparent) 38%, ${color.ink} 78%)`,
      'pointer-events': 'none'
    }),
    box([content], {
      position: 'relative', 'z-index': '1',
      'padding-top': '84px', 'padding-right': '56px', 'padding-bottom': '84px', 'padding-left': '56px'
    }, {
      'padding-top': '48px', 'padding-right': '22px', 'padding-bottom': '48px', 'padding-left': '22px'
    }, {
      'padding-top': '64px', 'padding-right': '32px', 'padding-bottom': '64px', 'padding-left': '32px'
    })
  ], {
    position: 'relative', overflow: 'hidden', 'background-color': color.primary,
    'background-image': 'url("asset:visit-consultation-detail")',
    'background-size': '100% auto', 'background-position': 'right top', 'background-repeat': 'no-repeat',
    'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0'
  }, {
    'background-size': 'auto 320px', 'background-position': '65% top',
    'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0'
  }, {
    'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0'
  });
  replacement.id = page.tree[index].id;

  const tree = [...page.tree];
  tree[index] = replacement;
  return { ...page, tree };
}
