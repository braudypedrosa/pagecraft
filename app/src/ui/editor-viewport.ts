/** Browser width, independent of the canvas preview breakpoint. The document and every
 * editor surface stay mounted while editing is unavailable. */
export const MIN_EDITOR_WIDTH = 768;

export function installEditorViewport(backHref: string, syncLayers: () => void) {
  const gate = document.createElement('section');
  gate.id = 'editorWidthGate';
  gate.hidden = true;
  gate.setAttribute('aria-labelledby', 'editorWidthTitle');
  gate.innerHTML = '<div><h1 id="editorWidthTitle">Open Pagecraft on a larger screen</h1>' +
    '<p>Editing requires a window at least 768px wide. Widen this window or use a tablet or desktop to continue.</p>' +
    '<a class="btn" target="_top">Back to sites</a></div>';
  const back = gate.querySelector('a')!;
  if (backHref) back.href = backHref;
  else back.hidden = true; // A downloaded, standalone editor has no host site directory.
  gate.tabIndex = -1;
  document.body.append(gate);
  let blocked = false;
  let returnFocus: HTMLElement | null = null;
  const surfaces = () => [...document.body.children].filter((el): el is HTMLElement =>
    el instanceof HTMLElement && el !== gate && !['SCRIPT', 'STYLE'].includes(el.tagName));
  const sync = () => {
    const next = window.innerWidth < MIN_EDITOR_WIDTH;
    if (next === blocked) return;
    if (next) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    blocked = next;
    document.body.classList.toggle('editor-width-blocked', blocked);
    gate.hidden = !blocked;
    surfaces().forEach(el => { el.inert = blocked; });
    syncLayers();
    const app = document.getElementById('app');
    if (app?.getAttribute('aria-busy') === 'true') app.inert = true;
    if (blocked) gate.focus();
    else if (returnFocus?.isConnected && !returnFocus.closest('[inert],[hidden]')) returnFocus.focus();
  };
  // Menus or feedback can arrive while a request is completing on a narrow viewport.
  const observer = new MutationObserver(() => {
    if (blocked) surfaces().forEach(el => { el.inert = true; });
  });
  observer.observe(document.body, { childList: true });
  const key = (event: KeyboardEvent) => {
    if (!blocked) return;
    event.stopImmediatePropagation();
    if (!gate.contains(event.target as Node) || event.ctrlKey || event.metaKey) event.preventDefault();
  };
  const focus = (event: FocusEvent) => {
    if (blocked && !gate.contains(event.target as Node)) gate.focus();
  };
  window.addEventListener('keydown', key, true);
  window.addEventListener('focusin', focus, true);
  window.addEventListener('resize', sync);
  queueMicrotask(sync);
  return { get blocked() { return blocked; }, destroy() {
    observer.disconnect(); window.removeEventListener('keydown', key, true);
    window.removeEventListener('focusin', focus, true); window.removeEventListener('resize', sync);
    gate.remove();
  } };
}
