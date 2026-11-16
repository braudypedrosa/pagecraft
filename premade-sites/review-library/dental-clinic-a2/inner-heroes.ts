import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers, DentalStyle } from './expanded-types.ts';

/** Apply the approved shared inner-page hero without rebuilding body sections. */
export function refineInnerHeroes(h: DentalHelpers, pages: Page[]): void {
  const treatments = pages.find(page => page.slug === 'treatments');
  const about = pages.find(page => page.slug === 'about');
  const contact = pages.find(page => page.slug === 'contact');
  if (!treatments || !about || !contact) throw new Error('Inner pages are missing');
  const treatmentHero = treatments.tree[0];
  const aboutHero = about.tree[0];
  const contactHero = contact.tree[0];
  const treatmentContent = treatmentHero.children[2]?.children[0];
  const aboutContent = aboutHero.children[0];
  const contactContent = contactHero.children[0];
  if (!treatmentContent || !aboutContent || !contactContent) throw new Error('Unexpected hero structure');
  const topicLinks = treatmentContent.children.pop();
  if (!topicLinks || topicLinks.id !== 'dental-a2-544') throw new Error('Treatments topic links are missing');
  treatmentHero.children = [treatmentContent];
  const enquiry = h.box([h.button('Make an enquiry', '#contact-enquiry', true)], { 'margin-top': '28px' });
  contactContent.children.push(enquiry);
  const formSection = contact.tree.find(section => section.id === 'dental-a2-135');
  if (!formSection) throw new Error('Contact form section is missing');
  formSection.adv.htmlId = 'contact-enquiry';

  const copyCss = (target: Node, source: Node) => { target.css = structuredClone(source.css); };
  const [aboutLabel, aboutTitle, aboutLead, aboutAction] = aboutContent.children;
  const referenceButton = aboutAction.children[0];
  const commonContent = (content: Node) => {
    const [label, title, lead, action] = content.children;
    copyCss(label, aboutLabel); copyCss(title, aboutTitle); copyCss(lead, aboutLead); copyCss(action, aboutAction);
    copyCss(action.children[0], referenceButton);
    Object.assign(content.css.d, { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-left': '18px' });
    content.css.m['padding-left'] = '14px';
    Object.assign(title.css.d, { 'min-height': '67px' });
    Object.assign(title.css.t, { 'min-height': '54px' });
    Object.assign(title.css.m, { 'min-height': '82px' });
    Object.assign(lead.css.d, { 'min-height': '60px', 'max-width': '65ch' });
    Object.assign(lead.css.t, { 'min-height': '57px' });
    Object.assign(lead.css.m, { 'min-height': '108px' });
  };
  // Snapshot the approved About styling before applying shared slot dimensions.
  const sectionCss = structuredClone(aboutHero.css);
  for (const [hero, content] of [[treatmentHero, treatmentContent], [contactHero, contactContent], [aboutHero, aboutContent]]) {
    hero.css = structuredClone(sectionCss);
    Object.assign(hero.css.d, { 'min-height': '440px' });
    Object.assign(hero.css.t, { 'min-height': '380px' });
    Object.assign(hero.css.m, { 'min-height': '0' });
    commonContent(content);
  }
  topicLinks.css.d['margin-top'] = '0';
  const pad = (vertical: string, horizontal: string): DentalStyle => ({ 'padding-top': vertical, 'padding-right': horizontal, 'padding-bottom': vertical, 'padding-left': horizontal });
  const linksContent = h.box([topicLinks], { 'max-width': '1320px', 'margin-left': 'auto', 'margin-right': 'auto', 'padding-left': '18px' }, { 'padding-left': '14px' });
  const linksSection = h.sec([linksContent], { 'background-color': h.color.white, ...pad('12px', '56px') }, { ...pad('10px', '22px') }, { ...pad('10px', '32px') });
  treatments.tree.splice(1, 0, linksSection);
}
