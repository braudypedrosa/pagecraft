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

  // Keep the existing profile nodes and append new nodes only after all base pages exist.
  const profileGrid = about.tree[2].children[0].children[2];
  const [maya, daniel] = profileGrid.children;
  const role = (copy: string) => h.text(copy, 'body', 'p', { color: h.color.primary, 'font-weight': '600', 'margin-top': '4px' });
  const existingRoles = [role('General Dentistry'), role('Restorative Dentistry')];
  const setPhotoStyle = (image: Node) => {
    Object.assign(image.css.d, { width: '100%', height: '520px', 'object-fit': 'cover', 'object-position': '50% 10%', 'border-radius': '12px' });
    Object.assign(image.css.t, { height: '520px' });
    Object.assign(image.css.m, { height: '420px' });
  };
  const existing = [
    [maya, 'Dr Maya Bennett', 'Everyday dental care, with clear explanations at each step.'],
    [daniel, 'Dr Daniel Reed', 'Helping patients understand options for damaged teeth.']
  ] as const;
  for (let i = 0; i < existing.length; i++) {
    const [card, name, bio] = existing[i];
    const [image, copy] = card.children;
    const [heading, description] = copy.children;
    if (image.type !== 'image' || heading.type !== 'heading' || description.type !== 'heading') throw new Error('Unexpected profile structure');
    image.props.alt = name;
    setPhotoStyle(image);
    heading.props.text = name;
    heading.css.d['margin-top'] = '12px';
    description.props.text = bio;
    description.css.d['margin-top'] = '8px';
    copy.children.splice(1, 0, existingRoles[i]);
    if (card.type !== 'box') throw new Error('Unexpected profile container');
    card.props.layout = 'block';
    for (const key of ['grid-template-columns', 'gap', 'align-items']) delete card.css.d[key];
    for (const key of ['grid-template-columns', 'gap']) delete card.css.m[key];
    Object.assign(card.css.d, { display: 'block', 'background-color': h.color.white, 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' });
    Object.assign(card.css.m, { 'padding-top': '0', 'padding-right': '0', 'padding-bottom': '0', 'padding-left': '0' });
  }
  const additions: [string, string, string, string][] = [
    ['care-team-aisha-khan', 'Dr Aisha Khan', "Children's Dentistry", 'A calm, encouraging approach for younger patients.'],
    ['care-team-oliver-chen', 'Dr Oliver Chen', 'Orthodontics', 'Clear conversations about tooth alignment and care options.'],
    ['care-team-naomi-brooks', 'Dr Naomi Brooks', 'Endodontics', 'Thoughtful care discussions for teeth needing closer attention.'],
    ['care-team-elena-cruz', 'Dr Elena Cruz', 'Periodontics', 'Helping patients understand gum health and ongoing care.']
  ];
  for (const [asset, name, specialty, bio] of additions) {
    const image = h.image(asset, name, '300px', '300px');
    image.props.w = 1122; image.props.h = 1402;
    setPhotoStyle(image);
    profileGrid.children.push(h.box([
      image,
      h.text(name, 'subtitle', 'h3', { 'margin-top': '12px' }),
      role(specialty),
      h.text(bio, 'body', 'p', { 'margin-top': '8px' })
    ]));
  }
  Object.assign(profileGrid.css.d, { 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '36px 28px' });
  Object.assign(profileGrid.css.t, { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '36px 28px' });
  Object.assign(profileGrid.css.m, { 'grid-template-columns': '1fr', gap: '28px' });

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
      if (n.id === 'dental-a2-1') { n.css.d['margin-left'] = 'auto'; n.css.t['margin-left'] = '0'; }
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
