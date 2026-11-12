import type { Node, Page } from '../../../app/src/core/types.ts';
import type { DentalHelpers } from './expanded-types.ts';

const max = { 'max-width': '1120px', margin: '0 auto' };

function sectionTitle(h: DentalHelpers, eyebrow: string, title: string, copy: string) {
  return h.box([
    h.text(eyebrow, 'eyebrow', 'p', { color: h.color.primary, 'letter-spacing': '.1em', 'text-transform': 'uppercase' }),
    h.text(title, 'title', 'h2', { 'margin-top': '12px', 'max-width': '850px' }),
    h.text(copy, 'lead', 'p', { 'margin-top': '14px', 'max-width': '68ch' })
  ], { 'max-width': '1120px', margin: '0 auto' });
}

function innerSection(h: DentalHelpers, children: Node[], desktop: Record<string, string> = {}, mobile: Record<string, string> = {}, tablet: Record<string, string> = {}) {
  return h.sec([h.box(children, { 'max-width': '1120px', margin: '0 auto' })], desktop, mobile, tablet);
}

function copyGroup(h: DentalHelpers, title: string, copy: string) {
  return h.box([
    h.text(title, 'subtitle', 'h3'),
    h.text(copy, 'body', 'p', { 'margin-top': '10px', 'max-width': '52ch' })
  ], { display: 'flex', 'flex-direction': 'column' });
}

function nativeFaq(h: DentalHelpers, items: { q: string; a: string }[]) {
  return h.node('accordion', {
    items,
    open: 'none',
    single: 1,
    marker: 'plus'
  }, {
    width: '100%',
    '--ac-line': h.color.line,
    '--ac-pad': '20px',
    '--ac-gap': '0px',
    '--ac-q-size': '18px',
    '--ac-q-weight': '600',
    '--ac-q-color': h.color.ink,
    '--ac-a-size': '16px',
    '--ac-a-color': h.color.ink,
    '--ac-mark': h.color.primary,
    '--ac-radius': '0px'
  }, [], { '--ac-pad': '16px', '--ac-q-size': '17px' });
}

function treatmentSections(h: DentalHelpers): Node[] {
  const preventive = innerSection(h, [
    sectionTitle(h, 'Preventive care', 'Support for your everyday oral health.', 'Preventive care can help you understand your oral health and make informed choices about looking after it.'),
    h.box([
      copyGroup(h, 'Keep questions in the conversation', 'Ask what a check-up or hygiene visit may involve for you. Your dental team can explain its recommendations and answer questions in plain language.'),
      copyGroup(h, 'Build a routine that fits', 'Share what is easy or difficult to keep up with day to day. Guidance can be discussed in light of your needs and the details you share.')
    ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '44px', 'margin-top': '36px' }, { 'grid-template-columns': '1fr', gap: '28px', 'margin-top': '26px' })
  ], { 'background-color': h.color.ice });

  const restorative = innerSection(h, [
    h.box([
      h.text('Restorative care', 'eyebrow', 'p', { color: h.color.primary, 'letter-spacing': '.1em', 'text-transform': 'uppercase' }),
      h.text('Understand the options before deciding.', 'title', 'h2', { 'margin-top': '12px', 'max-width': '780px' }),
      h.text('If a tooth needs attention, ask the team to explain the options it considers relevant to your situation. The right conversation depends on your needs and an individual assessment.', 'lead', 'p', { 'margin-top': '16px', 'max-width': '70ch' }),
      h.box([
        copyGroup(h, 'What is the concern?', 'Ask what the team has noticed and what it means for your oral health.'),
        copyGroup(h, 'What could I consider?', 'Invite an explanation of possible approaches, including what is known and what remains uncertain.'),
        copyGroup(h, 'What should I decide now?', 'You can ask for time to think, clarification, or a discussion of the next step before making a choice.')
      ], { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '28px', 'margin-top': '34px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '24px' })
    ], max)
  ]);

  const planning = innerSection(h, [
    sectionTitle(h, 'Planning together', 'Make space for the questions that matter to you.', 'A treatment plan is easier to understand when you can ask about choices, timing and fees before deciding how to proceed.'),
    h.box([nativeFaq(h, [
      { q: 'How do I know which option is right for me?', a: 'Ask the dental team to explain the options it considers relevant to your needs, along with the reasons, trade-offs and any uncertainties. You can ask questions before deciding.' },
      { q: 'Can I ask about fees before treatment?', a: 'Yes. Ask the practice for current fees and any payment information that applies. Details vary, so confirm them directly before making a decision.' },
      { q: 'What if I need more time to think?', a: 'Let the team know. You can ask for a clearer explanation or time to consider the information before discussing next steps.' }
    ])], { 'margin-top': '30px', 'max-width': '940px' })
  ]);

  const next = innerSection(h, [
    h.box([
      h.text('Start with a conversation.', 'title', 'h2'),
      h.text('Share what you would like help with and the practice can guide you on how to ask about care options.', 'lead', 'p', { 'margin-top': '12px', 'max-width': '66ch' }),
      h.box([h.button('Contact the practice', 'contact.html')], { 'margin-top': '22px' })
    ], max)
  ], { 'background-color': h.color.ice });

  return [preventive, restorative, planning, next];
}

function teamSections(h: DentalHelpers): Node[] {
  const approach = innerSection(h, [
    h.box([
      h.text('How we work with you', 'eyebrow', 'p', { color: h.color.primary, 'letter-spacing': '.1em', 'text-transform': 'uppercase' }),
      h.text('Care starts with listening.', 'title', 'h2', { 'margin-top': '12px', 'max-width': '780px' }),
      h.text('Your questions, concerns and priorities help shape the conversation. The team can explain what it knows, what it recommends and where you may want more information.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '70ch' }),
      h.box([
        copyGroup(h, 'Talk through what matters', 'Share what has brought you in and what you hope to understand. You can ask the team to pause or explain something another way.'),
        copyGroup(h, 'Understand your choices', 'Ask about the reasons for a recommendation, any alternatives to discuss and what questions remain for you.')
      ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '44px', 'margin-top': '34px' }, { 'grid-template-columns': '1fr', gap: '26px', 'margin-top': '24px' })
    ], max)
  ], { 'background-color': h.color.ice });

  const prepare = innerSection(h, [
    h.box([
      h.text('Bring your perspective', 'title', 'h2'),
      h.text('A few points can help you make the most of a conversation with the team. There is no need to have everything figured out beforehand.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '64ch' }),
      h.points([
        ['What you would like help with', 'Describe your concerns or the questions you most want answered.'],
        ['What would help you feel comfortable', 'Tell the practice about any communication or accessibility needs you want it to know about.'],
        ['What you want to understand', 'Ask the team to explain recommendations, options or next steps in a way that is clear to you.']
      ])
    ], { 'max-width': '880px', margin: '0 auto' })
  ]);

  const next = innerSection(h, [
    h.box([
      h.text('Get ready for your first visit.', 'title', 'h2'),
      h.text('Learn what you may want to ask or share before speaking with the team.', 'lead', 'p', { 'margin-top': '12px', 'max-width': '62ch' }),
      h.box([h.button('Your first visit', 'first-visit.html')], { 'margin-top': '22px' })
    ], max)
  ], { 'background-color': h.color.ice });

  return [approach, prepare, next];
}

function firstVisitSections(h: DentalHelpers): Node[] {
  const before = innerSection(h, [
    sectionTitle(h, 'Before your visit', 'A little preparation can make room for good questions.', 'You do not need to know exactly what to ask. Start with what is on your mind, and let the practice know about anything that could help the visit feel more comfortable.'),
    h.box([
      copyGroup(h, 'Note your questions', 'Write down anything you would like the team to explain, even if it feels small.'),
      copyGroup(h, 'Share useful context', 'Tell the practice what brings you in and mention any comfort or accessibility needs you want it to consider.'),
      copyGroup(h, 'Check practical details', 'Ask the practice what to bring and confirm current fees or other arrangements directly.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '30px', 'margin-top': '34px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '24px' })
  ], { 'background-color': h.color.ice });

  const during = innerSection(h, [
    h.box([
      h.text('At your appointment', 'eyebrow', 'p', { color: h.color.primary, 'letter-spacing': '.1em', 'text-transform': 'uppercase' }),
      h.text('You can ask as you go.', 'title', 'h2', { 'margin-top': '12px' }),
      h.text('Let the team know what you are concerned about and what you would like to understand. You can ask for an explanation before moving to a new part of the conversation.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '68ch' }),
      h.box([
        copyGroup(h, 'Share your concerns', 'Tell the team what feels important to you and ask it to explain anything that is unclear.'),
        copyGroup(h, 'Discuss possible next steps', 'If the team raises options, ask what they involve and what questions you may want to consider.')
      ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '42px', 'margin-top': '32px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '22px' })
    ], max)
  ]);

  const after = innerSection(h, [
    sectionTitle(h, 'After your visit', 'Leave knowing what you want to clarify next.', 'Before you go, ask the team to recap anything you would like to remember. If questions come up later, contact the practice to ask how best to follow up.'),
    h.box([
      copyGroup(h, 'Review what you discussed', 'Ask for a plain-language summary of recommendations or next steps that were explained.'),
      copyGroup(h, 'Take time with decisions', 'If you need more information or time to consider an option, tell the team and ask what to do next.')
    ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '42px', 'margin-top': '30px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '22px' }),
    h.box([h.button('Request a visit', 'contact.html')], { 'margin-top': '26px' })
  ], { 'background-color': h.color.ice });

  return [before, during, after];
}

function patientInfoSections(h: DentalHelpers): Node[] {
  const checklist = innerSection(h, [
    sectionTitle(h, 'Planning your visit', 'Check practical details before your visit.', 'Ask us about fees, access and what to bring before you visit.'),
    h.box([
      copyGroup(h, 'Fees and payment questions', 'Ask which fees may apply and what payment information the practice can share before you decide how to proceed.'),
      copyGroup(h, 'Access and comfort', 'Contact the practice in advance to discuss any accessibility, communication or comfort needs you would like it to consider.'),
      copyGroup(h, 'What to bring', 'Check directly with the practice if you are unsure what information or items would be useful for your visit.')
    ], { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '28px', 'margin-top': '32px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '22px' })
  ], { 'background-color': h.color.ice });

  const faq = innerSection(h, [
    sectionTitle(h, 'Common questions', 'Questions to help you prepare.', 'Fees, access and everyday care can bring up questions.'),
    h.box([nativeFaq(h, [
      { q: 'How can I ask about fees?', a: 'Contact the practice to ask for current fees and any payment information that may apply. Confirm details for your own circumstances before making a decision.' },
      { q: 'Can I discuss access or comfort needs in advance?', a: 'Yes. Let the practice know what would help you communicate or feel more comfortable, and ask what arrangements it can offer.' },
      { q: 'What should I know about everyday oral care?', a: 'Ask the team about brushing, flossing or products you would like to understand better.' },
      { q: 'Can I ask the team to explain something in plain language?', a: 'Yes. You can ask for a clearer explanation of a recommendation, an unfamiliar term or a possible next step.' }
    ])], { 'margin-top': '30px', 'max-width': '940px' })
  ]);

  const next = innerSection(h, [
    h.box([
      h.text('Still have a question?', 'title', 'h2'),
      h.text('Contact the practice with a general question about preparing for a visit. Share only what is needed to start a conversation, and avoid including sensitive health details.', 'lead', 'p', { 'margin-top': '12px', 'max-width': '68ch' }),
      h.box([h.button('Contact the practice', 'contact.html')], { 'margin-top': '22px' })
    ], max)
  ], { 'background-color': h.color.ice });

  return [checklist, faq, next];
}

function contactSections(h: DentalHelpers): Node[] {
  const guidance = innerSection(h, [
    h.box([
      h.text('A useful message can stay simple.', 'title', 'h2'),
      h.text('A short message can explain what you would like help with or ask the practice to contact you about. Keep details general and avoid including sensitive health information.', 'lead', 'p', { 'margin-top': '14px', 'max-width': '72ch' }),
      h.box([
        copyGroup(h, 'Your question', 'Say what kind of information or help you need. Keep it brief.'),
        copyGroup(h, 'Comfort and communication', 'If you would like to discuss access or communication needs, mention this generally and ask how to share further details privately.')
      ], { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '42px', 'margin-top': '30px' }, { 'grid-template-columns': '1fr', gap: '24px', 'margin-top': '22px' })
    ], max)
  ], { 'background-color': h.color.ice });

  const preparation = innerSection(h, [
    h.box([
      h.text('Preparing for a visit?', 'subtitle', 'h2'),
      h.text('Read what you may want to ask or share before speaking with the team.', 'body', 'p', { 'margin-top': '10px', 'max-width': '58ch' }),
      h.box([h.button('Your first visit', 'first-visit.html')], { 'margin-top': '18px' })
    ], max)
  ]);

  return [guidance, preparation];
}

/** Expand the five original inner pages while retaining their approved intros and imagery. */
export function expandInnerPages(h: DentalHelpers, originals: Page[]): Page[] {
  const bySlug = new Map(originals.map(page => [page.slug, page]));
  const expanded = new Map<string, Node[]>();

  const treatments = bySlug.get('treatments');
  if (treatments) expanded.set('treatments', [...treatments.tree.slice(0, 2), ...treatmentSections(h)]);

  const team = bySlug.get('care-team');
  if (team) expanded.set('care-team', [...team.tree.slice(0, 2), ...teamSections(h)]);

  const firstVisit = bySlug.get('first-visit');
  if (firstVisit) expanded.set('first-visit', [...firstVisit.tree.slice(0, 2), ...firstVisitSections(h)]);

  const patient = bySlug.get('patient-information');
  if (patient) expanded.set('patient-information', [...patient.tree, ...patientInfoSections(h)]);

  const contact = bySlug.get('contact');
  if (contact) expanded.set('contact', [...contact.tree, ...contactSections(h)]);

  return originals.map(page => {
    const tree = expanded.get(page.slug);
    return tree ? { ...page, tree } : page;
  });
}
