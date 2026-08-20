/* The UI bundle's only entry point.

   builder.html calls `PC_UI.mount(core, legacy)` once at boot and gets back the render
   functions for whatever has been ported. Everything else in here — Preact included —
   stays inside the IIFE, which is what keeps its `$` from colliding with the one
   builder.html has had all along. */
import { render } from 'preact';
import { install, type Core, type Legacy } from './ctx';
import { Layers, setPainter } from './Layers';

export function mount(core: Core, legacy: Legacy) {
  install(core, legacy);

  /* Preact owns #paneLayers from here on. It diffs against what it rendered last
     time, so nothing else may write innerHTML into it — which is exactly why this
     panel went first. */
  const paint = () => {
    const host = document.getElementById('paneLayers');
    if (host) render(<Layers />, host);
  };
  setPainter(paint);

  return { renderLayers: paint };
}
