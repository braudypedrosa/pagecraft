import type { Doc, Node } from '../../../app/src/core/types.ts';
import { buildTemplateDocument as predecessor } from '../1.0.0/source.ts';

/** Preserve the coastal composition while correcting contrast, wrapping, and setup guidance. */
export function buildTemplateDocument(): Doc {
  const document = predecessor();
  const coast = document.pages.find(page => page.slug === 'coast');
  if (!coast) throw new Error('Salt House Coast page is missing');
  let coastShadeFound = false;
  let homeHeadingFound = false;
  let homeLayoutFound = false;
  let inquiryCopyFound = false;
  let inquiryFaqFound = false;
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.id === 'salt-photo-shade-180') {
        node.css.d.opacity = '.65';
        coastShadeFound = true;
      }
      if (node.id === 'salt-text-54') {
        node.css.d['max-width'] = '100%';
        node.css.t['max-width'] = '100%';
        homeHeadingFound = true;
      }
      if (node.id === 'salt-welcome-and-homes-59') {
        node.css.t['grid-template-columns'] = '1fr 1.25fr';
        node.css.t.gap = '40px';
        homeLayoutFound = true;
      }
      if (node.id === 'salt-text-224') {
        node.props.text = 'Before customer use, verify the inquiry destination and complete a receipt test in the active host.';
        inquiryCopyFound = true;
      }
      if (node.id === 'salt-stay-questions-208') {
        const items = node.props.items as Array<{ q?: string; a?: string }> | undefined;
        const inquiry = items?.find(item => item.q === 'Can I send an inquiry here?');
        if (inquiry) {
          inquiry.a = 'Before customer use, verify the inquiry destination and complete a receipt test in the active host.';
          inquiryFaqFound = true;
        }
      }
      walk(node.children || []);
    }
  };
  for (const page of document.pages) walk(page.tree);
  if (!coastShadeFound) throw new Error('Salt House Coast photo shade is missing');
  if (!homeHeadingFound) throw new Error('Salt House Home heading is missing');
  if (!homeLayoutFound) throw new Error('Salt House Home layout is missing');
  if (!inquiryCopyFound) throw new Error('Salt House inquiry setup copy is missing');
  if (!inquiryFaqFound) throw new Error('Salt House inquiry FAQ is missing');
  return document;
}
