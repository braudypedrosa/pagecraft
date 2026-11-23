import type { Doc } from '../../../app/src/core/types.ts';
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
 * Preserve 2.0.9 and correct the one use of Signal red: the Digital label on the Home
 * service cards was 14 px #ef3f32 on warm paper (3.40:1). #bd3028 reaches 5.11:1 on paper
 * and 4.67:1 on the darker surface colour (C1, approved option A, 23 Nov 2026).
 */
export async function buildIndependentStudioDocument(): Promise<Doc> {
  const buildV209 = await releasedFactory();
  const document = buildV209();
  const red = document.meta.tokens?.colors.find(color => color.id === 'red');
  if (!red) throw new Error('Northline red color token is missing');
  red.value = '#bd3028';
  return document;
}
