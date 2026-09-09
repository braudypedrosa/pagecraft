import type { Bp, Doc, Node } from '../../../app/src/core/types.ts';

export const PREMADE_DESIGN_CONTRACT_V1 = {
  cardShell: 'pc-card-shell-v1',
  cardMedia: 'pc-card-media-v1',
  dividerGroup: 'pc-divider-group-v1',
  dividerItem: 'pc-divider-item-v1',
  sectionIntro: 'pc-section-intro-v1',
} as const;

const breakpoints: Bp[] = ['d', 't', 'm'];

export const nodeChildren = (node: Node | undefined): Node[] => node?.children || [];

export const hasNodeClass = (node: Node, className: string): boolean => String(node.adv?.cls || '')
  .split(/\s+/)
  .filter(Boolean)
  .includes(className);

export const findNodes = (nodes: Node[], predicate: (node: Node) => boolean): Node[] => {
  const matches: Node[] = [];
  for (const node of nodes) {
    if (predicate(node)) matches.push(node);
    matches.push(...findNodes(nodeChildren(node), predicate));
  }
  return matches;
};

const addNodeClass = (node: Node, className: string) => {
  const classes = String(node.adv?.cls || '').split(/\s+/).filter(Boolean);
  if (!classes.includes(className)) classes.push(className);
  node.adv = { ...(node.adv || {}), cls: classes.join(' ') };
};

const setCss = (node: Node, breakpoint: Bp, declarations: Record<string, string>) => {
  node.css ||= { d: {}, t: {}, m: {} };
  node.css[breakpoint] = { ...(node.css[breakpoint] || {}), ...declarations };
};

const setAtEveryBreakpoint = (node: Node, declarations: Record<string, string>) => {
  for (const breakpoint of breakpoints) setCss(node, breakpoint, declarations);
};

/**
 * Installs the stable v1 surface tokens. Released templates must keep using this
 * module unchanged; incompatible contract work belongs in a future lib/v2.
 */
export function installPremadeDesignContractV1(document: Doc) {
  const marker = '/* pagecraft-premade-design-contract:v1 */';
  if (document.meta.css.includes(marker)) return;
  document.meta.css = [
    document.meta.css.trimEnd(),
    marker,
    ':root{--pc-card-radius:12px;--pc-line-strong:#aaa79e}',
  ].filter(Boolean).join('\n');
}

/** The card owns one complete shell; media inside it never draws a second shell. */
export function applyCardShellV1(card: Node, media?: Node) {
  addNodeClass(card, PREMADE_DESIGN_CONTRACT_V1.cardShell);
  setAtEveryBreakpoint(card, {
    'border-width': '1px',
    'border-style': 'solid',
    'border-color': 'var(--pc-line-strong,#aaa79e)',
    'border-radius': 'var(--pc-card-radius,12px)',
    overflow: 'hidden',
  });
  if (!media) return;
  addNodeClass(media, PREMADE_DESIGN_CONTRACT_V1.cardMedia);
  setAtEveryBreakpoint(media, {
    'border-width': '0',
    'border-radius': '0',
  });
}

/**
 * A deliberately framed ledger owns its first and last rules at group level.
 * Items own only their internal separators, so item motion cannot fade an outer edge.
 */
export function applyDividerGroupV1(group: Node, items: Node[]) {
  addNodeClass(group, PREMADE_DESIGN_CONTRACT_V1.dividerGroup);
  setAtEveryBreakpoint(group, {
    'border-top-width': '1px',
    'border-top-style': 'solid',
    'border-top-color': 'var(--pc-line-strong,#aaa79e)',
    'border-bottom-width': '1px',
    'border-bottom-style': 'solid',
    'border-bottom-color': 'var(--pc-line-strong,#aaa79e)',
  });

  items.forEach((item, index) => {
    addNodeClass(item, PREMADE_DESIGN_CONTRACT_V1.dividerItem);
    setAtEveryBreakpoint(item, {
      'border-top-width': index === 0 ? '0' : '1px',
      'border-top-style': 'solid',
      'border-top-color': 'var(--pc-line-strong,#aaa79e)',
      'border-bottom-width': '0',
    });
  });
}

/** Marks one reading group that contains its heading and explanatory paragraph. */
export function applySectionIntroV1(intro: Node) {
  addNodeClass(intro, PREMADE_DESIGN_CONTRACT_V1.sectionIntro);
}

/**
 * Recompose a label-only column and a heading/copy column into one reading flow.
 * This is for text-only splits; media-dependent compositions remain template-owned.
 */
export function groupSectionIntroV1(row: Node, labelColumn: Node, contentColumn: Node) {
  const labels = nodeChildren(labelColumn);
  contentColumn.children = [...labels, ...nodeChildren(contentColumn)];
  row.children = [contentColumn];
  setAtEveryBreakpoint(row, {
    gap: '0',
    'justify-content': 'flex-start',
  });
  setCss(contentColumn, 'd', {
    'flex-grow': '0',
    'flex-basis': 'auto',
    width: '100%',
    'max-width': '790px',
  });
  setCss(contentColumn, 't', {
    'flex-basis': '100%',
    width: '100%',
    'max-width': '790px',
  });
  setCss(contentColumn, 'm', {
    'flex-basis': '100%',
    width: '100%',
    'max-width': '100%',
  });
  for (const label of labels) setAtEveryBreakpoint(label, { 'margin-bottom': '18px' });
  applySectionIntroV1(contentColumn);
}

export function validatePremadeDesignContractV1(document: Doc): string[] {
  const nodes = [document.header, document.footer, ...document.pages.map(page => page.tree)].flat();
  const findings: string[] = [];
  const marked = (className: string) => findNodes(nodes, node => hasNodeClass(node, className));

  for (const card of marked(PREMADE_DESIGN_CONTRACT_V1.cardShell)) {
    for (const breakpoint of breakpoints) {
      if (card.css[breakpoint]?.['border-width'] !== '1px') findings.push(`${card.id}:${breakpoint}:card-border`);
      if (card.css[breakpoint]?.['border-radius'] !== 'var(--pc-card-radius,12px)') findings.push(`${card.id}:${breakpoint}:card-radius`);
      if (card.css[breakpoint]?.overflow !== 'hidden') findings.push(`${card.id}:${breakpoint}:card-overflow`);
    }
  }

  for (const media of marked(PREMADE_DESIGN_CONTRACT_V1.cardMedia)) {
    for (const breakpoint of breakpoints) {
      if (media.css[breakpoint]?.['border-width'] !== '0') findings.push(`${media.id}:${breakpoint}:media-border`);
      if (media.css[breakpoint]?.['border-radius'] !== '0') findings.push(`${media.id}:${breakpoint}:media-radius`);
    }
  }

  for (const group of marked(PREMADE_DESIGN_CONTRACT_V1.dividerGroup)) {
    for (const breakpoint of breakpoints) {
      if (group.css[breakpoint]?.['border-top-width'] !== '1px') findings.push(`${group.id}:${breakpoint}:group-top`);
      if (group.css[breakpoint]?.['border-bottom-width'] !== '1px') findings.push(`${group.id}:${breakpoint}:group-bottom`);
    }
    const items = nodeChildren(group).filter(node => hasNodeClass(node, PREMADE_DESIGN_CONTRACT_V1.dividerItem));
    if (!items.length) findings.push(`${group.id}:missing-items`);
    items.forEach((item, index) => {
      for (const breakpoint of breakpoints) {
        const expectedTop = index === 0 ? '0' : '1px';
        if (item.css[breakpoint]?.['border-top-width'] !== expectedTop) findings.push(`${item.id}:${breakpoint}:item-top`);
        if (item.css[breakpoint]?.['border-bottom-width'] !== '0') findings.push(`${item.id}:${breakpoint}:item-bottom`);
      }
    });
  }

  for (const intro of marked(PREMADE_DESIGN_CONTRACT_V1.sectionIntro)) {
    const content = nodeChildren(intro).filter(node => node.type === 'heading' || node.type === 'text');
    if (!content.some(node => node.type === 'heading')) findings.push(`${intro.id}:intro-heading`);
    if (!content.some(node => node.type === 'text')) findings.push(`${intro.id}:intro-copy`);
  }

  return findings;
}

export function assertPremadeDesignContractV1(document: Doc) {
  const findings = validatePremadeDesignContractV1(document);
  if (findings.length) throw new Error(`Premade design contract v1 failed: ${findings.join(', ')}`);
}
