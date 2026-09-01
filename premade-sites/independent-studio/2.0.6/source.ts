import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV205 } from '../2.0.5/source.ts';

const children = (node: Node | undefined) => node?.children || [];
const hasClass = (node: Node, cls: string) => String(node.adv?.cls || '')
  .split(/\s+/)
  .filter(Boolean)
  .includes(cls);

const findAll = (nodes: Node[], predicate: (node: Node) => boolean): Node[] => {
  const matches: Node[] = [];
  for (const node of nodes) {
    if (predicate(node)) matches.push(node);
    matches.push(...findAll(children(node), predicate));
  }
  return matches;
};

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
  const document = buildV205();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const servicePanels = findAll(home.tree, node => hasClass(node, 'nl-service-panel'));

  for (const panel of servicePanels) {
    const media = children(panel).find(node => node.type === 'image');
    for (const breakpoint of ['d', 't', 'm'] as const) {
      set(panel, breakpoint, {
        'border-radius': '12px',
        overflow: 'hidden',
      });
      set(media, breakpoint, {
        'border-radius': '0',
        'border-width': '0',
      });
    }
  }

  return document;
}
