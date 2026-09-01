import type { Doc, Page } from '../../../app/src/core/types.ts';
import {
  applyCardShellV1,
  applyDividerGroupV1,
  applySectionIntroV1,
  assertPremadeDesignContractV1,
  findNodes,
  groupSectionIntroV1,
  hasNodeClass,
  installPremadeDesignContractV1,
  nodeChildren,
} from '../../lib/v1/design-contract.ts';
import { buildIndependentStudioDocument as buildV206 } from '../2.0.6/source.ts';

export function buildIndependentStudioDocument(): Doc {
  const document = buildV206();
  installPremadeDesignContractV1(document);

  const home = document.pages.find(page => page.slug === 'index') as Page;
  const servicePanels = findNodes(home.tree, node => hasNodeClass(node, 'nl-service-panel'));
  for (const panel of servicePanels) {
    applyCardShellV1(panel, nodeChildren(panel).find(node => node.type === 'image'));
  }

  const sectionIntro = findNodes(home.tree, node => hasNodeClass(node, 'nl-disciplines-intro'))[0];
  if (sectionIntro) applySectionIntroV1(sectionIntro);

  const timeline = findNodes(home.tree, node => hasNodeClass(node, 'nl-timeline'))[0];
  const ledger = nodeChildren(timeline)[1];
  if (ledger) {
    const items = nodeChildren(ledger).filter(node => hasNodeClass(node, 'nl-scrub'));
    applyDividerGroupV1(ledger, items);
  }

  const about = document.pages.find(page => page.slug === 'about') as Page;
  const aboutIntroRow = nodeChildren(about.tree[1])[0];
  const [aboutLabelColumn, aboutContentColumn] = nodeChildren(aboutIntroRow);
  if (aboutIntroRow && aboutLabelColumn && aboutContentColumn) {
    groupSectionIntroV1(aboutIntroRow, aboutLabelColumn, aboutContentColumn);
  }

  const services = document.pages.find(page => page.slug === 'services') as Page;
  const servicesHero = services.tree[0];
  const [servicesLabel, servicesHeading, servicesCopyRow] = nodeChildren(servicesHero);
  const servicesCopy = nodeChildren(nodeChildren(servicesCopyRow)[1])[0];
  if (servicesLabel && servicesHeading && servicesCopy) {
    servicesHero.children = [servicesLabel, servicesHeading, servicesCopy];
    servicesCopy.css.d = {
      ...(servicesCopy.css.d || {}),
      'max-width': '48ch',
      'margin-top': '28px',
    };
    servicesCopy.css.m = {
      ...(servicesCopy.css.m || {}),
      'max-width': '100%',
      'margin-top': '20px',
    };
    applySectionIntroV1(servicesHero);
  }

  const contact = document.pages.find(page => page.slug === 'contact') as Page;
  const contactIntroRow = nodeChildren(contact.tree[1])[0];
  const [contactLabelColumn, contactContentColumn] = nodeChildren(contactIntroRow);
  if (contactIntroRow && contactLabelColumn && contactContentColumn) {
    groupSectionIntroV1(contactIntroRow, contactLabelColumn, contactContentColumn);
  }

  assertPremadeDesignContractV1(document);
  return document;
}
