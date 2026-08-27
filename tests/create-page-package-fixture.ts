import { writeFileSync } from 'node:fs';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc } from '../../server/src/render.ts';
import { createPagePackage } from '../../server/src/portable-packages.ts';
import type { Asset } from '../../server/src/assets.ts';

const output = process.argv[2];
if (!output) throw new Error('an output path is required');

const document = blankDoc('WordPress Import Fixture');
document.pages[0].id = 'page-import-fixture';
document.pages[0].name = 'Imported Landing Page';
document.pages[0].slug = 'imported-landing-page';
document.pages[0].title = 'Imported Landing Page — Pagecraft';
const header = Core.makeFor('section');
header.id = 'global-header-fixture';
header.props.tag = 'header';
const nav = Core.makeFor('nav');
nav.id = 'global-nav-fixture';
nav.props.items = [{ label: 'Home', href: 'index.html', cls: '', target: '' }];
header.children = [nav];
document.header = [header];
const footer = Core.makeFor('section');
footer.id = 'global-footer-fixture';
footer.props.tag = 'footer';
const footerText = Core.makeFor('text');
footerText.id = 'global-footer-text-fixture';
footerText.props.html = '<p>Pagecraft global footer</p>';
footer.children = [footerText];
document.footer = [footer];
const section = Core.makeFor('section');
section.id = 'section-import-fixture';
const heading = Core.makeFor('heading');
heading.id = 'heading-import-fixture';
heading.props.text = 'A native Pagecraft page';
const image = Core.makeFor('image');
image.id = 'image-import-fixture';
Object.assign(image.props, {
  src: 'asset:hero-image', alt: 'Pagecraft native media', caption: 'Locally owned in WordPress', w: '1', h: '1'
});
section.css.d['background-image'] = 'url("asset:hero-image")';
section.children = [heading, image];
const tabs = Core.makeFor('tabs');
tabs.id = 'tabs-import-fixture';
tabs.props.items = [
  { label: 'First', panel: '<p>First panel</p>' },
  { label: 'Second', panel: '<p>Second panel</p>' }
];
section.children.push(tabs);
document.pages[0].tree = [section];

const asset: Asset = {
  id: 'hero-image', siteId: 'cloud-project-fixture', name: 'Pagecraft Hero.png', type: 'image/png', w: 1, h: 1,
  bytes: Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2h8sAAAAASUVORK5CYII=',
    'base64'
  ))
};
const built = createPagePackage({
  document,
  pageId: document.pages[0].id,
  assets: [asset],
  provenance: {
    format: 'pagecraft.provenance.v1',
    origin: 'pagecraft-cloud',
    sourceId: 'cloud-project-fixture',
    sourceVersion: 9,
    exportedBy: 'owner-fixture'
  }
});
writeFileSync(output, built.bytes);
