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
import { AssetField } from './AssetField';
import { ColorTokens } from './ColorTokens';
import { StyleClasses } from './StyleClasses';
import { TextStyles } from './TextStyles';
import { FontSelect } from './FontSelect';
import { ReviewList } from './ReviewList';
import { installCustomSelects } from '../../../shared/custom-select.js';

/* Host factories ship in the same sealed bundle as the editor UI. The classic single-file
   shell can therefore select Pagecraft Cloud today and WordPress later without importing a
   second component runtime or copying any schema/compiler code. */
export { createWebHostAdapter } from '../host/web';
export { createWordPressHostAdapter } from '../host/wordpress';
export { adoptHostDocument } from '../host/schema';

export function mount(core: Core, legacy: Legacy) {
  install(core, legacy);
  installCustomSelects();

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

  /* The project dialog is still legacy, but each of its image boxes has exactly one
     writer, so Preact can own that div outright — the same rule the panels were chosen
     by. It re-renders itself on change rather than the caller redrawing, which is why
     the legacy `redraw` argument has no counterpart here. */
  const mountAssetField = (hostId: string, opts: {
    get(): string | undefined; set(v: string): void; note?: string;
  }) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    const draw = () => render(
      <AssetField value={opts.get()} note={opts.note}
        onChange={v => { opts.set(v); draw(); }} />, host);
    draw();
  };

  /* Same rule again: each of these divs has one writer, so the component owns it. */
  const inBox = (id: string, node: () => any) => () => {
    const host = document.getElementById(id);
    if (host) render(node(), host);
  };
  const mountColors = inBox('mColors', () => <ColorTokens />);
  const mountClasses = inBox('mClasses', () => <StyleClasses />);
  const mountStyles = inBox('mStyles', () => <TextStyles />);
  const mountReview = (hostId = 'exReview', defaultOpen = false) =>
    inBox(hostId, () => <ReviewList defaultOpen={defaultOpen} />)();
  registerPainter('colors', mountColors);
  registerPainter('classes', mountClasses);
  registerPainter('styles', mountStyles);

  /* The project dialog's two font defaults. Same one-writer rule; the component is the
     one the text-style editor uses too, so there is a single font picker in the app. */
  const mountFontSelect = (hostId: string, opts: { get(): string; set(v: string): void; label?: string }) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    const draw = () => render(
      <FontSelect value={opts.get()} ariaLabel={opts.label}
        onChange={v => { opts.set(v); draw(); }} />, host);
    draw();
  };

  return { ...painters, mountAssetField, mountColors, mountClasses, mountStyles, mountReview, mountFontSelect };
}
