import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_PACKAGE_FORMAT_V1, SITE_PACKAGE_FORMAT_V1 } from '../app/src/package/types.ts';
import { SCHEMA } from '../app/src/core/index.ts';

const root = resolve(import.meta.dirname, '..');

describe('@pagecraft/editor package', () => {
  it('bundles the WordPress host seam and a contract matching the canonical schema', () => {
    const html = readFileSync(resolve(root, 'packages/editor/dist/editor.html'), 'utf8');
    const contract = JSON.parse(readFileSync(resolve(root, 'packages/editor/dist/contract.json'), 'utf8'));

    expect(html).toContain('window.PC_WORDPRESS');
    expect(html).toContain('createWordPressHostAdapter');
    expect(contract).toMatchObject({
      format: 'pagecraft.editor-contract.v1',
      schemaVersion: SCHEMA,
      rendererVersion: `pagecraft-core-${SCHEMA}`,
      packages: {
        site: SITE_PACKAGE_FORMAT_V1,
        page: PAGE_PACKAGE_FORMAT_V1
      }
    });
  });
});
