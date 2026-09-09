import type { Doc } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV201 } from '../2.0.1/source.ts';

const wordpressFallbackCss = `
[aria-label="Northline working loop"]{
  scrollbar-width:none;
  -ms-overflow-style:none;
  padding-bottom:0;
}
[aria-label="Northline working loop"]::-webkit-scrollbar{
  display:none;
  width:0;
  height:0;
}
`;

export function buildIndependentStudioDocument(): Doc {
  const document = buildV201();
  document.meta.css += wordpressFallbackCss;
  return document;
}
