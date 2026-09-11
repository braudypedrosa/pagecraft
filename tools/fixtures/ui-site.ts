/** Fictional real-screen data. No account, environment or network dependencies. */
import * as Core from '../../app/src/core/index.ts';
import { blankDoc } from '../../server/src/render.ts';
import type { Doc } from '../../app/src/core/types.ts';

export const QA_SITE_NAME = 'QA UI Foundations — community workshops and accessibility resources';
export function uiFixtureDocument(): Doc {
  const document = blankDoc(QA_SITE_NAME);
  const heading = Core.N('heading', {text: 'Community workshops and accessibility resources', level: 'h1'});
  heading.id = 'qa-ui-heading';
  const form = Core.N('form', {mode: 'wordpress', aria: 'Workshop registration and accessibility support request'});
  form.id = 'qa-ui-contact';
  form.name = 'Workshop registration and accessibility support request';
  document.pages[0] = {...document.pages[0], id: 'qa-ui-home', name: 'Home', title: QA_SITE_NAME,
    desc: 'A fictional fixture for long content, compact controls and recovery checks.',
    tree: [Core.N('section', {}, {}, [heading, form])]};
  document.pages.push({id: 'qa-ui-events',
    name: 'Annual community workshops, events and accessibility resources',
    slug: 'community-workshops-and-accessibility-resources',
    title: 'Community workshops and accessibility resources',
    desc: 'Long page metadata used only for QA. No account information is included.',
    tree: [Core.N('section', {}, {}, [Core.N('heading', {text: 'Upcoming community workshops', level: 'h1'})])]});
  document.meta.collections = [{id: 'qa-ui-events',
    name: 'Community workshops, events and accessibility resources', slug: 'qa-workshops', detail: '',
    fields: [
      {id: 'title', name: 'Workshop title shown in listings and the calendar', type: 'text', required: 1},
      {id: 'description', name: 'Supporting description and accessibility information', type: 'rich'},
      {id: 'enabled', name: 'Include in the upcoming community events listing', type: 'bool'},
      {id: 'category', name: 'Workshop category', type: 'option', opts: 'Community,Accessibility,Design'},
    ],
    items: Array.from({length: 27}, (_, i) => ({id: `qa-ui-item-${i+1}`, slug: `workshop-${i+1}`,
      ...(i % 3 === 0 ? {draft: 1 as const} : {}),
      values: {title: `${i+1}. Community workshop and accessibility review for local teams`,
        description: '<p>Fictional workshop details with a longer description that should wrap naturally.</p>',
        enabled: i % 2 === 0 ? '1' : '0', category: 'Accessibility'}}))},
    {id: 'qa-ui-empty', name: 'QA empty collection', slug: 'qa-empty', detail: '',
      fields: [{id: 'title', name: 'Title', type: 'text', required: 1}], items: []}];
  return document;
}
