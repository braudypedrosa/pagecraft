// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { Node } from '../app/src/core/types.ts';
import { buildTemplateDocument as buildCommonGround } from '../premade-sites/architecture-studio/1.0.1/source.ts';
import { buildTemplateDocument as buildMarea } from '../premade-sites/coastal-rentals/1.0.5/source.ts';
import { buildIndependentStudioDocument as buildNorthline } from '../premade-sites/independent-studio/2.0.10/source.ts';
import { buildTemplateDocument as buildSaltHouse } from '../premade-sites/salt-house/1.0.1/source.ts';
import { buildTemplateDocument as buildStillwood } from '../premade-sites/stillwood/1.0.1/source.ts';
import { renderSite } from '../server/src/render.ts';

const nodes = (tree: Node[]): Node[] => tree.flatMap(node => [node, ...nodes(node.children || [])]);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('template accessibility draft candidates', () => {
  it('keeps the released package archives byte-identical', async () => {
    const marea = await readFile('premade-sites/coastal-rentals/1.0.4/site.pagecraft-site.zip');
    const northline = await readFile('premade-sites/independent-studio/2.0.9/site.pagecraft-site.zip');
    expect(digest(marea)).toBe('1e4a5ac1dd1d738e600101395c6de678695938acd8d9f75a5b55d0b2f6d61f3c');
    expect(digest(northline)).toBe('61467fdc9507c40ca7aeabc2d60b8d61b35d05bfe7717a3674589d1407f55340');
  });

  it('corrects Marea contrast, opening-image loading, and Stays heading order', () => {
    const document = buildMarea();
    expect(document.meta.tokens?.colors.find(color => color.id === 'muted')?.value).toBe('#606a64');

    const stays = document.pages.find(page => page.slug === 'stays')!;
    const staysNodes = nodes(stays.tree);
    expect(staysNodes.find(node => node.id === 'marea-node-0089')?.props.lazy).toBe(0);
    expect(staysNodes.filter(node =>
      node.type === 'heading'
      && ['Stone Cove House', 'Pine Court House', 'Harbor Studio', 'Garden Casita'].includes(String(node.props.text)),
    ).map(node => node.props.level)).toEqual(['h2', 'h2', 'h2', 'h2']);

    const unresolved = renderSite(document).findings.filter(finding =>
      ['contrast', 'hero-image-lazy', 'heading-skip'].includes(finding.code),
    );
    expect(unresolved).toEqual([]);
  });

  it('corrects Northline small red-label contrast through its editable color token', async () => {
    const document = await buildNorthline();
    expect(document.meta.tokens?.colors.find(color => color.id === 'red')?.value).toBe('#bd3028');
    const digital = nodes(document.pages.find(page => page.slug === 'index')!.tree)
      .find(node => node.id === 'northline-v2-node-0038');
    expect(digital?.css.d.color).toBe('var(--c-red)');
    expect(renderSite(document).findings.filter(finding => finding.code === 'contrast')).toEqual([]);
    const hero = nodes(document.pages.find(page => page.slug === 'index')!.tree)
      .find(node => node.id === 'northline-v2-node-0011')!;
    expect(hero.css.d['max-width']).toBe('100%');
    expect(hero.css.t['max-width']).toBe('100%');
  });

  it('keeps inquiry instructions consistent with the actual publication host', () => {
    const commonGround = buildCommonGround();
    const home = nodes(commonGround.pages.find(page => page.slug === 'index')!.tree)
      .find(node => node.type === 'heading' && node.props.level === 'h1')!;
    expect(home.css.t['font-size']).toBe('36px');
    const contactText = JSON.stringify(commonGround.pages.find(page => page.slug === 'contact')!.tree);
    expect(contactText).toContain('verify a test receipt');
    expect(contactText).not.toContain('This demonstration form is not connected');

    const mareaContact = JSON.stringify(buildMarea().pages.find(page => page.slug === 'contact')!.tree);
    expect(mareaContact).toContain('verify a test receipt');
    expect(mareaContact).not.toContain('This sample form is ready to connect');

    const salt = buildSaltHouse();
    const saltNodes = nodes(salt.pages.flatMap(page => page.tree));
    expect(saltNodes.find(node => node.id === 'salt-photo-shade-180')?.css.d.opacity).toBe('.65');
    expect(saltNodes.find(node => node.id === 'salt-text-54')?.css.t['max-width']).toBe('100%');
    expect(saltNodes.find(node => node.id === 'salt-welcome-and-homes-59')?.css.t['grid-template-columns'])
      .toBe('1fr 1.25fr');
    const inquiry = JSON.stringify(salt.pages.find(page => page.slug === 'plan-your-stay')!.tree);
    expect(inquiry).toContain('receipt test');
    expect(inquiry).not.toContain('no inquiry can be sent');
  });

  it('separates Stillwood provider search from managed stay inquiries', async () => {
    const document = await buildStillwood();
    const forms = nodes(document.pages.flatMap(page => page.tree)).filter(node => node.type === 'form');
    expect(forms).toHaveLength(5);
    const search = forms.find(node => node.props.aria === 'Search cabin stays')!;
    expect(search.props.method).toBe('get');
    expect(search.props.submit).toBe('Check availability');
    expect(forms.filter(node => node !== search).every(node => node.props.method !== 'get')).toBe(true);

    const cloud = renderSite(document, [], 'https://cloud.test/forms/site');
    const home = new DOMParser().parseFromString(cloud.files.get('index.html')!, 'text/html');
    expect(home.querySelector('form[aria-label="Search cabin stays"]')).toBeNull();
    expect(home.querySelector('[aria-label="Search cabin stays"] button')?.hasAttribute('disabled')).toBe(true);
    expect(home.body.textContent).toContain('booking provider’s HTTPS destination');
    const contact = new DOMParser().parseFromString(cloud.files.get('contact.html')!, 'text/html');
    expect(contact.querySelector('form')?.getAttribute('method')).toBe('post');
    expect(contact.querySelector('form')?.getAttribute('action')).toContain('https://cloud.test/forms/site/');
    expect(contact.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
    expect(contact.body.textContent).not.toContain('Demo template: this form is not connected');
  });
});
