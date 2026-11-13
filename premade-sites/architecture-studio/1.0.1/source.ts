import type { Doc, Node } from '../../../app/src/core/types.ts';
import { buildTemplateDocument as predecessor } from '../1.0.0/source.ts';

/** Preserve Common Ground while improving tablet wrapping and portable form guidance. */
export function buildTemplateDocument(): Doc {
  const document = predecessor();
  let headingFound = false;
  let setupFound = false;
  const walk = (nodes: Node[], home: boolean) => {
    for (const node of nodes) {
      if (home && node.type === 'heading' && node.props.level === 'h1') {
        node.css.t['font-size'] = '36px';
        headingFound = true;
      }
      if (node.type === 'text' && String(node.props.html).includes('This demonstration form is not connected')) {
        node.props.html = '<p>Before accepting real inquiries, check where this form sends submissions and verify a test receipt. Configure the receiving service for the host where you publish this site.</p>';
        setupFound = true;
      }
      walk(node.children || [], home);
    }
  };
  for (const page of document.pages) walk(page.tree, page.slug === 'index');
  if (!headingFound || !setupFound) throw new Error('Common Ground usability correction target is missing');
  return document;
}
