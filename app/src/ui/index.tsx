/* The UI bundle's only entry point.

   builder.html calls `PC_UI.mount(core, legacy)` once at boot and gets back the render
   functions for whatever has been ported. Everything else in here — Preact included —
   stays inside the IIFE, which is what keeps its `$` from colliding with the one
   builder.html has had all along. */
import { render } from 'preact';
import { install, registerPainter, type Core, type Legacy } from './ctx';
import { Layers } from './Layers';
import { Cms } from './Cms';
import { Add } from './Add';
import { Pages } from './Pages';
import { Inspector } from './inspector/Inspector';

export function mount(core: Core, legacy: Legacy) {
  install(core, legacy);

  /* Preact owns each of these containers from here on. It diffs against what it
     rendered last time, so nothing else may write innerHTML into one — which is how
     the panels were chosen, in order of having exactly one writer. */
  const panel = (id: string, node: () => any, skipHidden = false) => () => {
    const host = document.getElementById(id);
    if (!host) return;
    if (skipHidden && (host as HTMLElement).hidden) return;
    render(node(), host);
  };

  /* renderCms used to bail out when its panel was hidden; keeping that, since a
     hidden panel has nothing to show. The other two are painted at boot. */
  const painters = {
    renderLayers: panel('paneLayers', () => <Layers />),
    renderCms: panel('paneCms', () => <Cms />, true),
    renderAdd: panel('paneAdd', () => <Add />),
    renderPages: panel('panePages', () => <Pages />),
    /* #right is hidden and shown by the Inspector itself, so it must render even while
       hidden — the component is what decides. */
    renderRight: panel('right', () => <Inspector />)
  };
  registerPainter('layers', painters.renderLayers);
  registerPainter('add', painters.renderAdd);
  registerPainter('cms', painters.renderCms);
  registerPainter('pages', painters.renderPages);
  registerPainter('right', painters.renderRight);

  return painters;
}
