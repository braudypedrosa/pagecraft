import type { Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers, DentalStyle } from './expanded-types.ts';

/** Apply the approved Contact body layouts while retaining their native nodes. */
export function refineContact(h: DentalHelpers, pages: Page[]): void {
  const contact = pages.find(page => page.slug === 'contact');
  if (!contact) throw new Error('Contact page is missing');
  const [enquiry, guidance, closing] = contact.tree.slice(1);
  if (enquiry.id !== 'dental-a2-135' || guidance.id !== 'dental-a2-381' || closing.id !== 'dental-a2-388') throw new Error('Unexpected Contact sections');
  const pad = (vertical: string, horizontal: string): DentalStyle => ({ 'padding-top': vertical, 'padding-right': horizontal, 'padding-bottom': vertical, 'padding-left': horizontal });
  const enquiryContent = enquiry.children[0];
  const [heading, lead, formPanel] = enquiryContent.children;
  if (heading.id !== 'dental-a2-131' || lead.id !== 'dental-a2-132' || formPanel.id !== 'dental-a2-133' || formPanel.children[0]?.id !== 'dental-a2-125') throw new Error('Unexpected enquiry structure');
  enquiryContent.css.d['max-width'] = '1320px';
  if (lead.type !== 'heading') throw new Error('Unexpected enquiry lead');
  lead.props.ts = 'lead';
  Object.assign(formPanel.css.d, { 'margin-top': '0', 'max-width': 'none', 'background-color': '#F4F7F8', 'border-radius': '12px', ...pad('36px', '36px') });
  Object.assign(formPanel.css.t, pad('28px', '28px'));
  Object.assign(formPanel.css.m, pad('24px', '22px'));
  const photo = h.image('welcoming-reception', 'A welcoming dental practice reception', '100%', '280px');
  photo.props.w = 1672; photo.props.h = 941;
  Object.assign(photo.css.d, { height: '100%', 'min-height': '100%', 'object-position': 'center center' });
  Object.assign(photo.css.m, { height: '280px', 'min-height': '0' });
  const enquiryGrid = h.box([photo, formPanel], { display: 'grid', 'grid-template-columns': '42fr 58fr', gap: '32px', 'align-items': 'stretch', 'margin-top': '32px' }, { 'grid-template-columns': '1fr', gap: '20px', 'margin-top': '26px' }, { gap: '24px' });
  enquiryContent.children = [heading, lead, enquiryGrid];
  enquiry.css.d['background-color'] = h.color.white;

  guidance.css.d['background-color'] = h.color.white;
  const guidanceContent = guidance.children[0];
  const guidanceInner = guidanceContent.children[0];
  const guidanceGrid = guidanceInner.children[2];
  if (guidanceGrid.id !== 'dental-a2-378') throw new Error('Unexpected guidance structure');
  guidanceContent.css.d['max-width'] = '1320px';
  guidanceInner.css.d['max-width'] = '1320px';
  guidanceGrid.css.d.gap = '48px';
  guidanceGrid.css.d['margin-top'] = '36px';
  for (const group of guidanceGrid.children) Object.assign(group.css.d, { 'border-top': '1px solid #AFCBD8', 'padding-top': '24px' });

  const closingPanel = closing.children[0];
  const closingContent = closingPanel.children[0];
  const [closingHeading, closingLead, action] = closingContent.children;
  const button = action.children[0];
  if (closingHeading.type !== 'heading' || closingLead.type !== 'heading' || button.type !== 'button' || button.id !== 'dental-a2-384') throw new Error('Unexpected closing structure');
  closing.css.d['background-color'] = h.color.white;
  Object.assign(closingPanel.css.d, { 'max-width': '1320px', position: 'relative', overflow: 'hidden', 'border-radius': '12px', 'background-color': h.color.ink, 'background-image': 'url("asset:cta-clinic-entrance")', 'background-size': 'cover', 'background-position': 'center center', 'background-repeat': 'no-repeat' });
  const overlay = h.box([], { position: 'absolute', inset: '0', 'background-color': h.color.ink, opacity: '.8', 'pointer-events': 'none' });
  closingPanel.children = [overlay, closingContent];
  Object.assign(closingContent.css.d, { position: 'relative', 'z-index': '1', 'max-width': 'none', ...pad('80px', '64px') });
  Object.assign(closingContent.css.t, pad('60px', '40px'));
  Object.assign(closingContent.css.m, pad('48px', '24px'));
  closingHeading.props.ts = 'title'; closingHeading.css.d.color = h.color.white;
  closingLead.props.ts = 'lead'; Object.assign(closingLead.css.d, { color: h.color.white, 'margin-top': '16px', 'max-width': '50ch' });
  action.css.d['margin-top'] = '28px';
  Object.assign(button.css.d, { 'background-color': h.color.white, color: h.color.ink });
}
