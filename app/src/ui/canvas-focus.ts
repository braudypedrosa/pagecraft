/** Panel visibility is a workspace preference, never part of the saved document. */
export function installCanvasFocus(onLayout: () => void) {
  const button = document.getElementById('canvasFocusBtn');
  if (!button || button.dataset.wired) return;
  button.dataset.wired = '1';
  const set = (active: boolean) => {
    document.body.classList.toggle('canvas-focus', active);
    const label = active ? 'Show side panels' : 'Hide side panels';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    button.title = label + ' (⌘⇧\\)';
    requestAnimationFrame(onLayout);
  };
  button.addEventListener('click', () => set(!document.body.classList.contains('canvas-focus')));
  document.getElementById('leftRail')?.addEventListener('click', event => {
    if ((event.target as Element).closest('button[data-t]')) set(false);
  });
  document.addEventListener('keydown', event => {
    const target = event.target as Element | null;
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key !== '\\'
      || target?.closest('input,textarea,select,[contenteditable="true"],.mask:not([hidden]),#ask:not([hidden])')) return;
    event.preventDefault();
    button.click();
  });
  set(false);
}
