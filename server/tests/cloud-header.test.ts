import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cloudHeader, CLOUD_HEADER_CSS } from '../src/cloud-header.ts';
import { liveReviewPage, reviewHubPage } from '../src/live-review-page.ts';

test('Cloud and review screens consume one header renderer and stylesheet', () => {
  const account = readFileSync(new URL('../src/account-pages.ts', import.meta.url),'utf8');
  expect(account).toContain('=> cloudHeader(label,');
  expect(account).toContain('${CLOUD_HEADER_CSS}');
  const input = {name:'<QA>',siteId:'s1',base:'/review/token',person:'Owner',owner:true,canResolve:true,links:[],pages:[{path:'index.html',name:'Home'}],invitations:[]};
  const page = liveReviewPage(input);
  const hub = reviewHubPage({...input,assignments:[]});
  const common = cloudHeader(input.name,'').split('<span class="pc-spacer">')[0];
  expect(page).toContain(common); expect(hub).toContain(common);
  expect(page).toContain(CLOUD_HEADER_CSS);
  expect(page).not.toContain('brand-link');
  expect(common).toContain('&lt;QA&gt;');
});

test('builder and reviews load the same wordmark, device styles and icons', async () => {
  const { BUILDER_HEADER_CSS, HEADER_DEVICE_ICONS } = await import('../../shared/builder-header.js');
  const build = readFileSync(new URL('../../build.mjs',import.meta.url),'utf8');
  expect(build).toContain('${BUILDER_HEADER_CSS}');
  expect(build).toContain('Object.entries(HEADER_DEVICE_ICONS)');
  expect(CLOUD_HEADER_CSS).toContain(BUILDER_HEADER_CSS);
  const review = liveReviewPage({name:'QA',siteId:'s1',base:'/review/token',person:'QA',owner:false,canResolve:false,links:[],pages:[{path:'index.html',name:'Home'}],invitations:[]});
  for (const icon of Object.values(HEADER_DEVICE_ICONS)) expect(review).toContain(icon);
});
