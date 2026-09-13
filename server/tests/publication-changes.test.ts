import { test, expect } from 'vitest';
import { publicationChanges } from '../src/publication-changes.ts';
import { blankDoc } from '../src/render.ts';

test('comparison accounts for shared changes and stable page identity', () => {
  const before = blankDoc('QA comparison');
  const after = structuredClone(before);
  after.pages[0].name = 'Renamed';
  after.meta.css = 'h1 {color:red}';
  after.meta.favicon = 'asset:qa-icon';
  const changes = publicationChanges(before, after);
  expect(changes.some(change => change.group === 'Pages' && change.status === 'changed')).toBe(true);
  expect(changes.find(change => change.group === 'Styles')?.pages[0].id).toBe(after.pages[0].id);
  expect(changes.some(change => change.group === 'Assets')).toBe(true);
  expect(publicationChanges(after, structuredClone(after))).toEqual([]);
});
