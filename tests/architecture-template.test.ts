// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildTemplateDocument } from '../premade-sites/architecture-studio/1.0.0/source.ts';
import { renderSite } from '../server/src/render.ts';
import type { Node } from '../app/src/core/types.ts';

function nodes(tree: Node[]): Node[] { return tree.flatMap(node => [node, ...nodes(node.children)]); }

describe('architecture pilot content resilience', () => {
  it('omits optional project imagery instead of exporting a placeholder', () => {
    const doc = buildTemplateDocument();
    const instance = nodes(doc.pages[0].tree).find(node => node.use === 'project-record')!;
    instance.vals!.image = '';
    const html = new DOMParser().parseFromString(renderSite(doc).files.get('index.html')!, 'text/html');
    const record = html.getElementById(`pagecraft-box-${instance.id}`)!;
    expect(record).not.toBeNull();
    expect(record.querySelectorAll('img')).toHaveLength(0);
    expect(record.querySelector('h2')?.textContent).toBe('Workshop reading room');
    expect(record.querySelector('a')?.getAttribute('href')).toBe('contact.html');
  });

  it.each([1, 3, 7])('exports %i independent project records with uneven content', count => {
    const doc = buildTemplateDocument();
    const section = doc.pages[0].tree.find(node => node.children.some(child => child.use === 'project-record'))!;
    const base = section.children[0];
    section.children = Array.from({ length: count }, (_, index) => {
      const instance = structuredClone(base);
      instance.id = `stress-project-${index}`;
      instance.vals!.title = index === 0 ? 'Workshop reading room for a neighborhood gathering around a shared table' : `Independent project ${index}`;
      instance.vals!.description = index % 2 ? 'A short description.' : 'A deliberately longer description that explains daylight, retained materials, the shared table, and the changing use of the room throughout the day.';
      return instance;
    });
    const html = new DOMParser().parseFromString(renderSite(doc).files.get('index.html')!, 'text/html');
    expect(html.querySelectorAll('[id^="pagecraft-box-stress-project-"]')).toHaveLength(count);
    section.children.forEach(instance => {
      expect(html.getElementById(`pagecraft-box-${instance.id}`)?.querySelector('h2')?.textContent).toBe(instance.vals!.title);
      const paragraphs = [...html.getElementById(`pagecraft-box-${instance.id}`)!.querySelectorAll('p')];
      expect(paragraphs.some(p => p.textContent === instance.vals!.description)).toBe(true);
    });
  });
});
