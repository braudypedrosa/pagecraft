import type { Doc, Node } from '../../../app/src/core/types.ts';
import { buildTemplateDocument as buildV104 } from '../1.0.4/source.ts';

const walk = (nodes: Node[], visit: (node: Node) => void) => {
  for (const node of nodes) {
    visit(node);
    walk(node.children || [], visit);
  }
};

/**
 * Successor to 1.0.4 for accessibility and honest host-specific form guidance.
 * Composition, assets, identities and native Pagecraft controls remain unchanged.
 */
export function buildTemplateDocument(): Doc {
  const document = buildV104();
  const muted = document.meta.tokens?.colors.find(color => color.id === 'muted');
  if (!muted) throw new Error('Marea muted color token is missing');
  muted.value = '#606a64';

  const stays = document.pages.find(page => page.slug === 'stays');
  if (!stays) throw new Error('Marea Stays page is missing');

  const expectedCardHeadings = new Set([
    'Stone Cove House',
    'Pine Court House',
    'Harbor Studio',
    'Garden Casita',
  ]);
  let eagerHeroFound = false;
  let cardHeadingCount = 0;
  walk(stays.tree, node => {
    if (node.id === 'marea-node-0089' && node.type === 'image') {
      node.props.lazy = 0;
      eagerHeroFound = true;
    }
    if (node.type === 'heading' && expectedCardHeadings.has(String(node.props.text))) {
      node.props.level = 'h2';
      cardHeadingCount += 1;
    }
  });

  if (!eagerHeroFound) throw new Error('Marea Stays opening image is missing');
  if (cardHeadingCount !== expectedCardHeadings.size) {
    throw new Error(`Marea Stays expected ${expectedCardHeadings.size} card headings; found ${cardHeadingCount}`);
  }
  const contact = document.pages.find(page => page.slug === 'contact');
  if (!contact) throw new Error('Marea Contact page is missing');
  let setupCount = 0;
  walk(contact.tree, node => {
    if (node.type !== 'text') return;
    const html = String(node.props.html || '');
    if (html.includes('This sample form is ready to connect')) {
      node.props.html = '<p>Ask about a home, a date range, or the practical detail that will help you choose. Before accepting real inquiries, check this form’s destination and verify a test receipt.</p>';
      setupCount += 1;
    }
    if (html.includes('Connect the form to the approved endpoint')) {
      node.props.html = '<p>Check the form’s submission destination, replace the sample email, add your verified response window, and test receipt on the host where you publish. An inquiry does not confirm availability or a reservation.</p>';
      setupCount += 1;
    }
  });
  if (setupCount !== 2) throw new Error('Marea form guidance correction target is missing');
  return document;
}
