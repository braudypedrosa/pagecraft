import type { Node, Page } from '../core/types';

export type SectionPlacement = 'before' | 'after' | 'end';

const contains = (node: Node, id: string): boolean =>
  node.id === id || node.children.some(child => contains(child, id));

/** Resolve a nested canvas selection to its owning top-level section. */
export function selectedSectionIndex(tree: Node[], selectedId: string | null | undefined): number | null {
  if (!selectedId) return null;
  const index = tree.findIndex(node => contains(node, selectedId));
  return index < 0 ? null : index;
}

export function placementIndex(tree: Node[], selectedId: string | null | undefined, placement: SectionPlacement): number {
  const selected = selectedSectionIndex(tree, selectedId);
  if (selected == null || placement === 'end') return tree.length;
  return placement === 'before' ? selected : selected + 1;
}

export function placementOptions(tree: Node[], selectedId: string | null | undefined): string[][] {
  return selectedSectionIndex(tree, selectedId) == null
    ? [['end', 'At end of page']]
    : [
      ['before', 'Before selected section'],
      ['after', 'After selected section'],
      ['end', 'At end of page']
    ];
}

type NavItem = { label?: string; href?: string; [key: string]: unknown };

const normalized = (value: unknown) => String(value || '').trim().toLowerCase();
const pageForHref = (href: string, pages: Page[]) => {
  const match = href.match(/^([\w-]+)\.html(?:#([\w-]+))?$/);
  return match ? pages.find(page => page.slug === match[1]) : null;
};

const legacyStarterNav = (items: NavItem[]) => {
  if (items.length !== 3) return false;
  const labels = items.map(item => normalized(item.label));
  const hrefs = items.map(item => normalized(item.href).replace(/^\.\//, ''));
  return labels.join('|') === 'work|about|contact' && hrefs.every(href => href === 'index.html');
};

const validDestination = (href: string, pages: Page[]) =>
  /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i.test(href) || !!pageForHref(href, pages);

/** Keep authored menu rows when their destinations still resolve. Reject the legacy
 * Work/About/Contact-all-home placeholder, then fall back to real project pages. */
export function starterNavItems(existing: Node[], pages: Page[]): NavItem[] {
  const candidates: NavItem[] = [];
  existing.forEach(root => walk(root, node => {
    if (node.type !== 'nav' || candidates.length) return;
    const items = Array.isArray(node.props.items) ? node.props.items as NavItem[] : [];
    if (legacyStarterNav(items)) return;
    candidates.push(...items.filter(item => {
      const label = String(item.label || '').trim();
      const href = String(item.href || '').trim();
      return !!label && !!href && validDestination(href, pages);
    }));
  }));
  if (candidates.length) return candidates.map(item => ({ ...item }));
  return pages.map(page => ({ label: page.name, href: `${page.slug}.html` }));
}

export function firstAction(root: Node): Node | null {
  let found: Node | null = null;
  walk(root, node => { if (!found && node.type === 'button') found = node; });
  return found;
}

export function applyRegionSetup(root: Node, navItems: NavItem[], action?: { label: string; href: string } | null) {
  walk(root, node => {
    if (node.type === 'nav' && navItems.length) node.props.items = navItems.map(item => ({ ...item }));
  });
  const button = firstAction(root);
  if (button && action) {
    button.props.text = action.label;
    button.props.link = action.href;
  }
}

export function actionDestinationOptions(pages: Page[]): string[][] {
  return [
    ['', 'No link — choose a destination later'],
    ...pages.map(page => [`${page.slug}.html`, page.name])
  ];
}

/** A non-front page is normally a meaningful action target. One-page sites stay explicit. */
export function suggestedActionDestination(pages: Page[]): string {
  const target = pages.find((page, index) => index > 0 && page.slug !== 'index');
  return target ? `${target.slug}.html` : '';
}

function walk(root: Node, visit: (node: Node) => void) {
  visit(root);
  root.children.forEach(child => walk(child, visit));
}
