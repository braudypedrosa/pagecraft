import { writeFileSync } from 'node:fs';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc } from '../../server/src/render.ts';
import { createPagePackage } from '../../server/src/portable-packages.ts';

const output = process.argv[2];
if (!output) throw new Error('an output path is required');

const document = blankDoc('WordPress Import Fixture');
document.pages[0].id = 'page-import-fixture';
document.pages[0].name = 'Imported Landing Page';
document.pages[0].slug = 'imported-landing-page';
document.pages[0].title = 'Imported Landing Page — Pagecraft';
const section = Core.makeFor('section');
section.id = 'section-import-fixture';
const heading = Core.makeFor('heading');
heading.id = 'heading-import-fixture';
heading.props.text = 'A native Pagecraft page';
section.children = [heading];
document.pages[0].tree = [section];

const built = createPagePackage({
  document,
  pageId: document.pages[0].id,
  provenance: {
    format: 'pagecraft.provenance.v1',
    origin: 'pagecraft-cloud',
    sourceId: 'cloud-project-fixture',
    sourceVersion: 9,
    exportedBy: 'owner-fixture'
  }
});
writeFileSync(output, built.bytes);
