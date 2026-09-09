import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV203 } from '../2.0.3/source.ts';

const children = (node: Node) => node.children || [];
const hasClass = (node: Node, cls: string) => String(node.adv?.cls || '')
  .split(/\s+/)
  .filter(Boolean)
  .includes(cls);

const find = (nodes: Node[], predicate: (node: Node) => boolean): Node | undefined => {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const nested = find(children(node), predicate);
    if (nested) return nested;
  }
  return undefined;
};

const findAll = (nodes: Node[], predicate: (node: Node) => boolean): Node[] => {
  const matches: Node[] = [];
  for (const node of nodes) {
    if (predicate(node)) matches.push(node);
    matches.push(...findAll(children(node), predicate));
  }
  return matches;
};

const set = (node: Node | undefined, breakpoint: 'd' | 't' | 'm', declarations: Record<string, string>) => {
  if (!node) return;
  node.css ||= { d: {}, t: {}, m: {} };
  node.css[breakpoint] = { ...(node.css[breakpoint] || {}), ...declarations };
};

export function buildIndependentStudioDocument(): Doc {
  const document = buildV203();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const section = find(home.tree, node => hasClass(node, 'nl-loop-editorial'));
  const sectionHeading = find(children(section!), node => node.type === 'heading' && node.props.level === 'h2');
  if (sectionHeading) sectionHeading.props.ts = 'title';
  set(sectionHeading, 'd', {
    'font-size': 'clamp(44px,5vw,64px)',
    'line-height': '.96',
    'letter-spacing': '-.035em',
    'max-width': '13ch',
  });
  set(sectionHeading, 'm', {
    'font-size': '38px',
    'line-height': '1',
    'letter-spacing': '-.03em',
    'max-width': '12ch',
  });

  for (const entry of findAll(children(section!), node => hasClass(node, 'nl-loop-ledger-entry'))) {
    const heading = find(children(entry), node => node.type === 'heading' && node.props.level === 'h3');
    set(heading, 'd', {
      'font-size': 'clamp(26px,2.4vw,34px)',
      'line-height': '1.06',
      'letter-spacing': '-.03em',
      'max-width': '18ch',
    });
    set(heading, 'm', {
      'font-size': '26px',
      'line-height': '1.08',
      'max-width': '14ch',
    });
  }

  return document;
}
