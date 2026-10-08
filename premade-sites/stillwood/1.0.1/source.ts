import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node } from '../../../app/src/core/types.ts';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Keep provider availability search separate from ordinary stay inquiries. */
export async function buildTemplateDocument(): Promise<Doc> {
  // Keep the released source immutable and outside the application typecheck,
  // while using the same runtime source resolution as the premade compiler.
  const { buildTemplateDocument: predecessor } = await import(pathToFileURL(resolve(
    process.cwd(), 'premade-sites/stillwood/1.0.0/source.ts',
  )).href) as { buildTemplateDocument: () => Doc };
  const document = predecessor();
  let searchFound = false;
  let contactGuidanceFound = false;
  const walk = (nodes: Node[], home: boolean) => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (home && node.type === 'form' && node.props.aria === 'Search cabin stays') {
        node.props.method = 'get';
        node.props.submit = 'Check availability';
        const note = Core.N('text', {
          html: '<p>Availability search needs your booking provider’s HTTPS destination. Configure and test it before accepting reservations. This template does not calculate availability or confirm a booking.</p>',
          ts: 'small',
        });
        note.id = 'stillwood-booking-search-setup';
        note.css.d = { margin: '16px 0 0', 'font-size': '14px', 'max-width': '80ch', color: 'var(--c-ink)' };
        nodes.splice(index + 1, 0, note);
        searchFound = true;
      }
      if (node.type === 'heading' && String(node.props.text).includes('Demo template: this form is not connected')) {
        node.props.text = 'Before accepting real inquiries, check this form’s destination and verify a test receipt on the host where you publish.';
        contactGuidanceFound = true;
      }
      if (node.type === 'heading' && String(node.props.text).includes('Demo booking widget. Connect your PMS')) {
        node.props.text = 'This form sends a stay inquiry. It does not check availability or confirm a reservation. Configure your booking provider separately.';
      }
      walk(node.children || [], home);
    }
  };
  for (const page of document.pages) walk(page.tree, page.slug === 'index');
  if (!searchFound || !contactGuidanceFound) throw new Error('Stillwood search or contact correction target is missing');
  return document;
}
