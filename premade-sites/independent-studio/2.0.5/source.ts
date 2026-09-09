import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV204 } from '../2.0.4/source.ts';

const children = (node: Node | undefined) => node?.children || [];

const set = (
  node: Node | undefined,
  breakpoint: 'd' | 't' | 'm',
  declarations: Record<string, string>,
) => {
  if (!node) return;
  node.css ||= { d: {}, t: {}, m: {} };
  node.css[breakpoint] = { ...(node.css[breakpoint] || {}), ...declarations };
};

export function buildIndependentStudioDocument(): Doc {
  const document = buildV204();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const disciplinesSection = home.tree[1];
  const introRow = children(disciplinesSection)[0];
  const contentColumn = children(introRow)[1];
  const [sectionHeading, sectionCopy] = children(contentColumn);

  // Keep the heading and its explanation as one reading group. The former
  // eyebrow occupied a disconnected grid column and weakened proximity.
  introRow.children = contentColumn ? [contentColumn] : [];
  set(introRow, 'd', {
    gap: '0',
    'justify-content': 'flex-start',
  });
  set(introRow, 'm', { gap: '0' });

  if (contentColumn) {
    contentColumn.adv = {
      ...(contentColumn.adv || {}),
      cls: [contentColumn.adv?.cls, 'nl-disciplines-intro']
        .filter(Boolean)
        .join(' '),
    };
  }
  set(contentColumn, 'd', {
    'flex-grow': '0',
    'flex-basis': 'auto',
    width: '100%',
    'max-width': '790px',
  });
  set(contentColumn, 'm', {
    'flex-basis': '100%',
    width: '100%',
    'max-width': '100%',
  });
  set(sectionHeading, 'd', { 'max-width': '18ch' });
  set(sectionHeading, 'm', { 'max-width': '15ch' });
  set(sectionCopy, 'd', {
    'max-width': '49ch',
    'margin-top': '22px',
  });
  set(sectionCopy, 'm', { 'margin-top': '18px' });

  return document;
}
