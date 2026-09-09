import type { Bp, Doc, Node } from '../../../app/src/core/types.ts';
import {
  PREMADE_DESIGN_CONTRACT_V1,
  findNodes,
  hasNodeClass,
  nodeChildren,
  validatePremadeDesignContractV1,
} from '../v1/design-contract.ts';

export const PREMADE_DESIGN_CONTRACT_V2 = {
  dividerList: 'pc-divider-list-v2',
  dividerItem: 'pc-divider-item-v2',
} as const;

const breakpoints: Bp[] = ['d', 't', 'm'];

const replaceNodeClass = (node: Node, oldClass: string, newClass: string) => {
  const classes = String(node.adv?.cls || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(className => className !== oldClass);
  if (!classes.includes(newClass)) classes.push(newClass);
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
 * An uncontained reading list has no outer frame. Each item after the first
 * owns one separator, leaving the first and last edges visually open.
 */
export function applyDividerListV2(group: Node, items: Node[]) {
  replaceNodeClass(
    group,
    PREMADE_DESIGN_CONTRACT_V1.dividerGroup,
    PREMADE_DESIGN_CONTRACT_V2.dividerList,
  );
  setAtEveryBreakpoint(group, {
    'border-top-width': '0',
    'border-bottom-width': '0',
  });

  items.forEach((item, index) => {
    replaceNodeClass(
      item,
      PREMADE_DESIGN_CONTRACT_V1.dividerItem,
      PREMADE_DESIGN_CONTRACT_V2.dividerItem,
    );
    setAtEveryBreakpoint(item, {
      'border-top-width': index === 0 ? '0' : '1px',
      'border-top-style': 'solid',
      'border-top-color': 'var(--pc-line-strong,#aaa79e)',
      'border-bottom-width': '0',
    });
  });
}

export function validatePremadeDesignContractV2(document: Doc): string[] {
  const findings = validatePremadeDesignContractV1(document);
  const roots = [document.header, document.footer, ...document.pages.map(page => page.tree)].flat();
  const groups = findNodes(roots, node => hasNodeClass(node, PREMADE_DESIGN_CONTRACT_V2.dividerList));

  for (const group of groups) {
    for (const breakpoint of breakpoints) {
      if (group.css[breakpoint]?.['border-top-width'] !== '0') findings.push(`${group.id}:${breakpoint}:list-top`);
      if (group.css[breakpoint]?.['border-bottom-width'] !== '0') findings.push(`${group.id}:${breakpoint}:list-bottom`);
    }
    const items = nodeChildren(group).filter(node => hasNodeClass(node, PREMADE_DESIGN_CONTRACT_V2.dividerItem));
    if (!items.length) findings.push(`${group.id}:missing-items`);
    items.forEach((item, index) => {
      for (const breakpoint of breakpoints) {
        const expectedTop = index === 0 ? '0' : '1px';
        if (item.css[breakpoint]?.['border-top-width'] !== expectedTop) findings.push(`${item.id}:${breakpoint}:item-top`);
        if (item.css[breakpoint]?.['border-bottom-width'] !== '0') findings.push(`${item.id}:${breakpoint}:item-bottom`);
      }
    });
  }

  return findings;
}

export function assertPremadeDesignContractV2(document: Doc) {
  const findings = validatePremadeDesignContractV2(document);
  if (findings.length) throw new Error(`Premade design contract v2 failed: ${findings.join(', ')}`);
}
