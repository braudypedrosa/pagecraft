import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

/** Apply the approved four-page sitemap after the existing pages are built. */
export function refineAbout(h: DentalHelpers, pages: Page[], header: Node[], footer: Node[]): Page[] {
  const about = pages.find(page => page.id === 'dental-care-team');
  if (!about) throw new Error('Care Team page is missing');

  const photo = h.naturalImage('care-team-scene', 'The dental team together at the practice', 1536, 647);
  photo.css.d['margin-top'] = '32px';
  const introduction = h.sec([h.box([
    h.text('About Linden Dental', 'eyebrow', 'p', { color: h.color.primary, 'letter-spacing': '.1em', 'text-transform': 'uppercase' }),
    h.text('A welcoming place for everyday care.', 'title', 'h2', { 'margin-top': '12px' }),
    h.text('Linden Dental is a friendly, family-focused practice with a thoughtful approach to everyday dental care. We make space to listen, explain your options and understand what matters to you.', 'lead', 'p', { 'margin-top': '16px', 'max-width': '1000px' }),
    h.text('Whether you are coming in for routine care or want to discuss a concern, the conversation starts with your needs and questions.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '1000px' }),
    photo
  ], { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto' })], { 'background-color': '#FFFFFF' });
  about.name = 'About';
  about.slug = 'about';
  about.title = 'About | Linden Dental';
  about.desc = 'Learn about Linden Dental and its approach to care.';
  about.tree.splice(1, 0, introduction);

  const replacements: Record<string, [string, string]> = {
    'dental-a2-528': ['Ask about a visit', 'contact.html'],
    'dental-a2-524': ['View common questions', '#home-faq'],
    'dental-a2-200': ['Explore treatments', 'treatments.html'],
    'dental-a2-568': ['Ask about a visit', 'contact.html'],
    'dental-a2-661': ['Get in touch', 'contact.html'],
    'dental-a2-384': ['Visit guidance', 'index.html#visit-guidance']
  };
  function update(nodes: Node[]) {
    for (const n of nodes) {
      if (n.id === 'dental-a2-641') n.css.d['background-color'] = '#FFFFFF';
      if (n.id === 'dental-a2-638') n.css.d['background-color'] = '#F4F7F8';
      if (n.id === 'dental-a2-189') n.adv.htmlId = 'visit-guidance';
      if (n.id === 'dental-a2-207') n.adv.htmlId = 'home-faq';
      if (n.type === 'heading') {
        if (n.props.text === 'Care team') n.props.text = 'About';
        if (n.props.text === 'Get ready for your first visit.') n.props.text = 'Let’s talk about your care.';
        if (n.props.text === 'Learn what you may want to ask or share before speaking with the team.') n.props.text = 'Share your questions with the team and start a conversation about your care.';
      }
      if (n.type === 'button') {
        const replacement = replacements[n.id];
        if (replacement) [n.props.text, n.props.link] = replacement;
        if (n.props.link === 'care-team.html') n.props.link = 'about.html';
        if (n.props.text === 'Our team') n.props.text = 'About';
      }
      if (n.type === 'nav' && n.props.items) {
        n.props.items = n.props.items.filter(item => !['first-visit.html', 'patient-information.html'].includes(item.href));
        for (const item of n.props.items) if (item.href === 'care-team.html') { item.href = 'about.html'; item.label = 'About'; }
      }
      if (n.id === 'dental-a2-14') {
        n.children = n.children.filter(child => child.id !== 'dental-a2-11' && child.id !== 'dental-a2-12');
        n.css.d['grid-template-columns'] = 'repeat(3, auto)';
      }
      update(n.children);
    }
  }
  const retained = pages.filter(page => !['dental-first-visit', 'dental-patient-information'].includes(page.id));
  update(header); update(footer);
  for (const page of retained) update(page.tree);
  return retained;
}
