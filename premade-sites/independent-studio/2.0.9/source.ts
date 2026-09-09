import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { findNodes, hasNodeClass } from '../../lib/v1/design-contract.ts';
import { assertPremadeDesignContractV2 } from '../../lib/v2/design-contract.ts';
import { buildIndependentStudioDocument as buildV208 } from '../2.0.8/source.ts';

const removeNodeClass = (node: Node, className: string) => {
  const classes = String(node.adv?.cls || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(candidate => candidate !== className);
  node.adv = { ...(node.adv || {}), cls: classes.join(' ') };
};

const setCss = (node: Node, breakpoint: 'd' | 't' | 'm', declarations: Record<string, string>) => {
  node.css ||= { d: {}, t: {}, m: {} };
  node.css[breakpoint] = { ...(node.css[breakpoint] || {}), ...declarations };
};

/**
 * Sticky behavior belongs to Pagecraft's responsive style model. Keeping it in
 * template-only CSS made the layout work but left the builder showing Static.
 */
export function buildIndependentStudioDocument(): Doc {
  const document = buildV208();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const sticky = findNodes(home.tree, node => hasNodeClass(node, 'nl-sticky'))[0];
  if (!sticky) throw new Error('Independent Studio timeline introduction is missing');

  removeNodeClass(sticky, 'nl-sticky');
  setCss(sticky, 'd', { position: 'sticky', top: '104px' });
  setCss(sticky, 't', { position: 'sticky', top: '104px' });
  setCss(sticky, 'm', { position: 'static', top: '0px' });

  document.meta.css = document.meta.css
    .replace('.nl-sticky{position:sticky;top:128px}\n', '')
    .replace('  .nl-sticky{position:static}\n', '');

  assertPremadeDesignContractV2(document);
  return document;
}
