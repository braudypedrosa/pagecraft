/* The scaffold's only job right now: prove the pipeline produces one self-contained
   file that runs with no network, and that the ported core is reachable from it.
   The real chrome arrives panel by panel. */
import { render } from 'preact';
import { DEF, seed, state, buildPage, lint, lintCounts } from './core/index';

function Probe() {
  seed();
  const page = state.pages[0]!;
  const html = buildPage(page);
  const counts = lintCounts(lint());
  const widgets = Object.keys(DEF).filter(k => k !== 'meta' && k !== 'ui');
  return (
    <main style={{ font: '15px/1.6 system-ui, sans-serif', padding: '32px', maxWidth: '52em' }}>
      <h1 style={{ font: '600 22px/1.2 system-ui', letterSpacing: '-.02em' }}>
        Pagecraft — Preact + TypeScript
      </h1>
      <p style={{ color: '#555' }}>
        The core is ported and running here. The chrome is still served by the legacy
        single-file build; this pipeline exists to grow into it.
      </p>
      <ul>
        <li><b>{widgets.length}</b> widget types: {widgets.join(', ')}</li>
        <li><b>{state.pages.length}</b> demo pages, <b>{page.tree.length}</b> sections on the first</li>
        <li>Home exports <b>{(html.length / 1024).toFixed(1)} KB</b> of HTML</li>
        <li>Review: <b>{counts.error}</b> errors, <b>{counts.warn}</b> suggestions</li>
      </ul>
    </main>
  );
}

render(<Probe />, document.getElementById('app')!);
