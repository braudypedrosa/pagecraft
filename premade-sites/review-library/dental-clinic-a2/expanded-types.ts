import type { Node, Page } from '../../../app/src/core/types.ts';

export type DentalStyle = Record<string, string>;
export interface DentalHelpers {
  color: Record<'ink' | 'primary' | 'sky' | 'ice' | 'white' | 'line', string>;
  node(type: string, props?: Record<string, unknown>, desktop?: DentalStyle, children?: Node[], mobile?: DentalStyle, tablet?: DentalStyle): Node;
  box(children: Node[], desktop?: DentalStyle, mobile?: DentalStyle, tablet?: DentalStyle): Node;
  text(copy: string, token?: string, level?: string, desktop?: DentalStyle, mobile?: DentalStyle): Node;
  sec(children: Node[], desktop?: DentalStyle, mobile?: DentalStyle, tablet?: DentalStyle): Node;
  image(id: string, alt: string, height?: string, mobile?: string): Node;
  naturalImage(id: string, alt: string, width: number, height: number): Node;
  portrait(id: string, alt: string): Node;
  button(label: string, link: string, light?: boolean): Node;
  intro(eyebrow: string, title: string, copy: string): Node;
  page(slug: string, name: string, tree: Node[]): Page;
  points(items: [string, string][]): Node;
}
