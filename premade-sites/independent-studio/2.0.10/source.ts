import type { Doc, Node } from '../../../app/src/core/types.ts';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type IndependentStudioFactory = () => Doc;

const releasedFactory = async (): Promise<IndependentStudioFactory> => {
  // Released sources stay immutable. Resolve this predecessor at runtime, as the
  // premade-site compiler does, so this successor does not make historical source
  // diagnostics part of the current application typecheck.
  const sourceUrl = pathToFileURL(resolve(
    process.cwd(),
    'premade-sites/independent-studio/2.0.9/source.ts',
  )).href;
  const source = await import(sourceUrl) as {
    buildIndependentStudioDocument: IndependentStudioFactory;
  };
  return source.buildIndependentStudioDocument;
};

/**
 * Preserve 2.0.9 while correcting its red contrast and allowing editable Home
 * headings to use the native text column instead of an artificial character cap.
 */
export async function buildIndependentStudioDocument(): Promise<Doc> {
  const buildV209 = await releasedFactory();
  const document = buildV209();
  const red = document.meta.tokens?.colors.find(color => color.id === 'red');
  if (!red) throw new Error('Northline red color token is missing');
  red.value = '#bd3028';

  let homeHeading: Node | undefined;
  const visit = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.id === 'northline-v2-node-0011') homeHeading = node;
      visit(node.children || []);
    }
  };
  const home = document.pages.find(page => page.slug === 'index');
  if (!home) throw new Error('Northline Home page is missing');
  visit(home.tree);
  if (!homeHeading) throw new Error('Northline Home heading is missing');
  homeHeading.css.d['max-width'] = '100%';
  homeHeading.css.t['max-width'] = '100%';
  return document;
}
