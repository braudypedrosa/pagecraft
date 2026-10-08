// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import * as Core from '../app/src/core/index.ts';
import type { Doc, PropBag } from '../app/src/core/types.ts';
import { blankDoc, renderSite } from '../server/src/render.ts';

const CLOUD = 'https://cloud.test/forms/site';

function formDocument(props: Partial<PropBag> = {}): Doc {
  const doc = blankDoc('Form destinations');
  const form = Core.N('form');
  form.id = 'destination-form';
  Object.assign(form.props, props);
  doc.pages[0].tree = [form];
  return doc;
}

const htmlFor = (props: Partial<PropBag>, cloud = CLOUD) =>
  renderSite(formDocument(props), [], cloud);

afterEach(() => Core.setCloudFormEndpoint(''));

test('legacy blank POST forms retain the Cloud receiver and submission safeguards', () => {
  const rendered = htmlFor({ action: '', method: 'post' });
  const html = rendered.files.get('index.html')!;
  expect(html).toContain('action="https://cloud.test/forms/site/destination-form" method="post"');
  expect(html).toContain('name="_pc_trap" tabindex="-1" autocomplete="off"');
  expect(html).toContain("i.name='_pc_request';i.value=crypto.randomUUID()");
  expect(html).toContain("f.addEventListener('submit'");
  expect(html).not.toContain('data-disabled');
  expect(rendered.findings.map(f => f.code)).not.toContain('form-no-action');
});

test.each(['post', 'get'] as const)('Cloud preserves an explicit external HTTPS %s destination', method => {
  const action = 'https://provider.test/search?property=stillwood&source=pagecraft';
  const rendered = htmlFor({ mode: 'wordpress', action, method });
  const html = rendered.files.get('index.html')!;
  expect(html).toContain('action="https://provider.test/search?property=stillwood&amp;source=pagecraft"');
  expect(html).toContain(`method="${method}"`);
  expect(html).not.toContain(CLOUD);
  expect(html).not.toContain('_pc_trap');
  expect(html).not.toContain('_pc_request');
  expect(html).not.toContain('data-pagecraft-form-mode="wordpress"');
  expect(html).not.toContain('data-disabled');
  expect(rendered.findings.map(f => f.code)).not.toContain('form-no-action');
  expect(rendered.findings.map(f => f.code)).not.toContain('unsafe-form-action');
});

test('external GET query values survive native submission without overriding authored fields', () => {
  const action = 'https://provider.test/search?property=stillwood&tag=quiet%20stay&tag=pet%26family&source=pagecraft&message=%22%3E%3Cem%3Ehello%3C%2Fem%3E';
  const rendered = htmlFor({
    action,
    method: 'get',
    fields: [{ type: 'text', label: 'Property', name: 'property', required: 1 }],
  });
  const parsed = new DOMParser().parseFromString(rendered.files.get('index.html')!, 'text/html');
  const form = parsed.querySelector('form')!;
  const property = form.elements.namedItem('property') as HTMLInputElement;
  property.value = 'guest choice';

  expect(form.querySelectorAll('input[type="hidden"][name="property"]')).toHaveLength(0);
  expect(Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tag"]')).map(input => input.value))
    .toEqual(['quiet stay', 'pet&family']);
  expect(form.querySelector<HTMLInputElement>('input[type="hidden"][name="message"]')?.value)
    .toBe('"><em>hello</em>');

  const submitted = new URL(form.action);
  const data = new FormData(form);
  const submittedParams = new URLSearchParams();
  data.forEach((value, name) => submittedParams.append(name, String(value)));
  submitted.search = submittedParams.toString();
  expect(submitted.searchParams.get('property')).toBe('guest choice');
  expect(submitted.searchParams.getAll('tag')).toEqual(['quiet stay', 'pet&family']);
  expect(submitted.searchParams.get('source')).toBe('pagecraft');
  expect(submitted.searchParams.get('message')).toBe('"><em>hello</em>');
});

test('external POST keeps its action query without hidden query copies', () => {
  const action = 'https://provider.test/submit?property=stillwood&tag=one&tag=two';
  const rendered = htmlFor({ action, method: 'post' });
  const parsed = new DOMParser().parseFromString(rendered.files.get('index.html')!, 'text/html');
  const form = parsed.querySelector('form')!;
  expect(form.action).toBe(action);
  expect(form.method).toBe('post');
  expect(form.querySelector('input[type="hidden"][name="property"]')).toBeNull();
  expect(form.querySelector('input[type="hidden"][name="tag"]')).toBeNull();
});

test('blank GET and unsafe explicit Cloud forms stay disabled and audit the rendered result', () => {
  const blankGet = htmlFor({ action: '', method: 'get' });
  const blankHtml = blankGet.files.get('index.html')!;
  expect(blankHtml).toContain('data-disabled');
  expect(blankHtml).not.toContain('<form ');
  expect(blankHtml).not.toContain(CLOUD);
  expect(blankHtml).not.toContain('_pc_trap');
  expect(blankGet.findings.map(f => f.code)).toContain('form-no-action');
  expect(blankGet.findings.find(f => f.code === 'form-no-action')?.level).toBe('warn');
  expect(blankGet.findings.filter(f => f.level === 'error')).toEqual([]);

  const portablePost = htmlFor({ action: '', method: 'post' }, '');
  expect(portablePost.findings.find(f => f.code === 'form-no-action')?.level).toBe('error');

  const unsafe = htmlFor({ action: 'javascript:alert(1)', method: 'post' });
  const unsafeHtml = unsafe.files.get('index.html')!;
  expect(unsafeHtml).toContain('data-disabled');
  expect(unsafeHtml).not.toContain('<form ');
  expect(unsafeHtml).not.toContain('javascript:');
  expect(unsafeHtml).not.toContain(CLOUD);
  expect(unsafe.findings.map(f => f.code)).toContain('unsafe-form-action');
  expect(unsafe.findings.find(f => f.code === 'unsafe-form-action')?.level).toBe('error');
});

test('standalone external and WordPress-managed handling remain unchanged', () => {
  const external = htmlFor({
    action: 'https://provider.test/find?region=north',
    method: 'get',
  }, '');
  const externalHtml = external.files.get('index.html')!;
  expect(externalHtml).toContain('action="https://provider.test/find?region=north" method="get"');
  expect(externalHtml).not.toContain('_pc_trap');

  const wordpress = htmlFor({
    mode: 'wordpress',
    action: 'javascript:must-not-ship()',
    method: 'get',
  }, '');
  const wordpressHtml = wordpress.files.get('index.html')!;
  expect(wordpressHtml).toContain('action="%%PAGECRAFT_FORM_ENDPOINT:destination-form%%" method="post"');
  expect(wordpressHtml).toContain('data-pagecraft-form-mode="wordpress"');
  expect(wordpressHtml).not.toContain('javascript:');
  expect(wordpress.findings.map(f => f.code)).not.toContain('unsafe-form-action');
});

test('shared handling descriptions reflect the selected Cloud destination', () => {
  Core.setCloudFormEndpoint(CLOUD);
  expect(Core.resolveFormHandling({ action: '', method: 'post' }, 'form').note).toMatch(/Submissions/);
  expect(Core.resolveFormHandling({ action: 'https://provider.test/send', method: 'post' }, 'form').note).toMatch(/external HTTPS/);
  expect(Core.resolveFormHandling({ action: '', method: 'get' }, 'form').note).toMatch(/Add an HTTPS destination/);
  expect(Core.resolveFormHandling({ action: 'http://provider.test/send', method: 'post' }, 'form').note).toMatch(/Disabled/);
});
