import { test } from 'vitest';
import a from 'node:assert/strict';
import {
  buildTemplateStarter,
  validateTemplateDocument,
  validateTemplateSourceConfig,
  type TemplateSourceConfig,
} from '../../premade-sites/lib/authoring.ts';

const config = (extra: Partial<TemplateSourceConfig> = {}) => validateTemplateSourceConfig({
  format: 'pagecraft.site-template-source.v1',
  id: 'test-studio',
  version: '1.0.0',
  name: 'Test Studio',
  sampleName: 'Example Studio',
  description: 'A test template.',
  categories: ['Studio'],
  source: 'source.ts',
  sourceExport: 'buildTemplateDocument',
  previewPage: 'index.html',
  assets: [],
  customCssPolicy: 'native-only',
  ...extra,
});

test('template scaffold starts as a valid native editable Pagecraft document', () => {
  const document = buildTemplateStarter('Example Studio');
  a.deepEqual(validateTemplateDocument(document, config()), []);
  a.equal(document.pages.length, 1);
  a.equal(document.pages[0].slug, 'index');
});

test('native-only templates reject invisible CSS escape hatches', () => {
  const document = buildTemplateStarter('Example Studio');
  document.meta.css = '.hidden-layout{padding:80px}';
  a.deepEqual(validateTemplateDocument(document, config()), ['document:custom-css-is-not-builder-native']);

  document.meta.css = '';
  document.pages[0].tree = [{
    id: 'box-one', type: 'box', props: {}, css: { d: {}, t: {}, m: {} }, hide: {}, cls: [],
    adv: { htmlId: '', cls: '', css: '&{border-top:1px solid red}' }, children: [],
  }];
  a.deepEqual(validateTemplateDocument(document, config()), ['box-one:advanced-css-is-not-builder-native']);
});

test('template contract matches document asset references to configured files', () => {
  const document = buildTemplateStarter('Example Studio');
  document.meta.ogImage = 'asset:hero-image';
  a.deepEqual(validateTemplateDocument(document, config()), ['asset:hero-image:not-configured']);
  const withAsset = config({ assets: [{ id: 'hero-image', file: 'assets/hero.webp' }] });
  a.deepEqual(validateTemplateDocument(document, withAsset), []);
});

test('reviewed custom CSS requires an explicit migration reason', () => {
  a.throws(() => config({ customCssPolicy: 'reviewed-exception' }), /requires customCssReason/);
  a.equal(config({
    customCssPolicy: 'reviewed-exception',
    customCssReason: 'Pseudo-element artwork pending native support.',
  }).customCssPolicy, 'reviewed-exception');
});
