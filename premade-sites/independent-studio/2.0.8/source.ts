import type { Doc, Page } from '../../../app/src/core/types.ts';
import { findNodes, hasNodeClass, nodeChildren } from '../../lib/v1/design-contract.ts';
import {
  applyDividerListV2,
  assertPremadeDesignContractV2,
} from '../../lib/v2/design-contract.ts';
import { buildIndependentStudioDocument as buildV207 } from '../2.0.7/source.ts';

export function buildIndependentStudioDocument(): Doc {
  const document = buildV207();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const timeline = findNodes(home.tree, node => hasNodeClass(node, 'nl-timeline'))[0];
  const list = nodeChildren(timeline)[1];

  if (list) {
    const items = nodeChildren(list).filter(node => hasNodeClass(node, 'nl-scrub'));
    applyDividerListV2(list, items);
  }

  assertPremadeDesignContractV2(document);
  return document;
}
